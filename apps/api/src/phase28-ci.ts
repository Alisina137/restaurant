import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq,count,isNull} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,kitchenTicket,orderActivity,orderOutbox,staffNotification,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P28 integration is only allowed with a seeded disposable nonproduction database.");
const base=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(base+path,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
  ...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(reply:Response,status:number):Promise<T>{
 const body=await reply.json() as T;
 assert.equal(reply.status,status,JSON.stringify(body));
 return body;
}
async function login(email:string){
 for(let attempt=0;attempt<7;attempt++){
  const r=await request("/api/auth/sign-in/email","POST",{email,password});
  if(r.status===429){await new Promise(resolve=>setTimeout(resolve,11_000));continue;}
  assert.equal(r.status,200,email+": "+await r.text());
  return r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw new Error("P28 CI fixture login remained throttled");
}
type State={ticketId:string;roundId:string;status:string;version:number;tableLabel:string;
 pickupAcknowledgedAt:string|null;waiterAlertExists:boolean;waiterSeenAt:string|null;
 items:{total:number;ready:number;pickedUp:number;served:number}};
type Watermark={cursor:number;revision:number;checkedAt:string};
type Changes={events:{cursor:number;eventType:string;roundId:string}[];
 nextCursor:number;hasMore:boolean};
async function main(){
 const [owner,kitchen,waiter,cashier,other]=await Promise.all([
  login("owner-ci@example.test"),login("kitchen-ci@example.test"),
  login("waiter-ci@example.test"),login("cashier-ci@example.test"),
  login("new-owner-ci@example.test")]);
 const [section]=await db.select({id:diningSection.id})
  .from(diningSection).where(and(eq(diningSection.tenantId,"dev-restaurant"),
   eq(diningSection.active,true),isNull(diningSection.archivedAt))).limit(1);
 const [actor]=await db.select({id:user.id}).from(user)
  .where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(section&&actor,"P28 requires seeded section and waiter");
 assert.equal((await request("/api/orders/kitchen/watermark")).status,401);
 assert.equal((await request("/api/orders/kitchen/watermark","GET",undefined,waiter)).status,403);
 assert.equal((await request("/api/orders/kitchen/watermark","GET",undefined,cashier)).status,403);
 const first=await request("/api/orders/kitchen/watermark","GET",undefined,kitchen);
 assert.match(first.headers.get("cache-control")??"",/no-store/);
 const before=await expect<Watermark>(first,200);
 assert.ok(Number.isSafeInteger(before.cursor)&&before.cursor>=0);
 assert.ok(Number.isSafeInteger(before.revision)&&before.revision>=0);
 const suffix=randomUUID().slice(0,8);
 const tableName="K28"+suffix;
 const table=await expect<{id:string}>(await request("/api/floor/tables","POST",{
  sectionId:section.id,label:tableName,seats:4,sortOrder:90,notes:"P28 concurrent kitchen workflow fixture",
  active:true,assignedWaiterId:actor.id},owner),201);
 const visit=await expect<{visit:{id:string}}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),201);
 const category=await expect<{id:string}>(await request("/api/menu/categories","POST",{
  nameFa:"غذای آزمایشی "+suffix,namePs:"ازموینې خواړه "+suffix,
  nameEn:"P28 Kitchen "+suffix,description:"",sortOrder:85,published:true
 },owner),201);
 const menuItem=await expect<{id:string}>(await request("/api/menu/items","POST",{
  categoryId:category.id,nameFa:"نمونه آماده‌سازی",namePs:"د پخلي بېلګه",
  nameEn:"P28 Meal",description:"Kitchen concurrency fixture",sku:"P28-"+suffix,
  priceMinor:18200,imageId:null,allergens:[],preparationMinutes:8,sortOrder:0,
  published:true,groupIds:[]
 },owner),201);
 const catalog=await expect<{items:{id:string;version:number}[]}>(
  await request("/api/menu/catalog","GET",undefined,waiter),200);
 const dish=catalog.items.find(i=>i.id===menuItem.id);
 assert.ok(dish,"Created test meal must appear on real waiter catalog");
 const payload=()=>({idempotencyKey:"p28_"+randomUUID().replaceAll("-",""),
  note:"Ticket concurrency fixture",
  lines:[{itemId:dish.id,itemVersion:dish.version,quantity:2,
   note:"Cook carefully",selections:[]}]});
 const rounds=await Promise.all(Array.from({length:12},()=>request(
  "/api/orders/visits/"+visit.visit.id+"/rounds","POST",payload(),waiter)));
 const accepted=await Promise.all(rounds.map(r=>expect<{
  created:boolean;round:{id:string;roundNumber:number};
  ticket:{id:string;version:number;status:string}
 }>(r,201)));
 assert.ok(accepted.every(x=>x.created),"All 12 submitted carts were actually accepted");
 assert.equal(new Set(accepted.map(x=>x.round.id)).size,12);
 assert.deepEqual(accepted.map(x=>x.round.roundNumber).sort((a,b)=>a-b),
  Array.from({length:12},(_,i)=>i+1),"Single visit's numbered rounds must be distinct under concurrency");
 const list=async(page:number)=>expect<{items:{ticketId:string;roundNumber:number}[];
  page:number;perPage:number;total:number}>(await request(
  "/api/orders/kitchen?status=new&table="+encodeURIComponent(tableName)+"&page="+page,
  "GET",undefined,kitchen),200);
 const [a,b]=await Promise.all([list(1),list(2)]);
 assert.equal(a.total,12);assert.equal(b.total,12);
 assert.equal(a.items.length,10);assert.equal(b.items.length,2);
 assert.equal(new Set([...a.items,...b.items].map(x=>x.ticketId)).size,12);
 const changes=await expect<Changes>(await request(
  "/api/orders/changes?after="+before.cursor,"GET",undefined,kitchen),200);
 const ids=new Set(accepted.map(x=>x.round.id));
 const ordered=changes.events.filter(x=>ids.has(x.roundId)&&x.eventType==="order.accepted");
 assert.equal(ordered.length,12,"No accepted rounds may be skipped in cursor replay");
 assert.ok(ordered.every((x,i,all)=>i===0||x.cursor>all[i-1]!.cursor));
 assert.ok(changes.nextCursor>before.cursor);
 const firstTicket=accepted[0]!.ticket.id,roundId=accepted[0]!.round.id;
 const statePath="/api/orders/kitchen/tickets/"+firstTicket+"/state";
 assert.equal((await request(statePath,"GET",undefined,waiter)).status,403);
 assert.equal((await request(statePath,"GET",undefined,cashier)).status,403);
 assert.equal((await request(statePath,"GET",undefined,other)).status,404);
 const initial=await expect<State>(await request(statePath,"GET",undefined,kitchen),200);
 assert.equal(initial.version,1);assert.equal(initial.status,"new");
 assert.equal(initial.items.total,1);
 const prep=await Promise.all(Array.from({length:8},()=>request(
  "/api/orders/tickets/"+firstTicket+"/transition","POST",{version:1,nextStatus:"preparing"},kitchen)));
 assert.equal(prep.filter(r=>r.status===200).length,1,"Exactly one preparing transition under 8 simultaneous writers");
 assert.ok(prep.filter(r=>r.status!==200).every(r=>r.status===409));
 const prepping=await expect<State>(await request(statePath,"GET",undefined,owner),200);
 assert.equal(prepping.status,"preparing");assert.equal(prepping.version,2);
 const detail=await expect<{lines:{id:string}[]}>(
  await request("/api/orders/rounds/"+roundId,"GET",undefined,kitchen),200);
 assert.equal(detail.lines.length,1);
 const lineId=detail.lines[0]!.id;
 const ready=await Promise.all(Array.from({length:8},()=>request(
  "/api/orders/tickets/"+firstTicket+"/lines/"+lineId+"/ready","POST",{version:2},kitchen)));
 assert.equal(ready.filter(r=>r.status===200).length,1);
 assert.ok(ready.filter(r=>r.status!==200).every(r=>r.status===409));
 const readyState=await expect<State>(await request(statePath,"GET",undefined,kitchen),200);
 assert.equal(readyState.status,"ready");assert.equal(readyState.version,3);
 assert.equal(readyState.items.ready,1);assert.equal(readyState.waiterAlertExists,true);
 assert.equal((await request("/api/orders/tickets/"+firstTicket+"/pickup-ack",
  "POST",{version:3},waiter)).status,409,"Waiter cannot acknowledge before kitchen handoff");
 const handed=await expect<{status:string;version:number}>(await request(
  "/api/orders/tickets/"+firstTicket+"/handoff","POST",{version:3},kitchen),200);
 assert.equal(handed.status,"picked_up");assert.equal(handed.version,4);
 const beforeAck=await expect<State>(await request(statePath,"GET",undefined,kitchen),200);
 assert.equal(beforeAck.pickupAcknowledgedAt,null,"Kitchen handoff alone is NOT waiter receipt");
 assert.equal((await request("/api/orders/tickets/"+firstTicket+"/pickup-ack",
  "POST",{version:4},kitchen)).status,403);
 assert.equal((await request("/api/orders/tickets/"+firstTicket+"/pickup-ack",
  "POST",{version:4},owner)).status,403);
 assert.equal((await request("/api/orders/tickets/"+firstTicket+"/pickup-ack",
  "POST",{version:4},cashier)).status,403);
 const pickupPath="/api/orders/tickets/"+firstTicket+"/pickup-ack";
 const [receipt1,receipt2]=await Promise.all([
  request(pickupPath,"POST",{version:4},waiter),
  request(pickupPath,"POST",{version:4},waiter)]);
 assert.deepEqual([receipt1.status,receipt2.status].sort(),[200,200],
  "Competing waiter acknowledgment retries are idempotent and never duplicate events");
 const receipts=await Promise.all([receipt1,receipt2].map(async r=>r.json() as Promise<{
  acknowledged:boolean;already:boolean;version:number}>));
 assert.equal(receipts.filter(r=>!r.already).length,1);
 assert.ok(receipts.every(r=>r.acknowledged&&r.version===5));
 const receiptState=await expect<State>(await request(statePath,"GET",undefined,kitchen),200);
 assert.ok(receiptState.pickupAcknowledgedAt);assert.equal(receiptState.version,5);
 const [ackEvents]=await db.select({n:count()}).from(orderActivity)
  .where(and(eq(orderActivity.roundId,roundId),eq(orderActivity.action,"waiter.pickup_acknowledged")));
 assert.equal(ackEvents?.n,1,"Exactly one durable acknowledgment event");
 const [notices]=await db.select({n:count()}).from(staffNotification)
  .where(eq(staffNotification.roundId,roundId));
 assert.equal(notices?.n,1,"Kitchen readiness sends only one durable waiter alert");
 // A reminder and a waiter serve may race after receipt; only one version=5
 // mutation is accepted. Waiter service never becomes a kitchen-only action.
 await db.update(kitchenTicket).set({lastNotifiedAt:new Date(Date.now()-110_000)})
  .where(eq(kitchenTicket.id,firstTicket));
 const [serving,reminding]=await Promise.all([
  request("/api/orders/rounds/"+roundId+"/serve","POST",{version:5},waiter),
  request("/api/orders/tickets/"+firstTicket+"/notify","POST",{version:5},kitchen)]);
 assert.deepEqual([serving.status,reminding.status].sort(),[200,409],
  "Concurrent kitchen reminder and waiter serve cannot both commit the same version");
 if(reminding.status===200){
  const afterReminder=await expect<State>(await request(statePath,"GET",undefined,kitchen),200);
  assert.equal(afterReminder.version,6);
  const served=await expect<{complete:boolean}>(await request(
   "/api/orders/rounds/"+roundId+"/serve","POST",{version:6},waiter),200);
  assert.equal(served.complete,true);
 }
 const finalState=await expect<State>(await request(statePath,"GET",undefined,kitchen),200);
 assert.equal(finalState.status,"served");
 assert.ok(finalState.pickupAcknowledgedAt);
 assert.equal(finalState.items.served,1);
 const after=await expect<Watermark>(await request(
  "/api/orders/kitchen/watermark","GET",undefined,kitchen),200);
 assert.ok(after.cursor>before.cursor);
 assert.ok(after.revision>before.revision);
 const afterOwner=await expect<Watermark>(await request(
  "/api/orders/kitchen/watermark","GET",undefined,owner),200);
 assert.equal(afterOwner.cursor,after.cursor);
 assert.equal((await request("/api/orders/kitchen/watermark","GET",undefined,other)).status,200);
 const [writes]=await db.select({n:count()}).from(orderOutbox)
  .where(and(eq(orderOutbox.roundId,roundId),
   eq(orderOutbox.eventType,"waiter.pickup_acknowledged")));
 assert.equal(writes?.n,1,"Cursor replay contains a single waiter receipt event");
 console.info("PASS P28 HTTP: 12 parallel tickets, paged backlog, ordered replay, 8-way version conflicts, handoff, idempotent waiter receipt, real serving.");
}
main().then(async()=>{await pool.end();}).catch(async err=>{
 console.error(err);await pool.end();process.exitCode=1;
});
