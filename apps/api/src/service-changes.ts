import {Router} from "express";
import {and,asc,count,desc,eq,inArray,ne,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {auditEvent,diningVisit,kitchenTicket,orderChangeRequest,orderLine,
 orderRound} from "./schema";
import {bodyObject,fail,field,int,route,scopeFor} from "./menu-helpers";
import {orderChanged,orderScope} from "./order-core";
import {orderGuard} from "./finance-core";
import {bumpService} from "./service-requests";
export const changeRouter=Router();
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
const pageOf=(v:unknown)=>typeof v==="string"&&/^\d+$/.test(v)?Math.min(10000,Math.max(1,Number(v))):1;
export async function effectiveSubtotal(tx:Tx,scope:{tenantId:string;locationId:string},visitId:string){
 const [rounds,changes]=await Promise.all([
   tx.select({totalMinor:orderRound.totalMinor}).from(orderRound).where(and(
     eq(orderRound.tenantId,scope.tenantId),eq(orderRound.locationId,scope.locationId),
     eq(orderRound.visitId,visitId))),
   tx.select({deltaMinor:orderChangeRequest.deltaMinor}).from(orderChangeRequest)
    .where(and(eq(orderChangeRequest.tenantId,scope.tenantId),
      eq(orderChangeRequest.locationId,scope.locationId),eq(orderChangeRequest.visitId,visitId),
      eq(orderChangeRequest.status,"approved")))
 ]);
 return rounds.reduce((sum,r)=>sum+r.totalMinor,0)+changes.reduce((sum,x)=>sum+x.deltaMinor,0);
}
const canAdjust=(role:string)=>role==="owner"||role==="manager";
changeRouter.get("/changes",route(async(req,res)=>{
 const scope=await orderScope(req,false);
 const status=typeof req.query.status==="string"?req.query.status:"pending",page=pageOf(req.query.page);
 const visitId=typeof req.query.visitId==="string"?field(req.query.visitId,100,"Visit",1):null;
 if(!["pending","approved","rejected","all"].includes(status))
   fail(400,"INVALID_FILTER","Invalid change status.");
 const where=and(eq(orderChangeRequest.tenantId,scope.tenantId),
   eq(orderChangeRequest.locationId,scope.locationId),
   status==="all"?undefined:eq(orderChangeRequest.status,status),
   visitId?eq(orderChangeRequest.visitId,visitId):undefined,
   scope.role==="waiter"?eq(diningVisit.waiterId,scope.actorId):undefined);
 const [rows,totals]=await Promise.all([
   db.select({change:orderChangeRequest,lineNameFa:orderLine.itemNameFa,
      lineNamePs:orderLine.itemNamePs,lineNameEn:orderLine.itemNameEn,
      lineQuantity:orderLine.quantity,lineAmountMinor:orderLine.lineTotalMinor,
      kitchenStatus:orderLine.kitchenStatus,tableId:diningVisit.tableId})
      .from(orderChangeRequest).innerJoin(orderLine,eq(orderLine.id,orderChangeRequest.lineId))
      .innerJoin(diningVisit,eq(diningVisit.id,orderChangeRequest.visitId))
      .where(where).orderBy(asc(orderChangeRequest.createdAt),asc(orderChangeRequest.id))
      .limit(10).offset((page-1)*10),
   db.select({n:count()}).from(orderChangeRequest)
      .innerJoin(diningVisit,eq(diningVisit.id,orderChangeRequest.visitId)).where(where)
 ]);
 res.setHeader("Cache-Control","no-store");
 res.json({items:rows.map(x=>({...x.change,itemNameFa:x.lineNameFa,itemNamePs:x.lineNamePs,
    itemNameEn:x.lineNameEn,quantity:x.lineQuantity,originalMinor:x.lineAmountMinor,
    kitchenStatus:x.kitchenStatus})),total:totals[0]?.n??0,page,perPage:10});
}));
changeRouter.post("/changes",route(async(req,res)=>{
 const scope=await orderScope(req,false);
 const body=bodyObject(req),lineId=field(body.lineId,100,"Line",1),
   reason=field(body.reason,250,"Reason",8),key=field(body.idempotencyKey,100,"Request key",12);
 if(!/^[A-Za-z0-9_-]{12,100}$/.test(key))fail(400,"INVALID_KEY","Invalid retry key.");
 const response=await db.transaction(async tx=>{
   const [line]=await tx.select().from(orderLine).where(and(eq(orderLine.id,lineId),
     eq(orderLine.tenantId,scope.tenantId),eq(orderLine.locationId,scope.locationId))).limit(1);
   if(!line)fail(404,"NOT_FOUND","Item unavailable.");
   const [round]=await tx.select().from(orderRound).where(and(eq(orderRound.id,line.roundId),
     eq(orderRound.tenantId,scope.tenantId),eq(orderRound.locationId,scope.locationId))).limit(1);
   if(!round)fail(404,"NOT_FOUND","Order unavailable.");
   await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${round.tableId}
     AND tenant_id=${scope.tenantId} FOR UPDATE`);
   const [previous]=await tx.select().from(orderChangeRequest).where(and(
      eq(orderChangeRequest.tenantId,scope.tenantId),
      eq(orderChangeRequest.requestedBy,scope.actorId),
      eq(orderChangeRequest.idempotencyKey,key))).limit(1);
   if(previous){
     if(previous.lineId!==lineId||previous.reason!==reason)
       fail(409,"IDEMPOTENCY_CONFLICT","A different change already uses this key.");
     return {created:false,change:previous};
   }
   const [visit]=await tx.select().from(diningVisit).where(and(
     eq(diningVisit.id,round.visitId),eq(diningVisit.tenantId,scope.tenantId),
     eq(diningVisit.locationId,scope.locationId))).limit(1);
   if(!visit||visit.status!=="open")fail(409,"VISIT_CLOSED","Visit is already closed.");
   if(scope.role==="waiter"&&visit.waiterId!==scope.actorId)
     fail(403,"NOT_ASSIGNED","Another waiter is assigned to this visit.");
   await orderGuard(tx,scope,visit.id);
   const [currentLine]=await tx.select().from(orderLine).where(eq(orderLine.id,lineId)).limit(1);
   if(!currentLine||!["new","preparing"].includes(currentLine.kitchenStatus))
      fail(409,"ITEM_ALREADY_PREPARED","Only unready food can be requested for cancellation.");
   const [active]=await tx.select().from(orderChangeRequest).where(and(
     eq(orderChangeRequest.lineId,lineId),eq(orderChangeRequest.status,"pending"))).limit(1);
   if(active)return {created:false,change:active};
   const [ticket]=await tx.select().from(kitchenTicket).where(and(
     eq(kitchenTicket.roundId,round.id),eq(kitchenTicket.tenantId,scope.tenantId),
     eq(kitchenTicket.locationId,scope.locationId))).limit(1);
   if(!ticket||!["new","preparing"].includes(ticket.status))
     fail(409,"KITCHEN_BUSY","This order has advanced too far to cancel safely.");
   const [created]=await tx.insert(orderChangeRequest).values({id:randomUUID(),
     tenantId:scope.tenantId,locationId:scope.locationId,visitId:round.visitId,
     tableId:round.tableId,roundId:round.id,lineId,ticketId:ticket.id,
     requestedBy:scope.actorId,idempotencyKey:key,reason,status:"pending"}).returning();
   if(!created)fail(503,"REQUEST_FAILED","Could not submit correction.");
   await tx.insert(auditEvent).values({id:randomUUID(),userId:scope.actorId,
     tenantId:scope.tenantId,action:"order.change_requested",
     details:{id:created.id,roundId:round.id,lineId,reason}});
   await bumpService(tx,scope);
   return {created:true,change:created};
 });
 res.status(response.created?201:200).json({created:response.created,...response.change});
}));
changeRouter.post("/changes/:id/decision",route(async(req,res)=>{
 const scope=await orderScope(req,false);
 if(!canAdjust(scope.role))fail(403,"MANAGER_REQUIRED","Only a manager may approve order changes.");
 const id=field(req.params.id,100,"Change",1),body=bodyObject(req);
 const version=int(body.version,"Version",1,2_000_000_000),decision=body.decision;
 if(decision!=="approve"&&decision!=="reject")
    fail(400,"INVALID_DECISION","Choose approve or reject.");
 const decisionReason=field(body.decisionReason??"",250,"Decision reason",
   decision==="reject"?8:0);
 const result=await db.transaction(async tx=>{
   const [target]=await tx.select().from(orderChangeRequest).where(and(
     eq(orderChangeRequest.id,id),eq(orderChangeRequest.tenantId,scope.tenantId),
     eq(orderChangeRequest.locationId,scope.locationId))).limit(1);
   if(!target)fail(404,"NOT_FOUND","Change request unavailable.");
   await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${target.tableId}
     AND tenant_id=${scope.tenantId} FOR UPDATE`);
   await tx.execute(sql`SELECT id FROM kitchen_tickets WHERE id=${target.ticketId}
     AND tenant_id=${scope.tenantId} FOR UPDATE`);
   const [request]=await tx.select().from(orderChangeRequest).where(and(
     eq(orderChangeRequest.id,id),eq(orderChangeRequest.tenantId,scope.tenantId))).limit(1);
   if(!request||request.status!=="pending"||request.version!==version)
     fail(409,"VERSION_CONFLICT","This change was already reviewed. Reload.");
   const [visit]=await tx.select().from(diningVisit).where(and(
     eq(diningVisit.id,request.visitId),eq(diningVisit.tenantId,scope.tenantId))).limit(1);
   if(!visit||visit.status!=="open")fail(409,"VISIT_CLOSED","Visit is already closed.");
   let deltaMinor=0;
   if(decision==="approve"){
     await orderGuard(tx,scope,request.visitId);
     const [line]=await tx.select().from(orderLine).where(and(eq(orderLine.id,request.lineId),
       eq(orderLine.roundId,request.roundId),eq(orderLine.tenantId,scope.tenantId))).limit(1);
     const [ticket]=await tx.select().from(kitchenTicket).where(and(
       eq(kitchenTicket.id,request.ticketId),eq(kitchenTicket.tenantId,scope.tenantId))).limit(1);
     if(!line||!ticket||!["new","preparing"].includes(line.kitchenStatus)||
       !["new","preparing"].includes(ticket.status))
       fail(409,"KITCHEN_ADVANCED","This item is now ready/served; manager cannot cancel it.");
     deltaMinor=-line.lineTotalMinor;
     await tx.update(orderLine).set({kitchenStatus:"cancelled"}).where(eq(orderLine.id,line.id));
     const remaining=await tx.select({id:orderLine.id}).from(orderLine).where(and(
       eq(orderLine.roundId,request.roundId),eq(orderLine.tenantId,scope.tenantId),
       ne(orderLine.kitchenStatus,"cancelled"))).limit(1);
     await tx.update(kitchenTicket).set({status:remaining?ticket.status:"cancelled",
       version:ticket.version+1,updatedAt:new Date()}).where(eq(kitchenTicket.id,ticket.id));
     await orderChanged(tx,scope,request.roundId,"order.line_cancelled",{
       id:request.id,lineId:line.id,deltaMinor,reason:request.reason,
       ticketId:ticket.id,allCancelled:!remaining.length});
   }
   const now=new Date(),[updated]=await tx.update(orderChangeRequest).set({
     status:decision==="approve"?"approved":"rejected",version:request.version+1,
     decidedBy:scope.actorId,decisionReason,deltaMinor,decidedAt:now
   }).where(and(eq(orderChangeRequest.id,id),eq(orderChangeRequest.version,version))).returning();
   if(!updated)fail(409,"VERSION_CONFLICT","Change was already processed.");
   await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,
     userId:scope.actorId,action:"order.change_"+(decision==="approve"?"approved":"rejected"),
     details:{id,lineId:request.lineId,roundId:request.roundId,deltaMinor,
       requestReason:request.reason,decisionReason}});
   await bumpService(tx,scope);
   return updated;
 });
 res.json(result);
}));
