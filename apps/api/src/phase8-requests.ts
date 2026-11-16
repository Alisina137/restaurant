import {Router} from "express";
import {and,asc,count,desc,eq,inArray,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {auditEvent,diningTable,diningVisit,serviceRequest,guestRevision,floorRevision,
 diningCheck} from "./schema";
import {bodyObject,fail,field,int,route} from "./menu-helpers";
import {floorScope,isManager,type FloorScope} from "./floor-helpers";
import {guestAccess} from "./guest-security";

export const guestAssistanceRouter=Router();
export const staffAssistanceRouter=Router();
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
type Scope={tenantId:string;locationId:string};
const kinds=["call_waiter","water","bill","other"] as const;
const available=(kind:unknown):kind is typeof kinds[number]=>typeof kind==="string"&&kinds.some(x=>x===kind);
const recordId=(v:unknown)=>field(v,100,"Request ID",1);
async function lockVisit(tx:Tx,visitId:string,scope:Scope){
 const [base]=await tx.select({tableId:diningVisit.tableId}).from(diningVisit)
  .where(and(eq(diningVisit.id,visitId),eq(diningVisit.tenantId,scope.tenantId),
    eq(diningVisit.locationId,scope.locationId))).limit(1);
 if(!base)fail(404,"NOT_FOUND","Table visit unavailable.");
 await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${base.tableId}
   AND tenant_id=${scope.tenantId} AND location_id=${scope.locationId} FOR UPDATE`);
 const [visit]=await tx.select().from(diningVisit).where(and(eq(diningVisit.id,visitId),
   eq(diningVisit.tenantId,scope.tenantId),eq(diningVisit.locationId,scope.locationId))).limit(1);
 if(!visit||visit.status!=="open")fail(409,"VISIT_CLOSED","This table visit has ended.");
 return visit;
}
async function signal(tx:Tx,scope:Scope,action:string,details:Record<string,unknown>,actorId:string|null){
 await tx.insert(guestRevision).values({tenantId:scope.tenantId,locationId:scope.locationId})
   .onConflictDoUpdate({target:guestRevision.locationId,
     set:{version:sql`${guestRevision.version}+1`,changedAt:new Date()}});
 await tx.insert(floorRevision).values({tenantId:scope.tenantId,locationId:scope.locationId})
   .onConflictDoUpdate({target:floorRevision.locationId,
     set:{version:sql`${floorRevision.version}+1`,changedAt:new Date()}});
 await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,
   userId:actorId,action:"service."+action,details});
}
async function place(scope:Scope,visitId:string,kind:unknown,note:unknown,sessionId:string|null,actorId:string|null){
 if(!available(kind))fail(400,"INVALID_REQUEST","Choose waiter, water, bill or other.");
 const cleanNote=field(note??"",200,"Request note");
 if(kind==="other"&&cleanNote.length<3)fail(400,"NOTE_REQUIRED","Describe the assistance needed.");
 return db.transaction(async tx=>{
   const visit=await lockVisit(tx,visitId,scope);
   if(kind==="bill"){
     const [check]=await tx.select({status:diningCheck.status}).from(diningCheck).where(and(
       eq(diningCheck.visitId,visit.id),eq(diningCheck.tenantId,scope.tenantId))).limit(1);
     if(check?.status==="settled")fail(409,"ALREADY_SETTLED","This bill is already settled.");
   }
   const [active]=await tx.select().from(serviceRequest).where(and(
     eq(serviceRequest.visitId,visit.id),eq(serviceRequest.type,kind),
     inArray(serviceRequest.status,["pending","acknowledged"]))).limit(1);
   if(active)return {created:false,deduplicated:true,request:active};
   const [latest]=await tx.select().from(serviceRequest).where(and(
      eq(serviceRequest.visitId,visit.id),eq(serviceRequest.type,kind)))
     .orderBy(desc(serviceRequest.createdAt)).limit(1);
   if(latest&&Date.now()-latest.createdAt.getTime()<45_000)
     return {created:false,deduplicated:true,request:latest};
   const [created]=await tx.insert(serviceRequest).values({
     id:randomUUID(),tenantId:scope.tenantId,locationId:scope.locationId,
     visitId:visit.id,tableId:visit.tableId,guestSessionId:sessionId,
     createdBy:actorId,type:kind,note:cleanNote,status:"pending"
   }).returning();
   if(!created)fail(503,"SAVE_FAILED","Could not create request.");
   await signal(tx,scope,"created",{id:created.id,type:kind,visitId:visit.id,tableId:visit.tableId},actorId);
   return {created:true,deduplicated:false,request:created};
 });
}
guestAssistanceRouter.get("/requests",route(async(req,res)=>{
 const scope=await guestAccess(req);
 const rows=await db.select({id:serviceRequest.id,type:serviceRequest.type,
   status:serviceRequest.status,note:serviceRequest.note,version:serviceRequest.version,
   createdAt:serviceRequest.createdAt,acknowledgedAt:serviceRequest.acknowledgedAt,
   resolvedAt:serviceRequest.resolvedAt,resolutionNote:serviceRequest.resolutionNote})
  .from(serviceRequest).where(and(eq(serviceRequest.tenantId,scope.tenantId),
     eq(serviceRequest.locationId,scope.locationId),eq(serviceRequest.visitId,scope.visitId)))
  .orderBy(desc(serviceRequest.createdAt)).limit(50);
 res.setHeader("Cache-Control","no-store");res.json({items:rows,visitId:scope.visitId});
}));
guestAssistanceRouter.post("/requests",route(async(req,res)=>{
 const scope=await guestAccess(req),data=bodyObject(req);
 const result=await place(scope,scope.visitId,data.type,data.note,scope.sessionId,null);
 res.status(result.created?201:200).json(result);
}));
staffAssistanceRouter.get("/requests",route(async(req,res)=>{
 const scope=await floorScope(req);
 const status=typeof req.query.status==="string"?req.query.status:"active";
 if(!["active","pending","acknowledged","resolved","all"].includes(status))
   fail(400,"INVALID_FILTER","Unknown request status.");
 const raw=typeof req.query.page==="string"?Number(req.query.page):1,
   page=Number.isSafeInteger(raw)&&raw>=1?Math.min(raw,10000):1;
 const tableId=typeof req.query.tableId==="string"?recordId(req.query.tableId):null;
 const where=and(eq(serviceRequest.tenantId,scope.tenantId),
   eq(serviceRequest.locationId,scope.locationId),
   scope.role==="waiter"?eq(diningVisit.waiterId,scope.actorId):undefined,
   tableId?eq(serviceRequest.tableId,tableId):undefined,
   status==="active"?inArray(serviceRequest.status,["pending","acknowledged"]):
   status==="all"?undefined:eq(serviceRequest.status,status));
 const [items,counts]=await Promise.all([
   db.select({request:serviceRequest,tableLabel:diningTable.label,
     waiterId:diningVisit.waiterId,visitStatus:diningVisit.status})
     .from(serviceRequest).innerJoin(diningVisit,eq(diningVisit.id,serviceRequest.visitId))
     .innerJoin(diningTable,eq(diningTable.id,serviceRequest.tableId))
     .where(where).orderBy(asc(serviceRequest.createdAt)).limit(20).offset((page-1)*20),
   db.select({n:count()}).from(serviceRequest).innerJoin(diningVisit,
     eq(diningVisit.id,serviceRequest.visitId)).where(where)
 ]);
 res.setHeader("Cache-Control","no-store");
 res.json({items:items.map(x=>({...x.request,tableLabel:x.tableLabel,
   waiterId:x.waiterId,visitStatus:x.visitStatus})),
   total:counts[0]?.n??0,page,perPage:20});
}));
staffAssistanceRouter.get("/requests/count",route(async(req,res)=>{
 const scope=await floorScope(req);
 const [x]=await db.select({n:count()}).from(serviceRequest)
   .innerJoin(diningVisit,eq(diningVisit.id,serviceRequest.visitId))
   .where(and(eq(serviceRequest.tenantId,scope.tenantId),
     eq(serviceRequest.locationId,scope.locationId),eq(diningVisit.status,"open"),
     inArray(serviceRequest.status,["pending","acknowledged"]),
     scope.role==="waiter"?eq(diningVisit.waiterId,scope.actorId):undefined));
 res.setHeader("Cache-Control","no-store");res.json({active:x?.n??0});
}));
staffAssistanceRouter.post("/visits/:id/requests",route(async(req,res)=>{
 const scope=await floorScope(req),data=bodyObject(req),visitId=recordId(req.params.id);
 const [visit]=await db.select().from(diningVisit).where(and(eq(diningVisit.id,visitId),
    eq(diningVisit.tenantId,scope.tenantId),eq(diningVisit.locationId,scope.locationId))).limit(1);
 if(!visit)fail(404,"NOT_FOUND","Visit unavailable.");
 if(scope.role==="waiter"&&visit.waiterId!==scope.actorId)
   fail(403,"NOT_ASSIGNED","Only the assigned waiter can request service.");
 const result=await place(scope,visitId,data.type,data.note,null,scope.actorId);
 res.status(result.created?201:200).json(result);
}));
staffAssistanceRouter.post("/requests/:id/transition",route(async(req,res)=>{
 const scope=await floorScope(req),requestId=recordId(req.params.id),data=bodyObject(req);
 const version=int(data.version,"Request version",1,2_000_000_000),
   next=data.action,reason=field(data.note??"",200,"Resolution note");
 if(next!=="acknowledge"&&next!=="resolve")
   fail(400,"INVALID_ACTION","Choose acknowledge or resolve.");
 const result=await db.transaction(async tx=>{
   const [target]=await tx.select({visitId:serviceRequest.visitId}).from(serviceRequest).where(and(
     eq(serviceRequest.id,requestId),eq(serviceRequest.tenantId,scope.tenantId),
     eq(serviceRequest.locationId,scope.locationId))).limit(1);
   if(!target)fail(404,"NOT_FOUND","Request unavailable.");
   const visit=await lockVisit(tx,target.visitId,scope);
   if(scope.role==="waiter"&&visit.waiterId!==scope.actorId)
     fail(403,"NOT_ASSIGNED","This table belongs to another waiter.");
   const [request]=await tx.select().from(serviceRequest).where(eq(serviceRequest.id,requestId)).limit(1);
   if(!request||request.version!==version)
     fail(409,"VERSION_CONFLICT","Request already changed. Refresh.");
   if(next==="acknowledge"&&request.status!=="pending"||
      next==="resolve"&&!["pending","acknowledged"].includes(request.status))
     fail(409,"ALREADY_HANDLED","Request is already handled.");
   const now=new Date(),[changed]=await tx.update(serviceRequest).set({
     status:next==="acknowledge"?"acknowledged":"resolved",
     version:version+1,updatedAt:now,
     ...(next==="acknowledge"?{acknowledgedAt:now,acknowledgedBy:scope.actorId}:
       {resolvedAt:now,resolvedBy:scope.actorId,resolutionNote:reason})
   }).where(eq(serviceRequest.id,requestId)).returning();
   await signal(tx,scope,next==="acknowledge"?"acknowledged":"resolved",
     {requestId,visitId:visit.id,type:request.type,reason},scope.actorId);
   return changed!;
 });
 res.json(result);
}));
