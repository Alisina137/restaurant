import {Router} from "express";
import {and,asc,desc,eq,gt,gte,inArray,isNull,lt,lte,ne,count,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {diningVisit,kitchenTicket,orderLine,orderOutbox,orderRound,staffNotification,orderActivity,restaurantSetting} from "./schema";
import {bodyObject,fail,int,route,field} from "./menu-helpers";
import {kitchenScope,orderChanged,orderId,orderScope,type OrderScope} from "./order-core";

export const serviceRouter=Router();
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
const scopedTicket=(scope:OrderScope,id:string)=>and(eq(kitchenTicket.id,id),eq(kitchenTicket.tenantId,scope.tenantId),
 eq(kitchenTicket.locationId,scope.locationId));
async function lockedTicket(tx:Tx,scope:OrderScope,id:string){
 await tx.execute(sql`SELECT id FROM kitchen_tickets WHERE id=${id} AND tenant_id=${scope.tenantId}
   AND location_id=${scope.locationId} FOR UPDATE`);
 const [ticket]=await tx.select().from(kitchenTicket).where(scopedTicket(scope,id)).limit(1);
 if(!ticket)fail(404,"NOT_FOUND","Kitchen ticket not found.");
 return ticket;
}
async function assignedVisit(tx:Tx,scope:OrderScope,visitId:string){
 const [visit]=await tx.select().from(diningVisit)
   .where(and(eq(diningVisit.id,visitId),eq(diningVisit.tenantId,scope.tenantId),
     eq(diningVisit.locationId,scope.locationId))).limit(1);
 if(!visit)fail(404,"NOT_FOUND","Visit not found.");
 if(scope.role==="waiter"&&visit.waiterId!==scope.actorId)
   fail(403,"NOT_ASSIGNED","This visit belongs to another waiter.");
 return visit;
}
export async function createReadyAlert(tx:Tx,scope:OrderScope,
 ticket:{id:string;roundId:string;visitId:string;tenantId:string;locationId:string},now=new Date()){
 const [visit]=await tx.select({waiterId:diningVisit.waiterId}).from(diningVisit)
   .where(and(eq(diningVisit.id,ticket.visitId),eq(diningVisit.tenantId,scope.tenantId),
     eq(diningVisit.locationId,scope.locationId))).limit(1);
 if(!visit)fail(409,"VISIT_UNAVAILABLE","Visit unavailable for ready alert.");
 await tx.insert(staffNotification).values({
   id:randomUUID(),tenantId:scope.tenantId,locationId:scope.locationId,
   recipientId:visit.waiterId,visitId:ticket.visitId,roundId:ticket.roundId,ticketId:ticket.id,
   type:"ticket_ready",lastNotifiedAt:now,notifyCount:1
 }).onConflictDoNothing();
 await tx.update(kitchenTicket).set({lastNotifiedAt:now,notifyCount:1})
   .where(scopedTicket(scope,ticket.id));
}
serviceRouter.post("/tickets/:id/lines/:lineId/ready",route(async(req,res)=>{
 const scope=await orderScope(req);kitchenScope(scope);
 const ticketId=orderId(req),lineId=field(req.params.lineId,100,"Line ID",1),
  v=int(bodyObject(req).version,"Ticket version",1,2_000_000_000);
 const result=await db.transaction(async tx=>{
   const ticket=await lockedTicket(tx,scope,ticketId);
   if(ticket.version!==v)fail(409,"VERSION_CONFLICT","Another kitchen device updated this ticket.");
   if(ticket.status!=="preparing")fail(409,"INVALID_TRANSITION","Start preparing first.");
   const [line]=await tx.select().from(orderLine)
     .where(and(eq(orderLine.id,lineId),eq(orderLine.roundId,ticket.roundId),
       eq(orderLine.tenantId,scope.tenantId),eq(orderLine.locationId,scope.locationId))).limit(1);
   if(!line)fail(404,"NOT_FOUND","Ticket line not found.");
   if(!["new","preparing"].includes(line.kitchenStatus))
     fail(409,"INVALID_TRANSITION","This item was already marked ready.");
   const now=new Date();
   await tx.update(orderLine).set({kitchenStatus:"ready",readyAt:now}).where(eq(orderLine.id,lineId));
   const remaining=await tx.select({id:orderLine.id}).from(orderLine)
     .where(and(eq(orderLine.roundId,ticket.roundId),eq(orderLine.tenantId,scope.tenantId),
       ne(orderLine.kitchenStatus,"ready"))).limit(1);
   const done=!remaining.length;
   await tx.update(kitchenTicket).set({status:done?"ready":"preparing",version:v+1,
     ...(done?{readyAt:now}:{}),updatedAt:now}).where(scopedTicket(scope,ticketId));
   await orderChanged(tx,scope,ticket.roundId,"kitchen.line_ready",
     {ticketId,lineId,readyCountIncrement:1,allReady:done});
   if(done){
     await createReadyAlert(tx,scope,ticket,now);
     await orderChanged(tx,scope,ticket.roundId,"kitchen.ready",{ticketId,from:"preparing",to:"ready"});
   }
   return {ready:done,version:v+1};
 });
 res.json(result);
}));
serviceRouter.post("/tickets/:id/handoff",route(async(req,res)=>{
 const scope=await orderScope(req);kitchenScope(scope);
 const id=orderId(req),v=int(bodyObject(req).version,"Ticket version",1,2_000_000_000);
 const result=await db.transaction(async tx=>{
   const ticket=await lockedTicket(tx,scope,id);
   if(ticket.version!==v)fail(409,"VERSION_CONFLICT","This ticket changed on another kitchen device.");
   if(ticket.status!=="ready")fail(409,"INVALID_TRANSITION","Only ready food may be handed off.");
   const now=new Date();
   await tx.update(kitchenTicket).set({status:"picked_up",version:v+1,pickedUpAt:now,
     pickedUpBy:scope.actorId,updatedAt:now}).where(scopedTicket(scope,id));
   await tx.update(orderLine).set({kitchenStatus:"picked_up",pickedUpAt:now})
     .where(and(eq(orderLine.roundId,ticket.roundId),eq(orderLine.tenantId,scope.tenantId),
       eq(orderLine.kitchenStatus,"ready")));
   await orderChanged(tx,scope,ticket.roundId,"kitchen.handed_off",{ticketId:id,visitId:ticket.visitId});
   return {status:"picked_up",version:v+1};
 });
 res.json(result);
}));
async function serve(scope:OrderScope,roundId:string,lineId:string|null,v:number){
 if(!["owner","manager","waiter"].includes(scope.role))
   fail(403,"ACCESS_DENIED","Only waiter or management can mark food served.");
 return db.transaction(async tx=>{
   const [round]=await tx.select({id:orderRound.id,visitId:orderRound.visitId})
     .from(orderRound).where(and(eq(orderRound.id,roundId),eq(orderRound.tenantId,scope.tenantId),
       eq(orderRound.locationId,scope.locationId))).limit(1);
   if(!round)fail(404,"NOT_FOUND","Order not found.");
   // Ticket lock serializes kitchen pickup and competing waiter serving requests.
   const [ticketId]=await tx.select({id:kitchenTicket.id}).from(kitchenTicket)
     .where(and(eq(kitchenTicket.roundId,roundId),eq(kitchenTicket.tenantId,scope.tenantId),
       eq(kitchenTicket.locationId,scope.locationId))).limit(1);
   if(!ticketId)fail(404,"NOT_FOUND","Ticket not found.");
   const ticket=await lockedTicket(tx,scope,ticketId.id);
   if(ticket.version!==v)fail(409,"VERSION_CONFLICT","Ticket changed. Reload before serving.");
   const visit=await assignedVisit(tx,scope,round.visitId);
   if(visit.status!=="open")fail(409,"VISIT_LOCKED","Cannot serve a closed visit.");
   if(!["ready","picked_up"].includes(ticket.status))
     fail(409,"NOT_READY","Food is not ready to serve.");
   const now=new Date();
   const where=and(eq(orderLine.roundId,roundId),eq(orderLine.tenantId,scope.tenantId),
     eq(orderLine.locationId,scope.locationId),
     inArray(orderLine.kitchenStatus,["ready","picked_up"]));
   if(lineId){
     const [line]=await tx.select({id:orderLine.id}).from(orderLine)
       .where(and(where,eq(orderLine.id,lineId))).limit(1);
     if(!line)fail(409,"NOT_READY","Requested line is unavailable or already served.");
     await tx.update(orderLine).set({kitchenStatus:"served",servedAt:now,servedBy:scope.actorId})
       .where(and(where,eq(orderLine.id,lineId)));
   }else{
     const unfinished=await tx.select({id:orderLine.id,kitchenStatus:orderLine.kitchenStatus})
       .from(orderLine).where(and(eq(orderLine.roundId,roundId),eq(orderLine.tenantId,scope.tenantId),
         ne(orderLine.kitchenStatus,"served")));
     if(!unfinished.length||unfinished.some(l=>!["ready","picked_up"].includes(l.kitchenStatus)))
       fail(409,"NOT_READY","Not all items are ready or some have already been served.");
     await tx.update(orderLine).set({kitchenStatus:"served",servedAt:now,servedBy:scope.actorId})
       .where(where);
   }
   const [remaining]=await tx.select({id:orderLine.id}).from(orderLine)
     .where(and(eq(orderLine.roundId,roundId),eq(orderLine.tenantId,scope.tenantId),
       ne(orderLine.kitchenStatus,"served"))).limit(1);
   const finished=!remaining;
   await tx.update(kitchenTicket).set({status:finished?"served":ticket.status,
     version:v+1,...(finished?{servedAt:now,servedBy:scope.actorId}:{}),updatedAt:now})
     .where(scopedTicket(scope,ticket.id));
   await orderChanged(tx,scope,roundId,finished?"waiter.round_served":"waiter.line_served",
     {ticketId:ticket.id,visitId:round.visitId,...(lineId?{lineId}:{})});
   if(finished)await tx.update(staffNotification).set({readAt:now})
     .where(and(eq(staffNotification.roundId,roundId),eq(staffNotification.tenantId,scope.tenantId),
       isNull(staffNotification.readAt)));
   return {status:finished?"served":ticket.status,version:v+1,complete:finished};
 });
}
serviceRouter.post("/rounds/:id/serve",route(async(req,res)=>{
 const scope=await orderScope(req),id=orderId(req),v=int(bodyObject(req).version,"Ticket version",1,2_000_000_000);
 res.json(await serve(scope,id,null,v));
}));
serviceRouter.post("/rounds/:id/lines/:lineId/serve",route(async(req,res)=>{
 const scope=await orderScope(req),id=orderId(req),lineId=field(req.params.lineId,100,"Line ID",1),
   v=int(bodyObject(req).version,"Ticket version",1,2_000_000_000);
 res.json(await serve(scope,id,lineId,v));
}));
serviceRouter.post("/tickets/:id/notify",route(async(req,res)=>{
 const scope=await orderScope(req);kitchenScope(scope);
 const id=orderId(req),v=int(bodyObject(req).version,"Ticket version",1,2_000_000_000);
 const answer=await db.transaction(async tx=>{
   const ticket=await lockedTicket(tx,scope,id);
   if(ticket.version!==v)fail(409,"VERSION_CONFLICT","Ticket changed on another device.");
   if(!["ready","picked_up"].includes(ticket.status))
     fail(409,"INVALID_TRANSITION","Only ready food can trigger reminder alerts.");
   const now=new Date();
   if(ticket.lastNotifiedAt&&now.getTime()-ticket.lastNotifiedAt.getTime()<90_000)
     fail(429,"NOTIFICATION_THROTTLED","Wait 90 seconds before notifying again.");
   if(ticket.notifyCount>=30)fail(429,"NOTIFICATION_THROTTLED","Maximum reminders reached.");
   const [visit]=await tx.select({waiterId:diningVisit.waiterId}).from(diningVisit)
     .where(and(eq(diningVisit.id,ticket.visitId),eq(diningVisit.tenantId,scope.tenantId))).limit(1);
   if(!visit)fail(409,"VISIT_UNAVAILABLE","Visit unavailable.");
   await tx.insert(staffNotification).values({id:randomUUID(),tenantId:scope.tenantId,
     locationId:scope.locationId,recipientId:visit.waiterId,visitId:ticket.visitId,
     roundId:ticket.roundId,ticketId:id,type:"ticket_ready",lastNotifiedAt:now,notifyCount:1})
     .onConflictDoUpdate({target:[staffNotification.recipientId,staffNotification.roundId,staffNotification.type],
       set:{readAt:null,lastNotifiedAt:now,notifyCount:sql`${staffNotification.notifyCount} + 1`}});
   await tx.update(kitchenTicket).set({lastNotifiedAt:now,notifyCount:ticket.notifyCount+1,
     version:v+1,updatedAt:now}).where(scopedTicket(scope,id));
   await orderChanged(tx,scope,ticket.roundId,"kitchen.notify_again",{ticketId:id,
     recipientId:visit.waiterId,attempt:ticket.notifyCount+1});
   return {notified:true,version:v+1};
 });
 res.json(answer);
}));
function waiterOnly(scope:OrderScope){
 if(scope.role!=="waiter")fail(403,"ACCESS_DENIED","Waiter account required.");
}
const notificationScope=(scope:OrderScope)=>and(eq(staffNotification.tenantId,scope.tenantId),
 eq(staffNotification.locationId,scope.locationId),eq(staffNotification.recipientId,scope.actorId),
 eq(diningVisit.waiterId,scope.actorId));
serviceRouter.get("/notifications",route(async(req,res)=>{
 const scope=await orderScope(req);waiterOnly(scope);
 const pageRaw=typeof req.query.page==="string"?Number(req.query.page):1;
 const page=Number.isSafeInteger(pageRaw)&&pageRaw>=1?Math.min(pageRaw,10000):1;
 const unread=req.query.unread==="1";
 const where=and(notificationScope(scope),unread?isNull(staffNotification.readAt):undefined);
 const [items,totals,unreadTotal]=await Promise.all([
   db.select({id:staffNotification.id,type:staffNotification.type,roundId:staffNotification.roundId,
     ticketId:staffNotification.ticketId,visitId:staffNotification.visitId,readAt:staffNotification.readAt,
     createdAt:staffNotification.createdAt,lastNotifiedAt:staffNotification.lastNotifiedAt,
     tableLabel:kitchenTicket.tableLabel,tableId:kitchenTicket.tableId,
     status:kitchenTicket.status})
     .from(staffNotification).innerJoin(diningVisit,eq(staffNotification.visitId,diningVisit.id))
     .innerJoin(kitchenTicket,eq(kitchenTicket.id,staffNotification.ticketId))
     .where(where).orderBy(desc(staffNotification.lastNotifiedAt))
     .limit(20).offset((page-1)*20),
   db.select({total:count()}).from(staffNotification)
     .innerJoin(diningVisit,eq(staffNotification.visitId,diningVisit.id)).where(where),
   db.select({total:count()}).from(staffNotification)
     .innerJoin(diningVisit,eq(staffNotification.visitId,diningVisit.id))
     .where(and(notificationScope(scope),isNull(staffNotification.readAt)))
 ]);
 res.setHeader("Cache-Control","no-store");
 res.json({items,total:totals[0]?.total??0,unread:unreadTotal[0]?.total??0,page,perPage:20});
}));
serviceRouter.post("/notifications/:id/read",route(async(req,res)=>{
 const scope=await orderScope(req);waiterOnly(scope);
 const id=orderId(req);
 const [allowed]=await db.select({id:staffNotification.id}).from(staffNotification)
   .innerJoin(diningVisit,eq(staffNotification.visitId,diningVisit.id))
   .where(and(notificationScope(scope),eq(staffNotification.id,id))).limit(1);
 if(!allowed)fail(404,"NOT_FOUND","Notification unavailable.");
 await db.update(staffNotification).set({readAt:new Date()})
   .where(and(eq(staffNotification.id,id),eq(staffNotification.recipientId,scope.actorId),
     isNull(staffNotification.readAt)));
 res.json({read:true});
}));
serviceRouter.get("/changes",route(async(req,res)=>{
 const scope=await orderScope(req);
 const raw=typeof req.query.after==="string"?Number(req.query.after):0;
 if(!Number.isSafeInteger(raw)||raw<0||raw>Number.MAX_SAFE_INTEGER)
   fail(400,"INVALID_CURSOR","Cursor must be a nonnegative integer.");
 const where=and(eq(orderOutbox.tenantId,scope.tenantId),eq(orderOutbox.locationId,scope.locationId),
   gt(orderOutbox.seq,raw),scope.role==="waiter"?eq(diningVisit.waiterId,scope.actorId):undefined);
 const rows=await db.select({cursor:orderOutbox.seq,eventType:orderOutbox.eventType,
   roundId:orderOutbox.roundId,createdAt:orderOutbox.createdAt,payload:orderOutbox.payload})
   .from(orderOutbox).innerJoin(orderRound,eq(orderRound.id,orderOutbox.roundId))
   .innerJoin(diningVisit,eq(diningVisit.id,orderRound.visitId))
   .where(where).orderBy(asc(orderOutbox.seq)).limit(51);
 const items=rows.slice(0,50);
 res.setHeader("Cache-Control","no-store");
 res.json({events:items,nextCursor:items.at(-1)?.cursor??raw,hasMore:rows.length>50});
}));
serviceRouter.get("/kitchen/history",route(async(req,res)=>{
 const scope=await orderScope(req);kitchenScope(scope);
 const pageRaw=typeof req.query.page==="string"?Number(req.query.page):1;
 const page=Number.isSafeInteger(pageRaw)&&pageRaw>=1?Math.min(pageRaw,10000):1;
 const status=typeof req.query.status==="string"?req.query.status:"all";
 const valid=["all","new","preparing","ready","picked_up","served","voided"];
 if(!valid.includes(status))fail(400,"INVALID_FILTER","Unsupported history status.");
 const table=typeof req.query.table==="string"?field(req.query.table,100,"Table",1):"";
 const start=typeof req.query.from==="string"?req.query.from:"";
 const end=typeof req.query.to==="string"?req.query.to:"";
 const parseDate=(value:string)=>{
   if(!/^\d{4}-\d{2}-\d{2}$/.test(value))fail(400,"INVALID_DATE","Use YYYY-MM-DD format.");
   const date=new Date(value+"T00:00:00.000Z");
   if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)
     fail(400,"INVALID_DATE","Invalid calendar date.");
   return value;
 };
 const after=start?parseDate(start):undefined;
 const before=end?parseDate(end):undefined;
 if(after&&before&&after>before)fail(400,"INVALID_RANGE","End must not precede start date.");
 const [setting]=await db.select({timezone:restaurantSetting.timezone}).from(restaurantSetting)
   .where(eq(restaurantSetting.tenantId,scope.tenantId)).limit(1);
 const timezone=setting?.timezone??"Asia/Kabul";
 // The physical business day follows the restaurant's configured IANA time zone.
 // UTC timestamps are never reinterpreted by the client's device locale.
 const businessDate=sql`(${kitchenTicket.createdAt} AT TIME ZONE ${timezone})::date`;
 const where=and(eq(kitchenTicket.tenantId,scope.tenantId),eq(kitchenTicket.locationId,scope.locationId),
   status!=="all"?eq(kitchenTicket.status,status):undefined,
   table?eq(kitchenTicket.tableId,table):undefined,
   after?sql`${businessDate} >= ${after}::date`:undefined,
   before?sql`${businessDate} <= ${before}::date`:undefined);
 const [items,totals]=await Promise.all([
   db.select({id:kitchenTicket.id,roundId:kitchenTicket.roundId,visitId:kitchenTicket.visitId,
     tableId:kitchenTicket.tableId,tableLabel:kitchenTicket.tableLabel,
     status:kitchenTicket.status,version:kitchenTicket.version,
     createdAt:kitchenTicket.createdAt,startedAt:kitchenTicket.startedAt,
     readyAt:kitchenTicket.readyAt,pickedUpAt:kitchenTicket.pickedUpAt,servedAt:kitchenTicket.servedAt,
     totalMinor:orderRound.totalMinor,roundNumber:orderRound.roundNumber,source:orderRound.source})
     .from(kitchenTicket).innerJoin(orderRound,eq(kitchenTicket.roundId,orderRound.id))
     .where(where).orderBy(desc(kitchenTicket.createdAt)).limit(20).offset((page-1)*20),
   db.select({total:count()}).from(kitchenTicket).where(where)
 ]);
 res.setHeader("Cache-Control","no-store");
 res.json({items,total:totals[0]?.total??0,page,perPage:20,timezone});
}));
