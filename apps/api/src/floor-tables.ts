import {Router} from "express";
import {and,asc,count,eq,isNotNull,isNull,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {diningSection,diningTable,diningVisit,tenantMembership,user} from "./schema";
import {bump,bool,bodyObject,ensureAssigned,fail,field,floorRoute,floorScope,int,isManager,paging,recordId,version,
  type FloorScope} from "./floor-helpers";

export const tableRouter=Router();

async function waiterAllowed(tx:typeof db|Parameters<Parameters<typeof db.transaction>[0]>[0],
  scope:FloorScope,waiterId:string|null){
  if(waiterId===null)return;
  const [membership]=await tx.select({id:tenantMembership.id}).from(tenantMembership)
    .where(and(eq(tenantMembership.tenantId,scope.tenantId),eq(tenantMembership.userId,waiterId),
      eq(tenantMembership.role,"waiter"),eq(tenantMembership.status,"active"))).limit(1);
  if(!membership)fail(400,"INVALID_WAITER","Select an active waiter from your restaurant.");
}
async function sectionAllowed(tx:typeof db|Parameters<Parameters<typeof db.transaction>[0]>[0],
  scope:FloorScope,sectionId:string){
  // Section lock serializes archive/disable and table add/move.
  await tx.execute(sql`SELECT id FROM dining_sections WHERE id=${sectionId} AND tenant_id=${scope.tenantId} FOR UPDATE`);
  const [section]=await tx.select().from(diningSection)
    .where(and(eq(diningSection.id,sectionId),eq(diningSection.tenantId,scope.tenantId),
      eq(diningSection.locationId,scope.locationId),isNull(diningSection.archivedAt))).limit(1);
  if(!section || !section.active)fail(400,"INVALID_SECTION","Choose an active dining section.");
}
function tableFields(x:Record<string,unknown>){
  const waiter=x.assignedWaiterId;
  return {label:field(x.label,12,"Table label",1),sectionId:field(x.sectionId,100,"Section ID",1),
    seats:int(x.seats??4,"Seats",1,30),sortOrder:int(x.sortOrder??0,"Display order",-9999,9999),
    notes:field(x.notes??"",240,"Notes"),active:bool(x.active??true,"Active"),
    assignedWaiterId: waiter===null||waiter===""||waiter===undefined?null:field(waiter,100,"Waiter ID",1)};
}
function tableState(active:boolean,cleaning:boolean,visitId:string|null){
  return !active?"disabled":visitId?"occupied":cleaning?"cleaning":"available";
}
async function activeVisitFor(tx:typeof db|Parameters<Parameters<typeof db.transaction>[0]>[0],tableId:string){
  return (await tx.select().from(diningVisit)
    .where(and(eq(diningVisit.tableId,tableId),eq(diningVisit.status,"open"))).limit(1))[0]??null;
}
async function tableFor(scope:FloorScope,id:string){
  const [row]=await db.select({id:diningTable.id,tenantId:diningTable.tenantId,locationId:diningTable.locationId,
    sectionId:diningTable.sectionId,sectionName:diningSection.name,label:diningTable.label,seats:diningTable.seats,
    notes:diningTable.notes,sortOrder:diningTable.sortOrder,active:diningTable.active,cleaning:diningTable.cleaning,
    assignedWaiterId:diningTable.assignedWaiterId,assignedWaiterName:user.name,version:diningTable.version,
    archivedAt:diningTable.archivedAt,createdAt:diningTable.createdAt,
    visitId:diningVisit.id,visitWaiterId:diningVisit.waiterId,
    visitPartySize:diningVisit.partySize,visitOpenedAt:diningVisit.openedAt})
    .from(diningTable).innerJoin(diningSection,eq(diningTable.sectionId,diningSection.id))
    .leftJoin(user,eq(diningTable.assignedWaiterId,user.id))
    .leftJoin(diningVisit,and(eq(diningVisit.tableId,diningTable.id),eq(diningVisit.status,"open")))
    .where(and(eq(diningTable.id,id),eq(diningTable.tenantId,scope.tenantId),
      eq(diningTable.locationId,scope.locationId))).limit(1);
  return row?{...row,status:tableState(row.active,row.cleaning,row.visitId)}:null;
}
tableRouter.get("/staff",floorRoute(async(req,res)=>{
  const scope=await floorScope(req);
  const rows=await db.select({id:user.id,name:user.name})
    .from(tenantMembership).innerJoin(user,eq(tenantMembership.userId,user.id))
    .where(and(eq(tenantMembership.tenantId,scope.tenantId),eq(tenantMembership.role,"waiter"),
      eq(tenantMembership.status,"active")))
    .orderBy(asc(user.name)).limit(250);
  res.json({items:rows});
}));
tableRouter.get("/board",floorRoute(async(req,res)=>{
  const scope=await floorScope(req);
  const sections=await db.select().from(diningSection)
    .where(and(eq(diningSection.tenantId,scope.tenantId),eq(diningSection.locationId,scope.locationId),
      isNull(diningSection.archivedAt))).orderBy(asc(diningSection.sortOrder),asc(diningSection.name)).limit(300);
  const rows=await db.select({id:diningTable.id,sectionId:diningTable.sectionId,sectionName:diningSection.name,
    label:diningTable.label,seats:diningTable.seats,notes:diningTable.notes,sortOrder:diningTable.sortOrder,
    active:diningTable.active,cleaning:diningTable.cleaning,assignedWaiterId:diningTable.assignedWaiterId,
    assignedWaiterName:user.name,version:diningTable.version,visitId:diningVisit.id,
    visitPartySize:diningVisit.partySize,visitOpenedAt:diningVisit.openedAt,
    visitWaiterId:diningVisit.waiterId})
    .from(diningTable).innerJoin(diningSection,eq(diningTable.sectionId,diningSection.id))
    .leftJoin(user,eq(diningTable.assignedWaiterId,user.id))
    .leftJoin(diningVisit,and(eq(diningVisit.tableId,diningTable.id),eq(diningVisit.status,"open")))
    .where(and(eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId),
      isNull(diningTable.archivedAt)))
    .orderBy(asc(diningSection.sortOrder),asc(diningTable.sortOrder),asc(diningTable.label)).limit(1001);
  if(rows.length>1000)fail(409,"FLOOR_LIMIT","Large floor exceeds 1000 tables; contact support.");
  res.setHeader("Cache-Control","no-store");
  res.json({sections,tables:rows.map(t=>({...t,status:tableState(t.active,t.cleaning,t.visitId)})),
    locationId:scope.locationId,actorId:scope.actorId,role:scope.role});
}));
tableRouter.get("/",floorRoute(async(req,res)=>{
  const scope=await floorScope(req,true),{page,limit,offset}=paging(req);
  const where=and(eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId),
    req.query.archive==="1"?isNotNull(diningTable.archivedAt):isNull(diningTable.archivedAt),
    typeof req.query.section==="string"&&req.query.section?eq(diningTable.sectionId,req.query.section):undefined);
  const [rows,totals]=await Promise.all([
    db.select({id:diningTable.id}).from(diningTable).where(where)
      .orderBy(asc(diningTable.sortOrder),asc(diningTable.label)).limit(limit).offset(offset),
    db.select({n:count()}).from(diningTable).where(where)
  ]);
  res.json({items:(await Promise.all(rows.map(r=>tableFor(scope,r.id)))).filter(x=>x!==null),
    total:totals[0]?.n??0,page,perPage:limit});
}));
tableRouter.get("/:id",floorRoute(async(req,res)=>{
  const scope=await floorScope(req),id=recordId(req.params.id);
  const row=await tableFor(scope,id);
  if(!row)fail(404,"NOT_FOUND","Table not found.");
  res.setHeader("Cache-Control","no-store");
  res.json({table:row,canOpen:isManager(scope)||row.assignedWaiterId===scope.actorId});
}));
tableRouter.post("/",floorRoute(async(req,res)=>{
  const scope=await floorScope(req,true),data=tableFields(bodyObject(req)),id=randomUUID();
  await db.transaction(async tx=>{
    await sectionAllowed(tx,scope,data.sectionId);
    await waiterAllowed(tx,scope,data.assignedWaiterId);
    await tx.insert(diningTable).values({...data,id,tenantId:scope.tenantId,locationId:scope.locationId});
    await bump(tx,scope,"floor.table_created",{tableId:id,label:data.label,sectionId:data.sectionId});
  });
  res.status(201).json({id,created:true});
}));
tableRouter.patch("/:id",floorRoute(async(req,res)=>{
  const scope=await floorScope(req,true),id=recordId(req.params.id),payload=bodyObject(req),
    v=version(payload.version),data=tableFields(payload);
  await db.transaction(async tx=>{
    // Lock both section and table. Section lock prevents archived-section assignment.
    await sectionAllowed(tx,scope,data.sectionId);
    await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${id} AND tenant_id=${scope.tenantId} FOR UPDATE`);
    const [old]=await tx.select().from(diningTable).where(and(eq(diningTable.id,id),
      eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId),isNull(diningTable.archivedAt))).limit(1);
    if(!old)fail(404,"NOT_FOUND","Table not found.");
    if(old.version!==v)fail(409,"VERSION_CONFLICT","Table changed elsewhere. Refresh.");
    await waiterAllowed(tx,scope,data.assignedWaiterId);
    const visit=await activeVisitFor(tx,id);
    if(visit && (!data.active || data.sectionId!==old.sectionId || data.assignedWaiterId===null))
      fail(409,"VISIT_ACTIVE","Cannot disable, move, or unassign an occupied table.");
    if(visit && data.assignedWaiterId!==old.assignedWaiterId)
      await tx.update(diningVisit).set({waiterId:data.assignedWaiterId!,updatedAt:new Date()})
        .where(eq(diningVisit.id,visit.id));
    const [result]=await tx.update(diningTable).set({...data,version:v+1,updatedAt:new Date()}).where(and(
      eq(diningTable.id,id),eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId),
      eq(diningTable.version,v),isNull(diningTable.archivedAt))).returning({id:diningTable.id});
    if(!result)fail(409,"VERSION_CONFLICT","Table changed. Refresh.");
    await bump(tx,scope,old.assignedWaiterId!==data.assignedWaiterId?"floor.waiter_reassigned":"floor.table_updated",{
      tableId:id,oldWaiterId:old.assignedWaiterId,newWaiterId:data.assignedWaiterId});
  });
  res.json({saved:true});
}));
tableRouter.post("/:id/archive",floorRoute(async(req,res)=>{
  const scope=await floorScope(req,true),id=recordId(req.params.id),v=version(bodyObject(req).version);
  await db.transaction(async tx=>{
    await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${id} AND tenant_id=${scope.tenantId} FOR UPDATE`);
    const [row]=await tx.select().from(diningTable).where(and(eq(diningTable.id,id),
      eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId),
      isNull(diningTable.archivedAt))).limit(1);
    if(!row)fail(404,"NOT_FOUND","Table not found.");
    if(row.version!==v)fail(409,"VERSION_CONFLICT","Table changed. Refresh.");
    if(await activeVisitFor(tx,id))fail(409,"VISIT_ACTIVE","An occupied table cannot be archived.");
    const [result]=await tx.update(diningTable).set({archivedAt:new Date(),active:false,
      version:v+1,updatedAt:new Date()}).where(and(eq(diningTable.id,id),eq(diningTable.version,v),
      eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId),
      isNull(diningTable.archivedAt))).returning({id:diningTable.id});
    if(!result)fail(409,"VERSION_CONFLICT","Table changed. Refresh.");
    await bump(tx,scope,"floor.table_archived",{tableId:id});
  });
  res.json({archived:true});
}));
tableRouter.post("/:id/ready",floorRoute(async(req,res)=>{
  const scope=await floorScope(req),id=recordId(req.params.id),v=version(bodyObject(req).version);
  await db.transaction(async tx=>{
    await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${id} AND tenant_id=${scope.tenantId} FOR UPDATE`);
    const [row]=await tx.select().from(diningTable).where(and(eq(diningTable.id,id),eq(diningTable.tenantId,scope.tenantId),
      eq(diningTable.locationId,scope.locationId),isNull(diningTable.archivedAt))).limit(1);
    if(!row)fail(404,"NOT_FOUND","Table not found.");
    ensureAssigned(scope,row.assignedWaiterId);
    if(row.version!==v)fail(409,"VERSION_CONFLICT","Table changed. Refresh.");
    if(await activeVisitFor(tx,id))fail(409,"VISIT_ACTIVE","Cannot clean an occupied table.");
    if(!row.active || !row.cleaning)fail(409,"INVALID_STATE","Table is not awaiting cleaning.");
    await tx.update(diningTable).set({cleaning:false,version:v+1,updatedAt:new Date()})
      .where(and(eq(diningTable.id,id),eq(diningTable.tenantId,scope.tenantId),
      eq(diningTable.locationId,scope.locationId),eq(diningTable.version,v)));
    await bump(tx,scope,"floor.table_ready",{tableId:id});
  });
  res.json({available:true});
}));
export {tableFor, activeVisitFor};
