import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq,isNull} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,kitchenTicket,user} from "./schema";

if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw Error("P31 tests only use seeded disposable nonproduction databases.");
const api=process.env.E2E_API_URL??"http://localhost:4000";
const password=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(api+path,{method,headers:{"Content-Type":"application/json",
  Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(response:Response,code:number):Promise<T>{
 const data=await response.json() as T;assert.equal(response.status,code,JSON.stringify(data));return data;
}
async function login(email:string){
 for(let attempt=0;attempt<7;attempt++){
  const response=await request("/api/auth/sign-in/email","POST",{email,password});
  if(response.status===429){await new Promise(resolve=>setTimeout(resolve,11000));continue;}
  assert.equal(response.status,200,email+": "+await response.text());
  return response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw Error("P31 fixture sign-in rate limited");
}
type Row={ticketId:string;roundId:string;tableLabel:string;roundNumber:number;
 status:string;createdAt:string;version:number};
type Page={items:Row[];page:number;perPage:number;total:number;minAgeSeconds:number;
 table:string;oldestAt:string|null;checkedAt:string;evidence:string};
type Round={round:{id:string;roundNumber:number};ticket:{id:string;version:number}};
async function main(){
 const [owner,kitchen,waiter,cashier,other]=await Promise.all([
  login("owner-ci@example.test"),login("kitchen-ci@example.test"),
  login("waiter-ci@example.test"),login("cashier-ci@example.test"),
  login("new-owner-ci@example.test")
 ]);
 const endpoint="/api/orders/kitchen/unobserved";
 assert.equal((await request(endpoint)).status,401);
 for(const auth of [waiter,cashier])assert.equal((await request(endpoint,"GET",undefined,auth)).status,403);
 for(const param of ["page=0","page=-1","page=1001","page=1.5","page=abc",
  "minAgeSeconds=-1","minAgeSeconds=29","minAgeSeconds=999",
  "table="+encodeURIComponent("A".repeat(61))]){
  assert.equal((await request(endpoint+"?"+param,"GET",undefined,kitchen)).status,400,param);
 }
 const [section]=await db.select({id:diningSection.id}).from(diningSection)
  .where(and(eq(diningSection.tenantId,"dev-restaurant"),eq(diningSection.active,true),
   isNull(diningSection.archivedAt))).limit(1);
 const [actor]=await db.select({id:user.id}).from(user)
  .where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(section&&actor,"Seeded active section and waiter must be present.");
 const suffix=randomUUID().slice(0,8),label="P31"+suffix;
 const table=await expect<{id:string}>(await request("/api/floor/tables","POST",{
  sectionId:section.id,label,seats:4,sortOrder:86,notes:"P31 diagnostic fixture",
  active:true,assignedWaiterId:actor.id},owner),201);
 const visit=await expect<{visit:{id:string}}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),201);
 const category=await expect<{id:string}>(await request("/api/menu/categories","POST",{
  nameFa:"آشپزخانه "+suffix,namePs:"پخلنځی "+suffix,
  nameEn:"P31 kitchen "+suffix,description:"",sortOrder:80,published:true},owner),201);
 const item=await expect<{id:string}>(await request("/api/menu/items","POST",{
  categoryId:category.id,nameFa:"خوراک آزمایشی",namePs:"د ازموینې خواړه",
  nameEn:"P31 Meal",description:"Diagnostic item",sku:"P31-"+suffix,
  priceMinor:14900,imageId:null,allergens:[],preparationMinutes:7,sortOrder:0,
  published:true,groupIds:[]
 },owner),201);
 const catalog=await expect<{items:{id:string;version:number}[]}>(
  await request("/api/menu/catalog","GET",undefined,waiter),200);
 const dish=catalog.items.find(x=>x.id===item.id);
 assert.ok(dish,"P31 menu item in real catalog");
 const before=await expect<{cursor:number;revision:number}>(await request(
  "/api/orders/kitchen/watermark","GET",undefined,kitchen),200);
 const post=()=>request("/api/orders/visits/"+visit.visit.id+"/rounds","POST",{
  idempotencyKey:"p31_"+randomUUID().replaceAll("-",""),
  note:"P31 kitchen observation diagnostic",
  lines:[{itemId:item.id,itemVersion:dish.version,quantity:1,note:"No onion",selections:[]}]
 },waiter);
 const submitted=await Promise.all(Array.from({length:14},()=>post()));
 const rounds=await Promise.all(submitted.map(res=>expect<Round>(res,201)));
 assert.equal(new Set(rounds.map(x=>x.ticket.id)).size,14);
 assert.deepEqual(rounds.map(x=>x.round.roundNumber).sort((a,b)=>a-b),
  Array.from({length:14},(_,i)=>i+1));
 const query=(minAge=0,page=1,search=label)=>endpoint+"?page="+page+
  "&minAgeSeconds="+minAge+"&table="+encodeURIComponent(search);
 const response=await request(query(),"GET",undefined,kitchen);
 assert.match(response.headers.get("cache-control")??"",/no-store/);
 const one=await expect<Page>(response,200);
 const two=await expect<Page>(await request(query(0,2),"GET",undefined,kitchen),200);
 assert.equal(one.total,14);assert.equal(two.total,14);
 assert.equal(one.perPage,10);assert.equal(one.items.length,10);
 assert.equal(two.items.length,4);assert.equal(one.table,label);
 assert.equal(one.evidence,"missing_foreground_render_report");
 assert.equal(new Set([...one.items,...two.items].map(x=>x.ticketId)).size,14);
 assert.ok([...one.items,...two.items].every(x=>x.tableLabel===label&&
  x.roundId&&x.version===1&&x.status==="new"));
 assert.equal((await expect<Page>(await request(query(0,3),"GET",undefined,kitchen),200)).items.length,0);
 assert.equal((await expect<Page>(await request(query(0,1),"GET",undefined,other),200)).total,0);
 assert.equal((await expect<Page>(await request(query(0,1),"GET",undefined,owner),200)).total,14);
 assert.equal((await expect<Page>(await request(query(300),"GET",undefined,kitchen),200)).total,0);
 const afterGet=await expect<{cursor:number;revision:number}>(await request(
  "/api/orders/kitchen/watermark","GET",undefined,kitchen),200);
 assert.equal(afterGet.cursor,before.cursor+14,"GET must not emit events after 14 accepted rounds");
 // The outbox reconciler runs independently; read-only GETs never change
 // durable event cursor, but revision may catch up asynchronously.
 assert.ok(afterGet.revision>=before.revision+14,
  "All 14 accepted rounds must be reflected in revision");
 // First five reports are intentionally scoped, idempotent and not a workflow change.
 const ack=await expect<{accepted:number;submitted:number}>(await request(
  "/api/orders/kitchen/display-observed","POST",
  {ticketIds:rounds.slice(0,5).map(x=>x.ticket.id)},kitchen),200);
 assert.deepEqual(ack,{accepted:5,submitted:5});
 const afterAck=await expect<Page>(await request(query(),"GET",undefined,kitchen),200);
 assert.equal(afterAck.total,9);
 assert.equal(new Set(afterAck.items.map(x=>x.ticketId)).size,9);
 assert.ok(afterAck.items.every(x=>!rounds.slice(0,5).some(r=>r.ticket.id===x.ticketId)));
 const afterSeen=await expect<{cursor:number;revision:number}>(await request(
  "/api/orders/kitchen/watermark","GET",undefined,kitchen),200);
 assert.equal(afterSeen.cursor,afterGet.cursor,"First-render reports must not create outbox events");
 assert.ok(afterSeen.revision>=afterGet.revision,
  "Background reconciliation can advance revision during read-only first-render reports");
 // Only change this disposable CI fixture; prove age filtering is genuinely server-side.
 const agedId=afterAck.items[0]!.ticketId;
 await db.update(kitchenTicket).set({createdAt:new Date(Date.now()-10*60_000)})
  .where(and(eq(kitchenTicket.id,agedId),eq(kitchenTicket.tenantId,"dev-restaurant")));
 const old=await expect<Page>(await request(query(300),"GET",undefined,kitchen),200);
 assert.equal(old.total,1);
 assert.equal(old.items[0]?.ticketId,agedId,"Age filter includes old unreported ticket");
 assert.equal(old.minAgeSeconds,300);
 assert.equal(old.items[0]?.status,"new");
 const none=await expect<Page>(await request(query(0,1,"unrelatedlabel31"),"GET",undefined,kitchen),200);
 assert.equal(none.total,0);
 console.info("PASS P31 HTTP: 14 real accepted rounds, filtered 10+4 pages, tenant/role guards, age triage, idempotent observations and no read side effects.");
}
main().then(async()=>{await pool.end();}).catch(async err=>{
 console.error(err);await pool.end();process.exitCode=1;
});
