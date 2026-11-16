import {Router} from "express";
import {and,asc,count,desc,eq,inArray,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {diningTable,diningVisit,kitchenTicket,orderLine,orderRound,orderRevision,orderActivity} from "./schema";
import {bodyObject,fail,int,route} from "./menu-helpers";
import {orderScope,writeScope,kitchenScope,orderId,parseOrder,priceLines,orderChanged,readOrder} from "./order-core";
export const orderRouter=Router();

// Put static routes before /rounds/:id to avoid ambiguous routing.
orderRouter.get("/revision",route(async(req,res)=>{
 const scope=await orderScope(req);
 const [row]=await db.select({version:orderRevision.version,changedAt:orderRevision.changedAt})
   .from(orderRevision).where(eq(orderRevision.locationId,scope.locationId)).limit(1);
 res.setHeader("Cache-Control","no-store");
 res.json(row??{version:0,changedAt:null});
}));
orderRouter.get("/events",route(async(req,res)=>{
 const scope=await orderScope(req);
 res.status(200).setHeader("Content-Type","text/event-stream");
 res.setHeader("Cache-Control","no-cache, no-transform");
 res.setHeader("Connection","keep-alive");
 res.flushHeaders();
 let closed=false,busy=false,last=-1;
 const tick=async()=>{
   if(closed||busy)return;busy=true;
   try{
     const current=await orderScope(req);
     if(current.tenantId!==scope.tenantId||current.locationId!==scope.locationId||current.role!==scope.role){
       closed=true;res.end();return;
     }
     const [rev]=await db.select({version:orderRevision.version,changedAt:orderRevision.changedAt})
       .from(orderRevision).where(eq(orderRevision.locationId,scope.locationId)).limit(1);
     const state=rev??{version:0,changedAt:null};
     if(state.version!==last){last=state.version;res.write("event: orders\ndata: "+JSON.stringify(state)+"\n\n");}
     else res.write(": keepalive\n\n");
   }catch{closed=true;res.end();}
   finally{busy=false;}
 };
 const timer=setInterval(()=>{void tick();},4000);
 res.on("close",()=>{closed=true;clearInterval(timer);});
 await tick();
}));
orderRouter.post("/visits/:id/rounds",route(async(req,res)=>{
 const scope=await orderScope(req,false);writeScope(scope);
 const visitId=orderId(req),input=parseOrder(bodyObject(req));
 // A previously committed round is always safe to replay, including if the visit has now closed.
 const [prior]=await db.select().from(orderRound).where(and(eq(orderRound.tenantId,scope.tenantId),
   eq(orderRound.submittedBy,scope.actorId),eq(orderRound.idempotencyKey,input.idempotencyKey))).limit(1);
 if(prior){
   if(prior.visitId!==visitId||prior.requestHash!==input.hash)
     fail(409,"IDEMPOTENCY_CONFLICT","This submission key belongs to a different cart.");
   res.status(200).json({created:false,...await readOrder(scope,prior.id)});return;
 }
 const created=await db.transaction(async tx=>{
   // Visit's table lock provides one serial commit boundary for changes, seating and order rounds.
   const [target]=await tx.select({tableId:diningVisit.tableId}).from(diningVisit)
     .where(and(eq(diningVisit.id,visitId),eq(diningVisit.tenantId,scope.tenantId),
       eq(diningVisit.locationId,scope.locationId))).limit(1);
   if(!target)fail(404,"NOT_FOUND","Visit not found.");
   await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${target.tableId} AND tenant_id=${scope.tenantId} FOR UPDATE`);
   const [already]=await tx.select().from(orderRound).where(and(eq(orderRound.tenantId,scope.tenantId),
     eq(orderRound.submittedBy,scope.actorId),eq(orderRound.idempotencyKey,input.idempotencyKey))).limit(1);
   if(already){
     if(already.visitId!==visitId||already.requestHash!==input.hash)
       fail(409,"IDEMPOTENCY_CONFLICT","This submission key is already used with a different cart.");
     return {id:already.id,created:false};
   }
   const [visit]=await tx.select().from(diningVisit).where(and(eq(diningVisit.id,visitId),
     eq(diningVisit.tenantId,scope.tenantId),eq(diningVisit.locationId,scope.locationId))).limit(1);
   if(!visit||visit.status!=="open")fail(409,"VISIT_LOCKED","Visit was closed. Reload the table.");
   if(scope.role==="waiter"&&visit.waiterId!==scope.actorId)
     fail(403,"NOT_ASSIGNED","Another waiter manages this visit.");
   const [table]=await tx.select().from(diningTable).where(and(eq(diningTable.id,visit.tableId),
     eq(diningTable.tenantId,scope.tenantId),eq(diningTable.locationId,scope.locationId))).limit(1);
   if(!table||table.archivedAt||!table.active||table.cleaning)
     fail(409,"TABLE_UNAVAILABLE","Table is no longer active.");
   const {lines,subtotal}=await priceLines(tx,scope,input.lines);
   const [existingCount]=await tx.select({n:count()}).from(orderRound)
     .where(eq(orderRound.visitId,visitId));
   const nextNumber=(existingCount?.n??0)+1,roundId=randomUUID(),ticketId=randomUUID();
   await tx.insert(orderRound).values({id:roundId,tenantId:scope.tenantId,locationId:scope.locationId,
     visitId,tableId:table.id,roundNumber:nextNumber,submittedBy:scope.actorId,
     idempotencyKey:input.idempotencyKey,requestHash:input.hash,source:"waiter",status:"accepted",
     currency:"AFN",subtotalMinor:subtotal,taxMinor:0,serviceMinor:0,totalMinor:subtotal,orderNote:input.note});
   for(let i=0;i<lines.length;i++)await tx.insert(orderLine).values({id:randomUUID(),
     tenantId:scope.tenantId,locationId:scope.locationId,roundId,lineIndex:i,...lines[i]!});
   await tx.insert(kitchenTicket).values({id:ticketId,tenantId:scope.tenantId,locationId:scope.locationId,
     roundId,visitId,tableId:table.id,tableLabel:table.label,status:"new",version:1});
   await orderChanged(tx,scope,roundId,"order.accepted",{visitId,tableId:table.id,ticketId,roundNumber:nextNumber,
     lines:lines.length,totalMinor:subtotal});
   return {id:roundId,created:true};
 });
 res.status(created.created?201:200).json({created:created.created,...await readOrder(scope,created.id)});
}));
orderRouter.get("/visits/:id/rounds",route(async(req,res)=>{
 const scope=await orderScope(req),visitId=orderId(req);
 const [visit]=await db.select().from(diningVisit).where(and(eq(diningVisit.id,visitId),
   eq(diningVisit.tenantId,scope.tenantId),eq(diningVisit.locationId,scope.locationId))).limit(1);
 if(!visit)fail(404,"NOT_FOUND","Visit not found.");
 if(scope.role==="waiter"&&visit.waiterId!==scope.actorId)
   fail(403,"NOT_ASSIGNED","Visit is assigned to another waiter.");
 const rounds=await db.select({id:orderRound.id,roundNumber:orderRound.roundNumber,visitId:orderRound.visitId,
   tableId:orderRound.tableId,totalMinor:orderRound.totalMinor,orderNote:orderRound.orderNote,
   createdAt:orderRound.createdAt,status:kitchenTicket.status,
   ticketId:kitchenTicket.id}).from(orderRound)
   .innerJoin(kitchenTicket,eq(kitchenTicket.roundId,orderRound.id))
   .where(and(eq(orderRound.visitId,visitId),eq(orderRound.tenantId,scope.tenantId)))
   .orderBy(asc(orderRound.roundNumber)).limit(100);
 const amount=rounds.reduce((n,r)=>n+r.totalMinor,0);
 res.setHeader("Cache-Control","no-store");
 res.json({rounds,estimateMinor:amount,currency:"AFN",unsettled:rounds.length>0});
}));
async function list(req:import("express").Request,mode:"mine"|"management"|"kitchen"){
 const scope=await orderScope(req);
 if(mode==="kitchen")kitchenScope(scope);
 if(mode==="management"&&!["owner","manager"].includes(scope.role))
   fail(403,"ACCESS_DENIED","Management access required.");
 if(mode==="mine"&&scope.role!=="waiter")fail(403,"ACCESS_DENIED","Waiter orders only.");
 const rawPage=typeof req.query.page==="string"?Number(req.query.page):1;
 const page=Number.isSafeInteger(rawPage)&&rawPage>0?Math.min(rawPage,100000):1;
 const st=typeof req.query.status==="string"?req.query.status:"active";
 const statuses=mode==="kitchen"?st==="preparing"?["preparing"]:st==="ready"?["ready"]:["new"]:
   mode==="mine"?st==="ready"?["ready"]:st==="completed"?[]:["new","preparing"]:
   st==="history"?["new","preparing","ready"]:["new","preparing","ready"];
 if(!statuses.length)return {items:[],total:0,page,perPage:10};
 const where=and(eq(orderRound.tenantId,scope.tenantId),eq(orderRound.locationId,scope.locationId),
   inArray(kitchenTicket.status,statuses),
   mode==="mine"?eq(diningVisit.waiterId,scope.actorId):undefined);
 const [items,totals]=await Promise.all([
  db.select({id:orderRound.id,roundNumber:orderRound.roundNumber,visitId:orderRound.visitId,
    tableId:orderRound.tableId,tableLabel:kitchenTicket.tableLabel,
    totalMinor:orderRound.totalMinor,orderNote:orderRound.orderNote,
    createdAt:orderRound.createdAt,status:kitchenTicket.status,ticketId:kitchenTicket.id,
    ticketVersion:kitchenTicket.version,startedAt:kitchenTicket.startedAt,readyAt:kitchenTicket.readyAt,
    submittedBy:orderRound.submittedBy}).from(orderRound)
    .innerJoin(kitchenTicket,eq(kitchenTicket.roundId,orderRound.id))
    .innerJoin(diningVisit,eq(diningVisit.id,orderRound.visitId))
    .where(where).orderBy(asc(orderRound.createdAt)).limit(10).offset((page-1)*10),
  db.select({n:count()}).from(orderRound).innerJoin(kitchenTicket,eq(kitchenTicket.roundId,orderRound.id))
    .innerJoin(diningVisit,eq(diningVisit.id,orderRound.visitId)).where(where)
 ]);
 return {items,total:totals[0]?.n??0,page,perPage:10};
}
orderRouter.get("/my",route(async(req,res)=>{res.setHeader("Cache-Control","no-store");res.json(await list(req,"mine"));}));
orderRouter.get("/management",route(async(req,res)=>{res.setHeader("Cache-Control","no-store");res.json(await list(req,"management"));}));
orderRouter.get("/kitchen",route(async(req,res)=>{res.setHeader("Cache-Control","no-store");res.json(await list(req,"kitchen"));}));
orderRouter.get("/my/stats",route(async(req,res)=>{
 const scope=await orderScope(req,false);
 if(scope.role!=="waiter")fail(403,"ACCESS_DENIED","Waiter role required.");
 const [rows]=await Promise.all([db.select({status:kitchenTicket.status}).from(kitchenTicket)
   .innerJoin(diningVisit,eq(diningVisit.id,kitchenTicket.visitId))
   .where(and(eq(kitchenTicket.tenantId,scope.tenantId),eq(kitchenTicket.locationId,scope.locationId),
     eq(diningVisit.waiterId,scope.actorId))).limit(1000)]);
 res.json({active:rows.filter(r=>r.status==="new"||r.status==="preparing").length,
   ready:rows.filter(r=>r.status==="ready").length});
}));
orderRouter.get("/rounds/:id",route(async(req,res)=>{
 const scope=await orderScope(req);
 res.setHeader("Cache-Control","no-store");
 res.json(await readOrder(scope,orderId(req)));
}));
orderRouter.post("/tickets/:id/transition",route(async(req,res)=>{
 const scope=await orderScope(req);kitchenScope(scope);
 const id=orderId(req),body=bodyObject(req),
  v=int(body.version,"Ticket version",1,2_000_000_000);
 const next=body.nextStatus;
 if(next!=="preparing"&&next!=="ready")fail(400,"INVALID_TRANSITION","Expected preparing or ready.");
 await db.transaction(async tx=>{
   await tx.execute(sql`SELECT id FROM kitchen_tickets WHERE id=${id} AND tenant_id=${scope.tenantId} FOR UPDATE`);
   const [ticket]=await tx.select().from(kitchenTicket).where(and(eq(kitchenTicket.id,id),
     eq(kitchenTicket.tenantId,scope.tenantId),eq(kitchenTicket.locationId,scope.locationId))).limit(1);
   if(!ticket)fail(404,"NOT_FOUND","Ticket not found.");
   if(ticket.version!==v)fail(409,"VERSION_CONFLICT","Ticket changed in another kitchen session. Refresh.");
   if(!((ticket.status==="new"&&next==="preparing")||(ticket.status==="preparing"&&next==="ready")))
     fail(409,"INVALID_TRANSITION","Ticket cannot skip or reverse preparation stages.");
   const [done]=await tx.update(kitchenTicket).set({status:next,version:v+1,updatedAt:new Date(),
      ...(next==="preparing"?{startedAt:new Date()}:{readyAt:new Date()})})
     .where(and(eq(kitchenTicket.id,id),eq(kitchenTicket.tenantId,scope.tenantId),
       eq(kitchenTicket.locationId,scope.locationId),eq(kitchenTicket.version,v))).returning({id:kitchenTicket.id});
   if(!done)fail(409,"VERSION_CONFLICT","Ticket was updated. Refresh.");
   await orderChanged(tx,scope,ticket.roundId,next==="ready"?"kitchen.ready":"kitchen.preparing",
     {ticketId:id,from:ticket.status,to:next});
 });
 res.json({saved:true});
}));
