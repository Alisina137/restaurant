import {Router} from "express";
import {and,eq,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {diningTable,diningVisit,orderRound} from "./schema";
import {activeVisitFor} from "./floor-tables";
import {assertMayOpenVisit} from "./phase12-core";
import {bodyObject,bump,ensureAssigned,fail,field,floorRoute,floorScope,int,recordId} from "./floor-helpers";

export const visitRouter=Router();
visitRouter.post("/tables/:id/open",floorRoute(async(req,res)=>{
  const scope=await floorScope(req),id=recordId(req.params.id),body=bodyObject(req),
    partySize=int(body.partySize,"Party size",1,30);
  const result=await db.transaction(async tx=>{
    // Single writer per table. Two simultaneous open requests converge on one open visit.
    await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${id} AND tenant_id=${scope.tenantId} FOR UPDATE`);
    await assertMayOpenVisit(tx,scope.tenantId);
    const [table]=await tx.select().from(diningTable).where(and(eq(diningTable.id,id),
      eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId))).limit(1);
    if(!table || table.archivedAt)fail(404,"NOT_FOUND","Table is unavailable.");
    ensureAssigned(scope,table.assignedWaiterId);
    if(!table.active)fail(409,"TABLE_DISABLED","Disabled tables cannot seat guests.");
    const existing=await activeVisitFor(tx,id);
    if(existing)return {visit:existing,created:false};
    if(table.cleaning)fail(409,"CLEANING","Mark the table available after cleaning.");
    if(!table.assignedWaiterId)
      fail(409,"ASSIGN_WAITER_FIRST","Assign an active waiter before opening a visit.");
    // The seat count is guidance, not an upper hard cap: a larger party can be seated with manager approval.
    if(partySize>table.seats&&scope.role==="waiter")
      fail(409,"CAPACITY_REVIEW","Ask a manager to confirm a party larger than the table capacity.");
    const visitId=randomUUID();
    const [visit]=await tx.insert(diningVisit).values({id:visitId,tenantId:scope.tenantId,
      locationId:scope.locationId,tableId:id,waiterId:table.assignedWaiterId,
      partySize,openedBy:scope.actorId}).returning();
    await tx.update(diningTable).set({version:table.version+1,updatedAt:new Date()})
      .where(eq(diningTable.id,id));
    await bump(tx,scope,"floor.visit_opened",{visitId,tableId:id,partySize,waiterId:table.assignedWaiterId});
    return {visit:visit!,created:true};
  });
  res.status(result.created?201:200).json(result);
}));
visitRouter.get("/:id",floorRoute(async(req,res)=>{
  const scope=await floorScope(req),id=recordId(req.params.id);
  const [visit]=await db.select().from(diningVisit)
    .where(and(eq(diningVisit.id,id),eq(diningVisit.tenantId,scope.tenantId),
      eq(diningVisit.locationId,scope.locationId))).limit(1);
  if(!visit)fail(404,"NOT_FOUND","Visit not found.");
  if(scope.role==="waiter"&&visit.waiterId!==scope.actorId)
    fail(403,"NOT_ASSIGNED","This visit is assigned to another waiter.");
  res.setHeader("Cache-Control","no-store");
  res.json({visit});
}));
visitRouter.post("/:id/finish",floorRoute(async(req,res)=>{
  // P04 pilot workflow: managers end an unpaid demonstration visit. P09 will enforce check settlement.
  const scope=await floorScope(req,true),id=recordId(req.params.id);
  const reason=field(bodyObject(req).reason,160,"Closure reason",5);
  const [found]=await db.select({tableId:diningVisit.tableId}).from(diningVisit)
    .where(and(eq(diningVisit.id,id),eq(diningVisit.tenantId,scope.tenantId),
      eq(diningVisit.locationId,scope.locationId))).limit(1);
  if(!found)fail(404,"NOT_FOUND","Visit not found.");
  await db.transaction(async tx=>{
    // Same lock order as opening/assigning to prevent deadlocks.
    await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${found.tableId} AND tenant_id=${scope.tenantId} FOR UPDATE`);
    const [visit]=await tx.select().from(diningVisit).where(and(eq(diningVisit.id,id),
      eq(diningVisit.tenantId,scope.tenantId),eq(diningVisit.locationId,scope.locationId))).limit(1);
    if(!visit)fail(404,"NOT_FOUND","Visit not found.");
    if(visit.status!=="open")fail(409,"VISIT_ALREADY_CLOSED","This visit is already closed.");
    const [table]=await tx.select().from(diningTable).where(and(eq(diningTable.id,visit.tableId),
      eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId))).limit(1);
    if(!table)fail(404,"NOT_FOUND","Table unavailable.");
    const [unsettled]=await tx.select({id:orderRound.id}).from(orderRound)
      .where(and(eq(orderRound.visitId,id),eq(orderRound.tenantId,scope.tenantId),
        eq(orderRound.locationId,scope.locationId))).limit(1);
    if(unsettled)fail(409,"UNSETTLED_CHECK","Orders exist on this visit. Close it through cashier settlement when Phase 9 is enabled.");
    await tx.update(diningVisit).set({status:"closed",closedBy:scope.actorId,
      closedAt:new Date(),closedReason:reason,updatedAt:new Date()})
      .where(and(eq(diningVisit.id,id),eq(diningVisit.status,"open")));
    await tx.update(diningTable).set({cleaning:true,version:table.version+1,updatedAt:new Date()})
      .where(eq(diningTable.id,visit.tableId));
    await bump(tx,scope,"floor.visit_finished",{visitId:id,tableId:visit.tableId,reason});
  });
  res.json({finished:true,nextTableStatus:"cleaning"});
}));
