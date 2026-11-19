import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq,isNull} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P29 performance test needs a seeded disposable nonproduction PostgreSQL database.");
const base=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(base+path,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
  ...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(reply:Response,status:number):Promise<T>{
 const json=await reply.json() as T;assert.equal(reply.status,status,JSON.stringify(json));
 return json;
}
async function login(email:string){
 for(let attempt=0;attempt<7;attempt++){
  const r=await request("/api/auth/sign-in/email","POST",{email,password});
  if(r.status===429){await new Promise(done=>setTimeout(done,11_000));continue;}
  assert.equal(r.status,200,email+": "+await r.text());
  return r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw Error("P29 fixture login remained rate-limited");
}
type Line={id:string;itemNameFa:string;itemNameEn:string;itemNamePs:string;
 note:string;quantity:number;kitchenStatus:string;modifierSnapshot:unknown[]};
type CardPage={items:{id:string;ticketId:string;ticketVersion:number;tableLabel:string}[];
 detailsByRound:Record<string,{round:{orderNote:string;totalMinor:number};
  ticket:{version:number;pickupAcknowledgedAt:string|null};lines:Line[]}>;
 serverMs:number;total:number;page:number;perPage:number};
type Pulse={minutes:number;from:string;checkedAt:string;completed:number;
 prepMedianMinutes:number|null;prepP95Minutes:number|null;pendingReceipt:number;
 oldestPendingReceiptAt:string|null};
async function main(){
 const [owner,kitchen,waiter,cashier,other]=await Promise.all([
  login("owner-ci@example.test"),login("kitchen-ci@example.test"),
  login("waiter-ci@example.test"),login("cashier-ci@example.test"),
  login("new-owner-ci@example.test")]);
 for(const endpoint of ["/api/orders/kitchen/cards","/api/orders/kitchen/pulse"]){
  assert.equal((await request(endpoint)).status,401,endpoint+" anonymous");
  assert.equal((await request(endpoint,"GET",undefined,waiter)).status,403,endpoint+" waiter");
  assert.equal((await request(endpoint,"GET",undefined,cashier)).status,403,endpoint+" cashier");
 }
 for(const value of [0,15,180.5,9999]){
  assert.equal((await request("/api/orders/kitchen/pulse?minutes="+value,"GET",undefined,kitchen)).status,400);
 }
 const before=await expect<Pulse>(await request("/api/orders/kitchen/pulse?minutes=60",
  "GET",undefined,kitchen),200);
 assert.equal(before.minutes,60);
 const [section]=await db.select({id:diningSection.id}).from(diningSection)
  .where(and(eq(diningSection.tenantId,"dev-restaurant"),eq(diningSection.active,true),
   isNull(diningSection.archivedAt))).limit(1);
 const [actor]=await db.select({id:user.id}).from(user)
  .where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(section&&actor,"P29 requires active section and assigned waiter");
 const suffix=randomUUID().slice(0,8),label="P29"+suffix;
 const table=await expect<{id:string}>(await request("/api/floor/tables","POST",{
  sectionId:section.id,label,seats:3,sortOrder:82,notes:"P29 kitchen performance",
  active:true,assignedWaiterId:actor.id},owner),201);
 const opened=await expect<{visit:{id:string}}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),201);
 const category=await expect<{id:string}>(await request("/api/menu/categories","POST",{
  nameFa:"غذا "+suffix,namePs:"خواړه "+suffix,nameEn:"P29 "+suffix,
  description:"",sortOrder:77,published:true},owner),201);
 const item=await expect<{id:string}>(await request("/api/menu/items","POST",{
  categoryId:category.id,nameFa:"غذای آشپزخانه",namePs:"د پخلنځي خواړه",nameEn:"Kitchen Meal",
  description:"",sku:"P29-"+suffix,priceMinor:15600,imageId:null,
  allergens:[],preparationMinutes:6,sortOrder:0,published:true,groupIds:[]
 },owner),201);
 const catalog=await expect<{items:{id:string;version:number}[]}>(
  await request("/api/menu/catalog","GET",undefined,waiter),200);
 const dish=catalog.items.find(i=>i.id===item.id);
 assert.ok(dish,"P29 published menu item absent");
 // P37: use a five-line cart to exercise a single batched INSERT. Each
 // line keeps its original note, quantity, price and immutable line ordering.
 const payload={
  idempotencyKey:"p29_"+randomUUID().replaceAll("-",""),note:"Serve warm",
  lines:Array.from({length:5},(_,i)=>({
   itemId:item.id,itemVersion:dish.version,quantity:i+1,
   note:"Kitchen line "+(i+1),selections:[]
  }))
 };
 const round=await expect<{round:{id:string;totalMinor:number};ticket:{id:string;version:number}}>(
  await request("/api/orders/visits/"+opened.visit.id+"/rounds","POST",payload,waiter),201);
 assert.equal(round.round.totalMinor,15600*15);
 // Idempotency retry must not insert a second set of lines or a second ticket.
 const replay=await expect<{created:boolean;round:{id:string;totalMinor:number}}>(
  await request("/api/orders/visits/"+opened.visit.id+"/rounds","POST",payload,waiter),200);
 assert.equal(replay.created,false);
 assert.equal(replay.round.id,round.round.id);
 assert.equal(replay.round.totalMinor,round.round.totalMinor);
 const path="/api/orders/kitchen/cards?status=new&table="+encodeURIComponent(label)+"&page=1";
 const response=await request(path,"GET",undefined,kitchen);
 assert.equal(response.status,200);
 assert.match(response.headers.get("cache-control")??"",/no-store/);
 assert.match(response.headers.get("server-timing")??"",/kitchen-db/);
 const cards=await expect<CardPage>(await request(path,"GET",undefined,kitchen),200);
 assert.equal(cards.total,1);assert.equal(cards.page,1);assert.equal(cards.perPage,10);
 assert.ok(Number.isFinite(cards.serverMs)&&cards.serverMs>=0);
 assert.equal(cards.items.length,1);assert.equal(cards.items[0]!.ticketId,round.ticket.id);
 const card=cards.detailsByRound[round.round.id];
 assert.ok(card,"Bounded card payload must include all item lines on same page");
 assert.equal(card.round.orderNote,"Serve warm");assert.equal(card.ticket.version,1);
 assert.equal(card.lines.length,5);
 assert.deepEqual(card.lines.map(x=>x.quantity),[1,2,3,4,5]);
 assert.deepEqual(card.lines.map(x=>x.note),["Kitchen line 1","Kitchen line 2",
  "Kitchen line 3","Kitchen line 4","Kitchen line 5"]);
 assert.ok(card.lines.every(x=>x.itemNameEn==="Kitchen Meal"&&x.kitchenStatus==="new"));
 assert.ok(!("activity" in card)&&!("submittedBy" in card),
  "Kitchen card payload must omit audit and staff private fields");
 const absent=await expect<CardPage>(await request(
  "/api/orders/kitchen/cards?status=new&table=nope-p29-xxxyyy","GET",undefined,kitchen),200);
 assert.equal(absent.total,0);assert.equal(Object.keys(absent.detailsByRound).length,0);
 const otherCards=await expect<CardPage>(await request(path,"GET",undefined,other),200);
 assert.equal(otherCards.total,0,"Cross-restaurant cards may never leak");
 const ownerCards=await expect<CardPage>(await request(path,"GET",undefined,owner),200);
 assert.equal(ownerCards.total,1);
 const prep=await expect<{saved:boolean}>(await request(
  "/api/orders/tickets/"+round.ticket.id+"/transition","POST",
  {version:1,nextStatus:"preparing"},kitchen),200);
 assert.equal(prep.saved,true);
 const ready=await expect<{saved:boolean}>(await request(
  "/api/orders/tickets/"+round.ticket.id+"/transition","POST",
  {version:2,nextStatus:"ready"},kitchen),200);
 assert.equal(ready.saved,true);
 const live=await expect<CardPage>(await request(
  "/api/orders/kitchen/cards?status=ready&table="+encodeURIComponent(label),
  "GET",undefined,kitchen),200);
 assert.equal(live.total,1);assert.equal(live.detailsByRound[round.round.id]?.ticket.version,3);
 assert.equal(live.detailsByRound[round.round.id]?.lines[0]?.kitchenStatus,"ready");
 const after=await expect<Pulse>(await request("/api/orders/kitchen/pulse?minutes=60",
  "GET",undefined,kitchen),200);
 assert.equal(after.minutes,60);
 assert.ok(after.completed>=before.completed+1);
 assert.ok(after.prepMedianMinutes!==null&&after.prepMedianMinutes>=0);
 assert.ok(after.prepP95Minutes!==null&&after.prepP95Minutes>=after.prepMedianMinutes);
 assert.ok(Number.isSafeInteger(after.pendingReceipt)&&after.pendingReceipt>=0);
 const handoff=await expect<{status:string}>(await request(
  "/api/orders/tickets/"+round.ticket.id+"/handoff","POST",{version:3},kitchen),200);
 assert.equal(handoff.status,"picked_up");
 const waiting=await expect<Pulse>(await request("/api/orders/kitchen/pulse?minutes=60",
  "GET",undefined,kitchen),200);
 assert.ok(waiting.pendingReceipt>=after.pendingReceipt+1);
 const ack=await expect<{acknowledged:boolean}>(await request(
  "/api/orders/tickets/"+round.ticket.id+"/pickup-ack","POST",{version:4},waiter),200);
 assert.ok(ack.acknowledged);
 const acknowledged=await expect<Pulse>(await request("/api/orders/kitchen/pulse?minutes=60",
  "GET",undefined,kitchen),200);
 assert.equal(acknowledged.pendingReceipt,waiting.pendingReceipt-1);
 const updatedCards=await expect<CardPage>(await request(
  "/api/orders/kitchen/cards?status=ready&table="+encodeURIComponent(label),
  "GET",undefined,kitchen),200);
 const updatedCard=updatedCards.detailsByRound[round.round.id];
 assert.ok(updatedCard?.ticket.pickupAcknowledgedAt,
  "P37: pickup acknowledgement must appear in kitchen cards without a redundant ticket query");
 assert.equal(updatedCard.lines.length,5,"Original batched line snapshots remain intact");

 const testPages=await Promise.all(Array.from({length:12},()=>request(
  "/api/orders/kitchen/cards?status=ready&page=1","GET",undefined,kitchen)));
 assert.ok(testPages.every(r=>r.status===200),"Kitchen card payload should tolerate concurrent readers");
 console.info("PASS P29 live: scoped compact snapshots, no-stale line states, role isolation, recorded prep percentiles and acknowledged pickup counters.");
}
main().then(async()=>{await pool.end();}).catch(async err=>{
 console.error(err);await pool.end();process.exitCode=1;
});
