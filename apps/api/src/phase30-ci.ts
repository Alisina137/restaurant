import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq,isNull} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,kitchenTicket,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw Error("P30 visibility integration must run only on a disposable seeded nonproduction DB.");
const base=process.env.E2E_API_URL??"http://localhost:4000";
const password=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(base+path,{method,
  headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
   ...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(reply:Response,status:number):Promise<T>{
 const json=await reply.json() as T;
 assert.equal(reply.status,status,JSON.stringify(json));
 return json;
}
async function login(email:string){
 for(let attempt=0;attempt<7;attempt++){
  const response=await request("/api/auth/sign-in/email","POST",{email,password});
  if(response.status===429){await new Promise(done=>setTimeout(done,11_000));continue;}
  assert.equal(response.status,200,email+": "+await response.text());
  return response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw Error("P30 CI fixture login throttled");
}
type Visibility={
 minutes:number;from:string;checkedAt:string;acceptedCount:number;observedCount:number;
 displayMedianSeconds:number|null;displayP95Seconds:number|null;
 activeWithoutReceipt:number;oldestWithoutReceiptAt:string|null;
 evidence:string;
};
type Receipt={accepted:number;submitted:number};
type Ticket={id:string;version:number;status:string};
type Round={round:{id:string};ticket:Ticket};
type Cards={total:number;items:{ticketId:string;id:string}[];
 detailsByRound:Record<string,{lines:{id:string}[];ticket:{version:number}}>} ;
type Watermark={cursor:number;revision:number};
async function main(){
 const [owner,kitchen,waiter,cashier,other]=await Promise.all([
  login("owner-ci@example.test"),login("kitchen-ci@example.test"),
  login("waiter-ci@example.test"),login("cashier-ci@example.test"),
  login("new-owner-ci@example.test")]);
 const visibility="/api/orders/kitchen/visibility?minutes=60";
 const submit="/api/orders/kitchen/display-observed";
 for(const url of [visibility,submit]){
  assert.equal((await request(url,url===submit?"POST":"GET",
   url===submit?{ticketIds:[randomUUID()]}:undefined)).status,401,url+" anonymous denied");
  assert.equal((await request(url,url===submit?"POST":"GET",
   url===submit?{ticketIds:[randomUUID()]}:undefined,waiter)).status,403,url+" waiter denied");
  assert.equal((await request(url,url===submit?"POST":"GET",
   url===submit?{ticketIds:[randomUUID()]}:undefined,cashier)).status,403,url+" cashier denied");
 }
 for(const raw of ["1","0","600","NaN","99"]){
  assert.equal((await request("/api/orders/kitchen/visibility?minutes="+raw,"GET",
   undefined,kitchen)).status,400,"Rejected unsupported window "+raw);
 }
 for(const body of [{}, {ticketIds:[]}, {ticketIds:["not-uuid"]},
  {ticketIds:Array(11).fill(randomUUID())}, {ticketIds:[1]}]){
  assert.equal((await request(submit,"POST",body,kitchen)).status,400,"Invalid receipt payload");
 }
 const before=await expect<Visibility>(await request(visibility,"GET",undefined,kitchen),200);
 const otherBefore=await expect<Visibility>(await request(visibility,"GET",undefined,other),200);
 assert.equal(before.evidence,"foreground_client_report");
 const [section]=await db.select({id:diningSection.id}).from(diningSection)
  .where(and(eq(diningSection.tenantId,"dev-restaurant"),
   eq(diningSection.active,true),isNull(diningSection.archivedAt))).limit(1);
 const [actor]=await db.select({id:user.id}).from(user)
  .where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(section&&actor);
 const suffix=randomUUID().slice(0,8),tableLabel="P30"+suffix;
 const table=await expect<{id:string}>(await request("/api/floor/tables","POST",{
  sectionId:section.id,label:tableLabel,seats:4,sortOrder:83,
  notes:"P30 visibility test",active:true,assignedWaiterId:actor.id
 },owner),201);
 const visit=await expect<{visit:{id:string}}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),201);
 const category=await expect<{id:string}>(await request("/api/menu/categories","POST",{
  nameFa:"نمایش "+suffix,namePs:"څرګندونه "+suffix,
  nameEn:"KDS Visibility "+suffix,description:"",sortOrder:80,published:true},owner),201);
 const item=await expect<{id:string}>(await request("/api/menu/items","POST",{
  categoryId:category.id,nameFa:"غذای مشاهده",namePs:"لیدل شوي خواړه",
  nameEn:"Visibility Meal",description:"",sku:"P30-"+suffix,priceMinor:16400,
  imageId:null,allergens:[],preparationMinutes:7,sortOrder:0,published:true,groupIds:[]
 },owner),201);
 const catalog=await expect<{items:{id:string;version:number}[]}>(
  await request("/api/menu/catalog","GET",undefined,waiter),200);
 const dish=catalog.items.find(row=>row.id===item.id);
 assert.ok(dish,"P30 published menu item missing from waiter catalog");
 const sendOrder=()=>request(
  "/api/orders/visits/"+visit.visit.id+"/rounds","POST",{
   idempotencyKey:"p30_"+randomUUID().replaceAll("-",""),
   note:"First kitchen display sample",
   lines:[{itemId:dish.id,itemVersion:dish.version,quantity:1,
    note:"No salt",selections:[]}]
  },waiter);
 const first=await expect<Round>(await sendOrder(),201);
 const firstId=first.ticket.id;
 const batchBefore=await expect<Visibility>(await request(visibility,"GET",undefined,kitchen),200);
 assert.equal(batchBefore.acceptedCount,before.acceptedCount+1,
  "Accepted order is counted without requiring a KDS receipt.");
 assert.equal(batchBefore.observedCount,before.observedCount,
  "Server GET and order submission must not manufacture a display receipt.");
 assert.equal(batchBefore.activeWithoutReceipt,before.activeWithoutReceipt+1);
 const cards=await expect<Cards>(await request(
  "/api/orders/kitchen/cards?status=new&page=1&table="+encodeURIComponent(tableLabel),
  "GET",undefined,kitchen),200);
 assert.equal(cards.total,1);
 assert.equal(cards.items[0]?.ticketId,firstId);
 assert.equal(cards.detailsByRound[first.round.id]?.ticket.version,1);
 const afterGET=await expect<Visibility>(await request(visibility,"GET",undefined,kitchen),200);
 assert.equal(afterGET.observedCount,before.observedCount,
  "Fetching kitchen card JSON alone is not proof a browser rendered the ticket.");
 const otherRequest=await expect<Receipt>(await request(submit,"POST",
  {ticketIds:[firstId]},other),200);
 assert.deepEqual(otherRequest,{accepted:0,submitted:1},
  "A second restaurant cannot report or discover this ticket's display.");
 const beforeTelemetry=await expect<Watermark>(await request(
  "/api/orders/kitchen/watermark","GET",undefined,kitchen),200);
 const results=await Promise.all(Array.from({length:6},()=>request(submit,"POST",
  {ticketIds:[firstId]},kitchen)));
 const receipts=await Promise.all(results.map(reply=>expect<Receipt>(reply,200)));
 assert.equal(receipts.reduce((sum,r)=>sum+r.accepted,0),1,
  "Six simultaneous reports must result in only one first display receipt.");
 assert.ok(receipts.every(r=>r.submitted===1));
 const repeat=await expect<Receipt>(await request(submit,"POST",
  {ticketIds:[firstId,firstId]},kitchen),200);
 assert.deepEqual(repeat,{accepted:0,submitted:1},"Duplicate IDs deduplicated and idempotent.");
 const [dbTicket]=await db.select({status:kitchenTicket.status,version:kitchenTicket.version,
  firstDisplayedAt:kitchenTicket.firstDisplayedAt})
  .from(kitchenTicket).where(eq(kitchenTicket.id,firstId)).limit(1);
 assert.equal(dbTicket?.status,"new");
 assert.equal(dbTicket?.version,1,"Telemetry must not change kitchen business version.");
 assert.ok(dbTicket?.firstDisplayedAt,"First KDS server-clock receipt must be durable.");
 const afterTelemetry=await expect<Watermark>(await request(
  "/api/orders/kitchen/watermark","GET",undefined,kitchen),200);
 assert.deepEqual(afterTelemetry,beforeTelemetry,
  "Display observation must never cause a ticket outbox event or new revision.");
 const observed=await expect<Visibility>(await request(visibility,"GET",undefined,kitchen),200);
 assert.equal(observed.acceptedCount,batchBefore.acceptedCount);
 assert.equal(observed.observedCount,batchBefore.observedCount+1);
 assert.equal(observed.activeWithoutReceipt,batchBefore.activeWithoutReceipt-1);
 assert.ok(observed.displayP95Seconds!==null&&observed.displayP95Seconds>=0);
 assert.ok(observed.displayMedianSeconds!==null&&
  observed.displayMedianSeconds<=observed.displayP95Seconds);
 const otherAfter=await expect<Visibility>(await request(visibility,"GET",undefined,other),200);
 assert.equal(otherAfter.observedCount,otherBefore.observedCount);
 assert.equal(otherAfter.acceptedCount,otherBefore.acceptedCount);
 const more=await Promise.all(Array.from({length:9},()=>sendOrder()));
 const rounds=await Promise.all(more.map(reply=>expect<Round>(reply,201)));
 const batchIds=rounds.map(row=>row.ticket.id);
 assert.equal(new Set(batchIds).size,9);
 const pack=await expect<Receipt>(await request(submit,"POST",
  {ticketIds:batchIds},owner),200);
 assert.deepEqual(pack,{accepted:9,submitted:9},
  "One bounded request can acknowledge an entire ten-ticket KDS page.");
 const packedMetric=await expect<Visibility>(await request(visibility,"GET",undefined,kitchen),200);
 assert.equal(packedMetric.acceptedCount,before.acceptedCount+10);
 assert.equal(packedMetric.observedCount,before.observedCount+10);
 assert.ok(packedMetric.displayP95Seconds!==null);
 assert.ok(packedMetric.displayP95Seconds>=packedMetric.displayMedianSeconds!);
 for(const minutes of [180,360]){
  const metric=await expect<Visibility>(await request(
   "/api/orders/kitchen/visibility?minutes="+minutes,"GET",undefined,kitchen),200);
  assert.equal(metric.minutes,minutes);
  assert.ok(metric.observedCount>=10);
 }
 console.info("PASS P30 HTTP: foreground-only KDS receipt distinct from JSON GET, tenant/role scope, idempotent concurrency, 10-ticket batching, no outbox mutations and real p95 coverage.");
}
main().then(async()=>{await pool.end();}).catch(async err=>{
 console.error(err);await pool.end();process.exitCode=1;
});
