import {Router} from "express";
import {and,asc,count,desc,eq,isNull,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {auditEvent,diningTable,diningVisit,guestRevision,guestSubmission,guestVisitPin,
 guestVisitSession,restaurantSetting,tableQr,tenant,tenantMembership} from "./schema";
import {bodyObject,fail,field,int,route} from "./menu-helpers";
import {floorScope,isManager,type FloorScope} from "./floor-helpers";
import {acceptGuest} from "./guest-orders";
import {bumpGuest,ensurePin,entryURL,invalidateVisitSessions,makeQr,pinFor} from "./guest-security";

export const guestStaffRouter=Router();
async function visitFor(scope:FloorScope,visitId:string){
 const [visit]=await db.select().from(diningVisit).where(and(eq(diningVisit.id,visitId),
   eq(diningVisit.tenantId,scope.tenantId),eq(diningVisit.locationId,scope.locationId),
   eq(diningVisit.status,"open"))).limit(1);
 if(!visit)fail(404,"NOT_FOUND","Active visit not found.");
 if(scope.role==="waiter"&&visit.waiterId!==scope.actorId)
   fail(403,"NOT_ASSIGNED","This table is assigned to another waiter.");
 return visit;
}
guestStaffRouter.get("/qrs",route(async(req,res)=>{
 const scope=await floorScope(req,true);
 const [restaurant]=await db.select({slug:tenant.slug,name:tenant.name}).from(tenant)
   .where(eq(tenant.id,scope.tenantId)).limit(1);
 if(!restaurant)fail(404,"NOT_FOUND","Restaurant not found.");
 const rows=await db.select({id:diningTable.id,label:diningTable.label,active:diningTable.active,
   qr:tableQr.code,qrVersion:tableQr.version,qrUpdated:tableQr.updatedAt,
   visitId:diningVisit.id,waiterId:diningTable.assignedWaiterId}).from(diningTable)
   .leftJoin(tableQr,eq(tableQr.tableId,diningTable.id))
   .leftJoin(diningVisit,and(eq(diningVisit.tableId,diningTable.id),eq(diningVisit.status,"open")))
   .where(and(eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId),
     isNull(diningTable.archivedAt))).orderBy(asc(diningTable.label)).limit(1000);
 res.setHeader("Cache-Control","no-store");
 res.json({restaurant:restaurant.name,slug:restaurant.slug,items:rows.map(row=>({
   ...row,url:row.qr?entryURL(restaurant.slug,row.qr):null
 }))});
}));
guestStaffRouter.post("/qrs/:id",route(async(req,res)=>{
 const scope=await floorScope(req,true),id=field(req.params.id,100,"Table",1);
 const answer=await db.transaction(async tx=>{
   await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${id} AND tenant_id=${scope.tenantId} FOR UPDATE`);
   const [table]=await tx.select().from(diningTable).where(and(eq(diningTable.id,id),
     eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId))).limit(1);
   if(!table||table.archivedAt||!table.active)fail(404,"TABLE_UNAVAILABLE","Table must be active.");
   const [existing]=await tx.select().from(tableQr).where(eq(tableQr.tableId,id)).limit(1);
   if(existing)return {row:existing,created:false};
   const [qr]=await tx.insert(tableQr).values({tableId:id,tenantId:scope.tenantId,
     locationId:scope.locationId,code:makeQr(),issuedBy:scope.actorId,version:1}).returning();
   if(!qr)fail(503,"QR_UNAVAILABLE","Unable to create table QR.");
   await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,
     userId:scope.actorId,action:"guest.qr_issued",details:{tableId:id,version:1}});
   return {row:qr,created:true};
 });
 const [tenantRow]=await db.select({slug:tenant.slug}).from(tenant).where(eq(tenant.id,scope.tenantId)).limit(1);
 res.status(answer.created?201:200).json({id,version:answer.row.version,code:answer.row.code,
   url:entryURL(tenantRow?.slug??"",answer.row.code),created:answer.created});
}));
guestStaffRouter.post("/qrs/:id/rotate",route(async(req,res)=>{
 const scope=await floorScope(req,true),id=field(req.params.id,100,"Table",1),
   version=int(bodyObject(req).version,"Version",1,2_000_000_000);
 const row=await db.transaction(async tx=>{
   await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${id} AND tenant_id=${scope.tenantId} FOR UPDATE`);
   const [table]=await tx.select().from(diningTable).where(and(eq(diningTable.id,id),
     eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId))).limit(1);
   if(!table||table.archivedAt||!table.active)fail(404,"TABLE_UNAVAILABLE","Table must be active.");
   const [qr]=await tx.select().from(tableQr).where(and(eq(tableQr.tableId,id),
     eq(tableQr.tenantId,scope.tenantId))).limit(1);
   if(!qr)fail(404,"QR_MISSING","Create a table QR first.");
   if(qr.version!==version)fail(409,"VERSION_CONFLICT","QR changed elsewhere. Reload.");
   const [updated]=await tx.update(tableQr).set({code:makeQr(),version:version+1,
     issuedBy:scope.actorId,updatedAt:new Date()}).where(eq(tableQr.tableId,id)).returning();
   const [visit]=await tx.select({id:diningVisit.id}).from(diningVisit)
     .where(and(eq(diningVisit.tableId,id),eq(diningVisit.status,"open"))).limit(1);
   if(visit)await invalidateVisitSessions(tx,visit.id,scope,"Table QR regenerated. Verify the new code.");
   await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,
     userId:scope.actorId,action:"guest.qr_rotated",details:{tableId:id,version:version+1}});
   return updated!;
 });
 const [tenantRow]=await db.select({slug:tenant.slug}).from(tenant).where(eq(tenant.id,scope.tenantId)).limit(1);
 res.json({id,version:row.version,code:row.code,url:entryURL(tenantRow?.slug??"",row.code)});
}));
guestStaffRouter.get("/visits/:id/pin",route(async(req,res)=>{
 const scope=await floorScope(req),visitId=field(req.params.id,100,"Visit",1);
 const visit=await visitFor(scope,visitId);
 const state=await db.transaction(tx=>ensurePin(tx,visit));
 const [table]=await db.select({label:diningTable.label}).from(diningTable).where(
   eq(diningTable.id,visit.tableId)).limit(1);
 res.setHeader("Cache-Control","no-store");
 res.json({visitId,tableId:visit.tableId,tableLabel:table?.label??"—",
   pin:pinFor(visit.id,state.generation),version:state.generation,rotatedAt:state.rotatedAt});
}));
guestStaffRouter.post("/visits/:id/pin/rotate",route(async(req,res)=>{
 const scope=await floorScope(req),visitId=field(req.params.id,100,"Visit",1),
  version=int(bodyObject(req).version,"PIN version",1,2_000_000_000);
 const result=await db.transaction(async tx=>{
   const visit=await visitFor(scope,visitId);
   await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${visit.tableId}
     AND tenant_id=${scope.tenantId} FOR UPDATE`);
   const pin=await ensurePin(tx,visit);
   if(pin.generation!==version)fail(409,"VERSION_CONFLICT","Visit PIN changed. Reload.");
   const now=new Date();
   await tx.update(guestVisitPin).set({generation:version+1,rotatedAt:now})
     .where(eq(guestVisitPin.visitId,visitId));
   await invalidateVisitSessions(tx,visitId,scope,"Visit PIN was changed. Ask waiter for new PIN.");
   await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,
     userId:scope.actorId,action:"guest.pin_rotated",details:{visitId,newGeneration:version+1}});
   return {pin:pinFor(visitId,version+1),version:version+1,rotatedAt:now};
 });
 res.json(result);
}));
guestStaffRouter.get("/policy",route(async(req,res)=>{
 const scope=await floorScope(req,true);
 const [row]=await db.select().from(restaurantSetting)
   .where(eq(restaurantSetting.tenantId,scope.tenantId)).limit(1);
 if(!row)fail(409,"SETTINGS_MISSING","Restaurant settings unavailable.");
 res.setHeader("Cache-Control","no-store");
 res.json({policy:row.orderingPolicy,version:row.guestPolicyVersion});
}));
guestStaffRouter.patch("/policy",route(async(req,res)=>{
 const scope=await floorScope(req,true),body=bodyObject(req),
  version=int(body.version,"Policy version",1,2_000_000_000);
 const policy=body.policy;
 if(policy!=="waiter_approval"&&policy!=="direct_to_kitchen")
   fail(400,"INVALID_POLICY","Select waiter approval or direct to kitchen.");
 const changed=await db.transaction(async tx=>{
   const [saved]=await tx.update(restaurantSetting).set({orderingPolicy:policy,
     guestPolicyVersion:version+1,updatedAt:new Date()})
   .where(and(eq(restaurantSetting.tenantId,scope.tenantId),
     eq(restaurantSetting.guestPolicyVersion,version))).returning();
   if(!saved)fail(409,"VERSION_CONFLICT","Ordering rules changed elsewhere. Reload.");
   await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,
     userId:scope.actorId,action:"guest.ordering_policy_updated",
     details:{policy,version:version+1}});
   await bumpGuest(tx,scope);
   return saved;
 });
 res.json({policy:changed.orderingPolicy,version:changed.guestPolicyVersion});
}));
const pendingScope=(scope:FloorScope)=>and(eq(guestSubmission.tenantId,scope.tenantId),
 eq(guestSubmission.locationId,scope.locationId),
 scope.role==="waiter"?eq(diningVisit.waiterId,scope.actorId):undefined);
guestStaffRouter.get("/approvals",route(async(req,res)=>{
 const scope=await floorScope(req);
 const raw=typeof req.query.page==="string"?Number(req.query.page):1;
 const page=Number.isSafeInteger(raw)&&raw>0?Math.min(raw,10000):1;
 const status=typeof req.query.status==="string"?req.query.status:"pending";
 if(!["pending","approved","rejected","all"].includes(status))
   fail(400,"INVALID_STATUS","Invalid order review status.");
 const tableId=typeof req.query.tableId==="string"?field(req.query.tableId,100,"Table ID",1):null;
 const where=and(pendingScope(scope),
   status==="all"?undefined:eq(guestSubmission.status,status),
   tableId?eq(guestSubmission.tableId,tableId):undefined);
 const [items,totals]=await Promise.all([
   db.select({id:guestSubmission.id,status:guestSubmission.status,version:guestSubmission.version,
     policy:guestSubmission.policy,orderNote:guestSubmission.orderNote,
     preview:guestSubmission.preview,estimatedMinor:guestSubmission.estimatedMinor,
     rejectionReason:guestSubmission.rejectionReason,roundId:guestSubmission.roundId,
     tableId:guestSubmission.tableId,tableLabel:diningTable.label,
     visitId:guestSubmission.visitId,createdAt:guestSubmission.createdAt,
     decidedAt:guestSubmission.decidedAt})
    .from(guestSubmission).innerJoin(diningVisit,eq(diningVisit.id,guestSubmission.visitId))
    .innerJoin(diningTable,eq(diningTable.id,guestSubmission.tableId))
    .where(where).orderBy(asc(guestSubmission.createdAt)).limit(10).offset((page-1)*10),
   db.select({n:count()}).from(guestSubmission)
    .innerJoin(diningVisit,eq(diningVisit.id,guestSubmission.visitId)).where(where)
 ]);
 res.setHeader("Cache-Control","no-store");
 res.json({items,total:totals[0]?.n??0,page,perPage:10});
}));
guestStaffRouter.get("/approvals/count",route(async(req,res)=>{
 const scope=await floorScope(req);
 const [countRow]=await db.select({n:count()}).from(guestSubmission)
  .innerJoin(diningVisit,eq(diningVisit.id,guestSubmission.visitId))
  .where(and(pendingScope(scope),eq(guestSubmission.status,"pending"),
     eq(diningVisit.status,"open")));
 res.setHeader("Cache-Control","no-store");
 res.json({pending:countRow?.n??0});
}));
guestStaffRouter.get("/approvals/:id",route(async(req,res)=>{
 const scope=await floorScope(req),id=field(req.params.id,100,"Guest order",1);
 const [row]=await db.select({order:guestSubmission,tableLabel:diningTable.label})
   .from(guestSubmission).innerJoin(diningVisit,eq(diningVisit.id,guestSubmission.visitId))
   .innerJoin(diningTable,eq(diningTable.id,guestSubmission.tableId))
   .where(and(pendingScope(scope),eq(guestSubmission.id,id))).limit(1);
 if(!row)fail(404,"NOT_FOUND","Order review unavailable.");
 res.setHeader("Cache-Control","no-store");
 res.json({...row.order,tableLabel:row.tableLabel});
}));
guestStaffRouter.post("/approvals/:id/decision",route(async(req,res)=>{
 const scope=await floorScope(req),id=field(req.params.id,100,"Guest order",1),body=bodyObject(req),
   version=int(body.version,"Version",1,2_000_000_000);
 if(body.decision!=="approve"&&body.decision!=="reject")
   fail(400,"INVALID_DECISION","Choose approve or reject.");
 const reason=body.decision==="reject"?field(body.reason,200,"Rejection reason",5):null;
 const result=await db.transaction(async tx=>{
   const [target]=await tx.select({tableId:guestSubmission.tableId})
     .from(guestSubmission).where(and(eq(guestSubmission.id,id),
       eq(guestSubmission.tenantId,scope.tenantId),eq(guestSubmission.locationId,scope.locationId))).limit(1);
   if(!target)fail(404,"NOT_FOUND","Order unavailable.");
   await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${target.tableId}
    AND tenant_id=${scope.tenantId} FOR UPDATE`);
   const [submission]=await tx.select().from(guestSubmission)
     .where(and(eq(guestSubmission.id,id),eq(guestSubmission.tenantId,scope.tenantId),
       eq(guestSubmission.locationId,scope.locationId))).limit(1);
   if(!submission)fail(404,"NOT_FOUND","Order unavailable.");
   const [visit]=await tx.select().from(diningVisit).where(and(
     eq(diningVisit.id,submission.visitId),eq(diningVisit.tenantId,scope.tenantId))).limit(1);
   if(!visit||visit.status!=="open")fail(409,"VISIT_LOCKED","Visit is closed.");
   if(scope.role==="waiter"&&visit.waiterId!==scope.actorId)
     fail(403,"NOT_ASSIGNED","This table belongs to another waiter.");
   if(submission.status!=="pending"||submission.version!==version)
     fail(409,"VERSION_CONFLICT","Another reviewer already decided. Refresh.");
   let roundId:string|null=null;
   if(body.decision==="approve"){
     const result=await acceptGuest(tx,scope,submission,scope.actorId);
     roundId=result.roundId;
   }else{
     await tx.update(guestSubmission).set({status:"rejected",version:version+1,
       rejectionReason:reason,decidedBy:scope.actorId,decidedAt:new Date()})
      .where(eq(guestSubmission.id,id));
     await bumpGuest(tx,scope);
   }
   await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,
     userId:scope.actorId,action:body.decision==="approve"?"guest.order_approved":"guest.order_rejected",
     details:{guestOrderId:id,roundId,visitId:submission.visitId,...(reason?{reason}:{})}});
   return {status:body.decision==="approve"?"approved":"rejected",roundId,version:version+1};
 });
 res.json(result);
}));
guestStaffRouter.get("/revision",route(async(req,res)=>{
 const scope=await floorScope(req);
 const [revision]=await db.select({version:guestRevision.version}).from(guestRevision)
   .where(eq(guestRevision.locationId,scope.locationId)).limit(1);
 res.setHeader("Cache-Control","no-store");res.json({version:revision?.version??0});
}));
guestStaffRouter.get("/events",route(async(req,res)=>{
 const scope=await floorScope(req);
 res.setHeader("Content-Type","text/event-stream");
 res.setHeader("Cache-Control","no-store, no-transform");res.setHeader("Connection","keep-alive");
 res.flushHeaders();let closed=false,busy=false,last=-1;
 const tick=async()=>{
   if(closed||busy)return;busy=true;
   try{
     const fresh=await floorScope(req);
     if(fresh.tenantId!==scope.tenantId||fresh.locationId!==scope.locationId||
       fresh.actorId!==scope.actorId||fresh.role!==scope.role){closed=true;res.end();return;}
     const [state]=await db.select({version:guestRevision.version}).from(guestRevision)
       .where(eq(guestRevision.locationId,scope.locationId)).limit(1);
     const version=state?.version??0;
     if(version!==last){last=version;res.write("event: approvals\ndata: "+JSON.stringify({version})+"\n\n");}
     else res.write(": keepalive\n\n");
   }catch{closed=true;res.end();}
   finally{busy=false;}
 };
 const timer=setInterval(()=>{void tick();},4000);
 res.on("close",()=>{closed=true;clearInterval(timer);});
 await tick();
}));
