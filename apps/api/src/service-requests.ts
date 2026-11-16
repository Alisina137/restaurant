import {Router} from "express";
import {and,asc,count,desc,eq,gt,inArray,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import type {Request} from "express";
import {db} from "./db";
import {auditEvent,diningTable,diningVisit,serviceRequest,serviceRevision} from "./schema";
import {bodyObject,fail,field,int,route,scopeFor} from "./menu-helpers";
import {guestAccess,type GuestScope} from "./guest-security";
export const guestServiceRouter=Router(),staffServiceRouter=Router();
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
type Staff={tenantId:string;locationId:string;actorId:string;role:string};
const outstanding=["pending","acknowledged"];
const parsePage=(v:unknown)=>typeof v==="string"&&/^\d+$/.test(v)?Math.min(10000,Math.max(1,Number(v))):1;
export async function bumpService(tx:Tx,scope:{tenantId:string;locationId:string}){
 await tx.insert(serviceRevision).values({tenantId:scope.tenantId,locationId:scope.locationId,version:1})
   .onConflictDoUpdate({target:serviceRevision.locationId,
     set:{version:sql`${serviceRevision.version}+1`,changedAt:new Date()}});
}
async function staff(req:Request,allowCashier=false):Promise<Staff>{
 const scope=await scopeFor(req);
 if(!["waiter","manager","owner",...(allowCashier?["cashier"]:[])].includes(scope.role))
   fail(403,"ACCESS_DENIED","Restaurant service access required.");
 return scope;
}
const staffFilter=(scope:Staff)=>and(eq(serviceRequest.tenantId,scope.tenantId),
 eq(serviceRequest.locationId,scope.locationId),
 scope.role==="waiter"?eq(serviceRequest.assignedWaiterId,scope.actorId):undefined,
 scope.role==="cashier"?eq(serviceRequest.type,"bill"):undefined);
async function owned(tx:Tx,scope:Staff,id:string){
 const [row]=await tx.select().from(serviceRequest).where(and(staffFilter(scope),eq(serviceRequest.id,id))).limit(1);
 if(!row)fail(404,"NOT_FOUND","Request unavailable.");return row;
}
const safe=(row:typeof serviceRequest.$inferSelect)=>({
 id:row.id,visitId:row.visitId,tableId:row.tableId,type:row.type,reason:row.reason,
 note:row.note,splitPreference:row.splitPreference,status:row.status,version:row.version,
 createdAt:row.createdAt,updatedAt:row.updatedAt,
 acknowledgedAt:row.acknowledgedAt,resolvedAt:row.resolvedAt,resolutionNote:row.resolutionNote
});
guestServiceRouter.get("/service",route(async(req,res)=>{
 const scope=await guestAccess(req);
 const rows=await db.select().from(serviceRequest).where(and(
    eq(serviceRequest.tenantId,scope.tenantId),eq(serviceRequest.locationId,scope.locationId),
    eq(serviceRequest.visitId,scope.visitId)))
   .orderBy(desc(serviceRequest.createdAt),desc(serviceRequest.id)).limit(60);
 res.setHeader("Cache-Control","no-store");res.json({items:rows.map(safe)});
}));
guestServiceRouter.post("/service",route(async(req,res)=>{
 const scope=await guestAccess(req),body=bodyObject(req);
 const type=body.type;
 if(type!=="assistance"&&type!=="bill")fail(400,"INVALID_TYPE","Choose assistance or request bill.");
 const reason=type==="bill"?"bill":field(body.reason,30,"Reason",1);
 if(type==="assistance"&&!["need_help","water","cutlery","other"].includes(reason))
   fail(400,"INVALID_REASON","Choose a valid assistance reason.");
 const note=field(body.note??"",200,"Note");
 const splitPreference=type==="bill"?body.splitPreference??"together":null;
 if(type==="bill"&&splitPreference!=="together"&&splitPreference!=="split")
   fail(400,"INVALID_PREFERENCE","Choose together or split.");
 const key=field(body.idempotencyKey,100,"Request key",12);
 if(!/^[A-Za-z0-9_-]{12,100}$/.test(key))fail(400,"INVALID_KEY","Invalid retry key.");
 const result=await db.transaction(async tx=>{
   await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${scope.tableId}
     AND tenant_id=${scope.tenantId} FOR UPDATE`);
   const [visit]=await tx.select().from(diningVisit).where(and(
     eq(diningVisit.id,scope.visitId),eq(diningVisit.tenantId,scope.tenantId),
     eq(diningVisit.locationId,scope.locationId),eq(diningVisit.status,"open"))).limit(1);
   if(!visit)fail(409,"VISIT_CLOSED","The table visit ended.");
   const [replayed]=await tx.select().from(serviceRequest).where(and(
     eq(serviceRequest.guestSessionId,scope.sessionId),eq(serviceRequest.idempotencyKey,key))).limit(1);
   if(replayed){
     if(replayed.type!==type||replayed.reason!==reason||replayed.note!==note||
        replayed.splitPreference!==splitPreference)
       fail(409,"IDEMPOTENCY_CONFLICT","This request key was already used.");
     return {created:false,request:replayed,replayed:true};
   }
   const [existing]=await tx.select().from(serviceRequest).where(and(
     eq(serviceRequest.visitId,scope.visitId),eq(serviceRequest.tenantId,scope.tenantId),
     eq(serviceRequest.type,type),eq(serviceRequest.reason,reason),
     inArray(serviceRequest.status,outstanding))).limit(1);
   if(existing)return {created:false,request:existing,replayed:false};
   const [last]=await tx.select().from(serviceRequest).where(and(
     eq(serviceRequest.visitId,scope.visitId),eq(serviceRequest.type,type),
     eq(serviceRequest.reason,reason),
     gt(serviceRequest.createdAt,new Date(Date.now()-60_000))))
     .orderBy(desc(serviceRequest.createdAt)).limit(1);
   if(last)fail(429,"REQUEST_THROTTLED","Wait one minute before requesting the same service again.");
   const [created]=await tx.insert(serviceRequest).values({
     id:randomUUID(),tenantId:scope.tenantId,locationId:scope.locationId,visitId:scope.visitId,
     tableId:scope.tableId,guestSessionId:scope.sessionId,idempotencyKey:key,
     type,reason,note,splitPreference:splitPreference as string|null,
     assignedWaiterId:visit.waiterId,status:"pending",version:1
   }).returning();
   if(!created)fail(503,"REQUEST_FAILED","Could not send your request.");
   await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,
      action:"service.request_opened",details:{id:created.id,visitId:scope.visitId,
       type,reason,tableId:scope.tableId}});
   await bumpService(tx,scope);
   return {created:true,request:created,replayed:false};
 });
 res.status(result.created?201:200).json({created:result.created,replayed:result.replayed,...safe(result.request)});
}));
staffServiceRouter.get("/requests",route(async(req,res)=>{
 const scope=await staff(req,true),page=parsePage(req.query.page);
 const status=typeof req.query.status==="string"?req.query.status:"active";
 const type=typeof req.query.type==="string"?req.query.type:"all";
 const tableId=typeof req.query.tableId==="string"?field(req.query.tableId,100,"Table",1):null;
 if(!["active","pending","acknowledged","resolved","all"].includes(status)||
    !["all","bill","assistance"].includes(type))
   fail(400,"INVALID_FILTER","Invalid request filters.");
 const where=and(staffFilter(scope),
   status==="active"?inArray(serviceRequest.status,outstanding):
     status==="all"?undefined:eq(serviceRequest.status,status),
   type==="all"?undefined:eq(serviceRequest.type,type),
   tableId?eq(serviceRequest.tableId,tableId):undefined);
 const [items,totals]=await Promise.all([
   db.select({request:serviceRequest,tableLabel:diningTable.label})
     .from(serviceRequest).innerJoin(diningTable,eq(diningTable.id,serviceRequest.tableId))
     .where(where).orderBy(asc(serviceRequest.createdAt),asc(serviceRequest.id))
     .limit(10).offset((page-1)*10),
   db.select({n:count()}).from(serviceRequest).where(where)]);
 res.setHeader("Cache-Control","no-store");
 res.json({items:items.map(x=>({...safe(x.request),tableLabel:x.tableLabel,
     assignedWaiterId:x.request.assignedWaiterId,
     acknowledgedBy:x.request.acknowledgedBy,resolvedBy:x.request.resolvedBy})),
   total:totals[0]?.n??0,page,perPage:10});
}));
staffServiceRouter.get("/requests/count",route(async(req,res)=>{
 const scope=await staff(req,true);
 const [rows]=await db.select({n:count()}).from(serviceRequest)
   .where(and(staffFilter(scope),inArray(serviceRequest.status,outstanding)));
 res.setHeader("Cache-Control","no-store");res.json({active:rows?.n??0});
}));
staffServiceRouter.get("/revision",route(async(req,res)=>{
 const scope=await staff(req,true);
 const [rev]=await db.select().from(serviceRevision)
   .where(eq(serviceRevision.locationId,scope.locationId)).limit(1);
 res.setHeader("Cache-Control","no-store");res.json({version:rev?.version??0});
}));
staffServiceRouter.get("/events",route(async(req,res)=>{
 const scope=await staff(req,true);
 res.setHeader("Content-Type","text/event-stream");
 res.setHeader("Cache-Control","no-store, no-transform");res.setHeader("Connection","keep-alive");
 res.flushHeaders();let stopped=false,reading=false,last=-1;
 const poll=async()=>{if(stopped||reading)return;reading=true;
   try{
     const fresh=await staff(req,true);
     if(fresh.actorId!==scope.actorId||fresh.role!==scope.role||fresh.tenantId!==scope.tenantId||
       fresh.locationId!==scope.locationId){stopped=true;res.end();return;}
     const [row]=await db.select({version:serviceRevision.version}).from(serviceRevision)
       .where(eq(serviceRevision.locationId,scope.locationId)).limit(1);
     const next=row?.version??0;
     if(next!==last){last=next;res.write("event: service\ndata: "+JSON.stringify({version:next})+"\n\n");}
     else res.write(": keepalive\n\n");
   }catch{stopped=true;res.end();}finally{reading=false;}
 };
 const interval=setInterval(()=>void poll(),5000);
 res.on("close",()=>{stopped=true;clearInterval(interval);});
 await poll();
}));
staffServiceRouter.post("/requests/:id/:action",route(async(req,res)=>{
 const scope=await staff(req),id=field(req.params.id,100,"Request",1),action=field(req.params.action,20,"Action",1);
 if(action!=="ack"&&action!=="resolve")fail(404,"NOT_FOUND","Action unavailable.");
 const body=bodyObject(req),v=int(body.version,"Version",1,2_000_000_000);
 const note=action==="resolve"?field(body.resolutionNote??"",200,"Resolution note"):"";
 const done=await db.transaction(async tx=>{
   const first=await owned(tx,scope,id);
   await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${first.tableId}
     AND tenant_id=${scope.tenantId} FOR UPDATE`);
   await tx.execute(sql`SELECT id FROM service_requests WHERE id=${id}
     AND tenant_id=${scope.tenantId} FOR UPDATE`);
   const item=await owned(tx,scope,id);
   const [visit]=await tx.select().from(diningVisit).where(and(
     eq(diningVisit.id,item.visitId),eq(diningVisit.tenantId,scope.tenantId),
     eq(diningVisit.locationId,scope.locationId))).limit(1);
   if(!visit||visit.status!=="open")fail(409,"VISIT_CLOSED","This visit is closed.");
   if(item.version!==v)fail(409,"VERSION_CONFLICT","This request changed. Refresh.");
   if(action==="ack"&&item.status!=="pending")
     fail(409,"INVALID_TRANSITION","Only pending requests may be acknowledged.");
   if(action==="resolve"&&!outstanding.includes(item.status))
     fail(409,"INVALID_TRANSITION","Request is already resolved.");
   const now=new Date(),[updated]=await tx.update(serviceRequest).set(
     action==="ack"?{status:"acknowledged",version:v+1,acknowledgedBy:scope.actorId,
       acknowledgedAt:now,updatedAt:now}:
      {status:"resolved",version:v+1,resolvedBy:scope.actorId,resolvedAt:now,
       resolutionNote:note,updatedAt:now}
   ).where(and(eq(serviceRequest.id,id),eq(serviceRequest.version,v))).returning();
   if(!updated)fail(409,"VERSION_CONFLICT","Request changed.");
   await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,
      userId:scope.actorId,action:"service.request_"+action,
      details:{id,visitId:item.visitId,type:item.type,version:v+1}});
   await bumpService(tx,scope);
   return updated;
 });
 res.json(safe(done));
}));
