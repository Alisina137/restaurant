import {Router} from "express";
import {and,asc,count,desc,eq,ilike,inArray,isNull,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {diningTable,diningVisit,kitchenTicket,orderLine,orderRound,orderRevision,orderActivity} from "./schema";
import {bodyObject,fail,int,route} from "./menu-helpers";
import {orderScope,writeScope,kitchenScope,orderId,parseOrder,priceLines,orderChanged,readOrder} from "./order-core";
import {orderGuard} from "./finance-core";
import {createReadyAlert} from "./phase6-service";
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
   await orderGuard(tx,scope,visitId);
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
 const statuses=mode==="kitchen"?st==="preparing"?["preparing"]:st==="ready"?["ready","picked_up"]:["new"]:
   mode==="mine"?st==="ready"?["ready","picked_up"]:st==="completed"?["served"]:["new","preparing"]:
   st==="history"?["new","preparing","ready","picked_up","served"]:["new","preparing","ready","picked_up"];
 if(!statuses.length)return {items:[],total:0,page,perPage:10};
 const table=mode==="kitchen"&&typeof req.query.table==="string"?req.query.table.trim():"";
 if(table.length>60)fail(400,"INVALID_FILTER","Table search is too long.");
 // Filter BEFORE pagination/count. Never narrow only the visible ten rows in the browser.
 const safeTable=table.replace(/[\\%_]/g,(char)=>"\\"+char);
 const where=and(eq(orderRound.tenantId,scope.tenantId),eq(orderRound.locationId,scope.locationId),
   inArray(kitchenTicket.status,statuses),
   table?ilike(kitchenTicket.tableLabel,"%"+safeTable+"%"):undefined,
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

/**
 * P29: one network request for a complete kitchen page. Immutable cooking
 * snapshot lines are fetched as ONE scoped, bounded IN query, never N card
 * detail requests. Existing /kitchen and /rounds APIs stay compatible.
 */
orderRouter.get("/kitchen/cards",route(async(req,res)=>{
 const started=performance.now();
 const page=await list(req,"kitchen");
 const scope=await orderScope(req);kitchenScope(scope);
 const roundIds=page.items.map(item=>item.id);
 const detailsByRound:Record<string,{round:{orderNote:string;totalMinor:number};
  ticket:{version:number;pickupAcknowledgedAt:Date|null};lines:unknown[]}>=Object.create(null);
 for(const row of page.items)detailsByRound[row.id]={
  round:{orderNote:row.orderNote,totalMinor:row.totalMinor},
  ticket:{version:row.ticketVersion,pickupAcknowledgedAt:null},lines:[]
 };
 if(roundIds.length){
  // No customer, guest, payment or actor records enter the kitchen card payload.
  const [lines,tickets]=await Promise.all([
   db.select({roundId:orderLine.roundId,id:orderLine.id,itemNameFa:orderLine.itemNameFa,
     itemNamePs:orderLine.itemNamePs,itemNameEn:orderLine.itemNameEn,
     quantity:orderLine.quantity,note:orderLine.note,kitchenStatus:orderLine.kitchenStatus,
     modifierSnapshot:orderLine.modifierSnapshot,unitPriceMinor:orderLine.unitPriceMinor,
     lineTotalMinor:orderLine.lineTotalMinor})
    .from(orderLine).where(and(eq(orderLine.tenantId,scope.tenantId),
     eq(orderLine.locationId,scope.locationId),inArray(orderLine.roundId,roundIds)))
    .orderBy(asc(orderLine.lineIndex)),
   db.select({roundId:kitchenTicket.roundId,id:kitchenTicket.id,version:kitchenTicket.version,
     pickupAcknowledgedAt:kitchenTicket.pickupAcknowledgedAt})
    .from(kitchenTicket).where(and(eq(kitchenTicket.tenantId,scope.tenantId),
     eq(kitchenTicket.locationId,scope.locationId),inArray(kitchenTicket.roundId,roundIds)))
  ]);
  // Use the page version for actions; any mismatch disables unsafe writes.
  const ticketsByRound=new Map(tickets.map(item=>[item.roundId,item]));
  for(const row of page.items){
   const ticket=ticketsByRound.get(row.id);
   if(ticket?.id===row.ticketId)
    detailsByRound[row.id]!.ticket={
     version:ticket.version,pickupAcknowledgedAt:ticket.pickupAcknowledgedAt};
  }
  for(const line of lines)detailsByRound[line.roundId]?.lines.push(line);
 }
 const serverMs=Math.round((performance.now()-started)*10)/10;
 res.setHeader("Cache-Control","no-store");
 res.setHeader("Server-Timing","kitchen-db;dur="+serverMs);
 res.json({...page,detailsByRound,serverMs});
}));


/**
 * P30 foreground KDS observation: this is anonymous operational telemetry.
 * It is NOT a kitchen transition, waiter handoff, proof of human sight, or
 * financial mutation. One immutable first receipt per ticket, recorded using
 * the database clock and authorized tenant/location. Safe to retry after loss
 * of response (UPDATE only where NULL), unlike business workflow actions.
 */
orderRouter.post("/kitchen/display-observed",route(async(req,res)=>{
 const scope=await orderScope(req);kitchenScope(scope);
 const body=bodyObject(req);
 const candidate=body.ticketIds;
 if(!Array.isArray(candidate)||candidate.length<1||candidate.length>10||
  !candidate.every(value=>typeof value==="string"&&
   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)))
  fail(400,"INVALID_TICKETS","Provide between one and ten valid ticket IDs.");
 const ids=[...new Set(candidate as string[])];
 const changed=await db.update(kitchenTicket)
  .set({firstDisplayedAt:sql`clock_timestamp()`})
  .where(and(eq(kitchenTicket.tenantId,scope.tenantId),
   eq(kitchenTicket.locationId,scope.locationId),
   inArray(kitchenTicket.id,ids),
   inArray(kitchenTicket.status,["new","preparing","ready","picked_up"]),
   isNull(kitchenTicket.firstDisplayedAt)))
  .returning({id:kitchenTicket.id});
 res.setHeader("Cache-Control","no-store");
 res.json({accepted:changed.length,submitted:ids.length});
}));

/**
 * P30: measure first *client-reported* kitchen queue render after acceptance.
 * A ticket is sampled only if accepted inside the selected window and a KDS
 * actually reported its first foreground render. No synthetic receipt for
 * old orders, failed writes, hidden tabs, or missing hardware tests.
 * Unsampled tickets are NEVER silently treated as a fast or slow receipt.
 */
orderRouter.get("/kitchen/visibility",route(async(req,res)=>{
 const scope=await orderScope(req);kitchenScope(scope);
 const minutes=typeof req.query.minutes==="string"?Number(req.query.minutes):60;
 if(![60,180,360].includes(minutes))
  fail(400,"INVALID_FILTER","Supported observation windows: 60, 180 or 360 minutes.");
 const from=new Date(Date.now()-minutes*60_000);
 const sample=and(eq(kitchenTicket.tenantId,scope.tenantId),
  eq(kitchenTicket.locationId,scope.locationId),
  sql`${kitchenTicket.createdAt} >= ${from}`);
 const observedCondition=sql`${kitchenTicket.firstDisplayedAt} IS NOT NULL`;
 const duration=sql`greatest(0,extract(epoch from
  (${kitchenTicket.firstDisplayedAt} - ${kitchenTicket.createdAt})))`;
 const [window,unobserved]=await Promise.all([
  db.select({
   acceptedCount:count(),
   observedCount:sql<number>`count(*) filter (where ${observedCondition})::integer`,
   displayMedianSeconds:sql<number|null>`percentile_cont(0.5) within group
    (order by ${duration}) filter (where ${observedCondition})`,
   displayP95Seconds:sql<number|null>`percentile_cont(0.95) within group
    (order by ${duration}) filter (where ${observedCondition})`
  }).from(kitchenTicket).where(sample),
  db.select({activeWithoutReceipt:count(),
   oldestWithoutReceiptAt:sql<Date|null>`min(${kitchenTicket.createdAt})`})
   .from(kitchenTicket).where(and(
    eq(kitchenTicket.tenantId,scope.tenantId),
    eq(kitchenTicket.locationId,scope.locationId),
    inArray(kitchenTicket.status,["new","preparing","ready","picked_up"]),
    isNull(kitchenTicket.firstDisplayedAt)))
 ]);
 const first=window[0],backlog=unobserved[0];
 const format=(value:number|null|undefined)=>
  value===null||value===undefined||!Number.isFinite(Number(value))?
   null:Math.round(Number(value)*10)/10;
 res.setHeader("Cache-Control","no-store");
 res.json({
  minutes,from,checkedAt:new Date(),
  acceptedCount:first?.acceptedCount??0,
  observedCount:Number(first?.observedCount??0),
  displayMedianSeconds:format(first?.displayMedianSeconds),
  displayP95Seconds:format(first?.displayP95Seconds),
  activeWithoutReceipt:backlog?.activeWithoutReceipt??0,
  oldestWithoutReceiptAt:backlog?.oldestWithoutReceiptAt??null,
  evidence:"foreground_client_report"
 });
}));
/**
 * P29: operational pulse, actual recorded event timestamps only.
 * No invented targets or synthetic sample durations; percentiles are null
 * if no tickets were completed within the service window.
 */
orderRouter.get("/kitchen/pulse",route(async(req,res)=>{
 const scope=await orderScope(req);kitchenScope(scope);
 const raw=typeof req.query.minutes==="string"?Number(req.query.minutes):60;
 if(![60,180,360].includes(raw))
  fail(400,"INVALID_FILTER","Supported service windows: 60, 180 or 360 minutes.");
 const from=new Date(Date.now()-raw*60_000);
 const completed=and(eq(kitchenTicket.tenantId,scope.tenantId),
  eq(kitchenTicket.locationId,scope.locationId),sql`${kitchenTicket.readyAt} >= ${from}`);
 const [samples,backlog]=await Promise.all([
  db.select({
   completed:count(),
   prepMedianMinutes:sql<number|null>`percentile_cont(0.5) within group
    (order by extract(epoch from (${kitchenTicket.readyAt} - ${kitchenTicket.createdAt}))/60)`,
   prepP95Minutes:sql<number|null>`percentile_cont(0.95) within group
    (order by extract(epoch from (${kitchenTicket.readyAt} - ${kitchenTicket.createdAt}))/60)`
  }).from(kitchenTicket).where(completed),
  db.select({
   pendingReceipt:count(),
   oldestPendingReceiptAt:sql<Date|null>`min(${kitchenTicket.pickedUpAt})`
  }).from(kitchenTicket).where(and(
   eq(kitchenTicket.tenantId,scope.tenantId),eq(kitchenTicket.locationId,scope.locationId),
   eq(kitchenTicket.status,"picked_up"),
   sql`${kitchenTicket.pickupAcknowledgedAt} IS NULL`))
 ]);
 const row=samples[0],pending=backlog[0];
 const format=(value:number|null|undefined)=>
  value===null||value===undefined||!Number.isFinite(Number(value))?
   null:Math.round(Number(value)*10)/10;
 res.setHeader("Cache-Control","no-store");
 res.json({minutes:raw,from,checkedAt:new Date(),
  completed:row?.completed??0,prepMedianMinutes:format(row?.prepMedianMinutes),
  prepP95Minutes:format(row?.prepP95Minutes),
  pendingReceipt:pending?.pendingReceipt??0,
  oldestPendingReceiptAt:pending?.oldestPendingReceiptAt??null});
}));
// P27 display summary is calculated across the full scoped queue, never just the current page.
orderRouter.get("/kitchen/overview",route(async(req,res)=>{
 const scope=await orderScope(req);kitchenScope(scope);
 const rows=await db.select({
  status:kitchenTicket.status,
  total:count(),
  oldestAt:sql<Date|null>`min(${kitchenTicket.createdAt})`,
  over15m:sql<number>`count(*) filter (where ${kitchenTicket.createdAt} < now() - interval '15 minutes')::integer`
 }).from(kitchenTicket)
  .where(and(eq(kitchenTicket.tenantId,scope.tenantId),
   eq(kitchenTicket.locationId,scope.locationId),
   inArray(kitchenTicket.status,["new","preparing","ready","picked_up"])))
  .groupBy(kitchenTicket.status);
 const byStatus=(status:string)=>rows.find(r=>r.status===status);
 const value=(status:string)=>byStatus(status)?.total??0;
 const ready=value("ready")+value("picked_up");
 const waiting15m=rows.reduce((sum,row)=>sum+Number(row.over15m??0),0);
 res.setHeader("Cache-Control","no-store");
 res.json({new:value("new"),preparing:value("preparing"),ready,
  waiting15m,oldestNewAt:byStatus("new")?.oldestAt??null,
  oldestPreparingAt:byStatus("preparing")?.oldestAt??null,
  oldestReadyAt:[byStatus("ready")?.oldestAt,byStatus("picked_up")?.oldestAt]
   .filter((value):value is Date=>value instanceof Date)
   .sort((a,b)=>a.getTime()-b.getTime())[0]??null,
  checkedAt:new Date().toISOString()});
}));
orderRouter.get("/my/stats",route(async(req,res)=>{
 const scope=await orderScope(req,false);
 if(scope.role!=="waiter")fail(403,"ACCESS_DENIED","Waiter role required.");
 const [rows]=await Promise.all([db.select({status:kitchenTicket.status}).from(kitchenTicket)
   .innerJoin(diningVisit,eq(diningVisit.id,kitchenTicket.visitId))
   .where(and(eq(kitchenTicket.tenantId,scope.tenantId),eq(kitchenTicket.locationId,scope.locationId),
     eq(diningVisit.waiterId,scope.actorId))).limit(1000)]);
 res.json({active:rows.filter(r=>r.status==="new"||r.status==="preparing").length,
   ready:rows.filter(r=>r.status==="ready"||r.status==="picked_up").length,
   served:rows.filter(r=>r.status==="served").length});
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
   // Item states and ticket states move atomically. Partial line readiness can
   // be recorded through the dedicated P06 kitchen endpoint.
   await tx.update(orderLine).set(next==="preparing"?{kitchenStatus:"preparing"}:
     {kitchenStatus:"ready",readyAt:new Date()})
     .where(and(eq(orderLine.roundId,ticket.roundId),eq(orderLine.tenantId,scope.tenantId),
       inArray(orderLine.kitchenStatus,["new","preparing"])));
   if(next==="ready")await createReadyAlert(tx,scope,ticket);
   await orderChanged(tx,scope,ticket.roundId,next==="ready"?"kitchen.ready":"kitchen.preparing",
     {ticketId:id,from:ticket.status,to:next});
 });
 res.json({saved:true});
}));
