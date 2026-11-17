import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq,isNull} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,orderRound,kitchenTicket,orderLine,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P25 requires a seeded disposable development PostgreSQL database.");
const base=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(base+path,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
  ...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(reply:Response,status:number):Promise<T>{
 const json=await reply.json() as T;
 assert.equal(reply.status,status,JSON.stringify(json));return json;
}
async function login(email:string){
 for(let i=0;i<7;i++){
  const response=await request("/api/auth/sign-in/email","POST",{email,password});
  if(response.status===429){await new Promise(done=>setTimeout(done,11_000));continue;}
  assert.equal(response.status,200,email+": "+await response.text());
  return response.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Seed account sign-in remains rate limited");
}
async function main(){
 const [owner,waiter,kitchen,cashier,other]=await Promise.all([
  login("owner-ci@example.test"),login("waiter-ci@example.test"),login("kitchen-ci@example.test"),
  login("cashier-ci@example.test"),login("new-owner-ci@example.test")]);
 const [section]=await db.select({id:diningSection.id}).from(diningSection)
  .where(and(eq(diningSection.tenantId,"dev-restaurant"),
    eq(diningSection.active,true),isNull(diningSection.archivedAt))).limit(1);
 const [staff]=await db.select({id:user.id}).from(user)
  .where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(section&&staff,"Seeded waiter and active dining section required");
 const suffix=randomUUID().slice(0,8);
 const table=await expect<{id:string}>(await request("/api/floor/tables","POST",{
  sectionId:section.id,label:"K"+suffix,seats:4,sortOrder:70,notes:"P25 kitchen handoff test",
  active:true,assignedWaiterId:staff.id},owner),201);
 const opened=await expect<{visit:{id:string}}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:3},waiter),201);
 const visitId=opened.visit.id;
 const category=await expect<{id:string}>(await request("/api/menu/categories","POST",{
  nameFa:"آزمایش "+suffix,nameEn:"P25 Test "+suffix,namePs:"ازموینه "+suffix,
  description:"",sortOrder:70,published:true},owner),201);
 const meal=(version?:number,priceMinor=21500)=>({
  categoryId:category.id,nameFa:"غذای تست",namePs:"ازموینې خواړه",nameEn:"Test Meal",
  description:"Integration meal",sku:"P25-"+suffix,priceMinor,
  imageId:null,allergens:["wheat"],preparationMinutes:9,sortOrder:0,published:true,
  groupIds:[],...(version?{version}:{})
 });
 const product=await expect<{id:string}>(await request("/api/menu/items","POST",meal(),owner),201);
 const catalog=await expect<{version:number;items:{id:string;priceMinor:number;version:number;soldOut:boolean}[]}>(
  await request("/api/menu/catalog","GET",undefined,waiter),200);
 const dish=catalog.items.find(i=>i.id===product.id);
 assert.ok(dish);assert.equal(dish.priceMinor,21500);assert.equal(dish.soldOut,false);
 const key="p25_exact_key_"+randomUUID().replaceAll("-","");
 const lines=[{itemId:product.id,itemVersion:dish.version,quantity:3,note:"No peanuts",selections:[]}];
 const body={idempotencyKey:key,note:"Serve together",lines};
 const path="/api/orders/visits/"+visitId+"/rounds";
 assert.equal((await request(path,"POST",{...body,lines:[]},waiter)).status,400,
  "Empty cart is forbidden");
 assert.equal((await request(path,"POST",{...body,lines:[{...lines[0],quantity:0}]},waiter)).status,400,
  "Quantity must be 1 through 99");
 assert.equal((await request(path,"POST",{...body,note:"x".repeat(501)},waiter)).status,400,
  "Order note max 500 chars");
 assert.equal((await request(path,"POST",{...body,lines:[{...lines[0],note:"x".repeat(251)}]},waiter)).status,400,
  "Per-dish note max 250 chars");
 assert.equal((await request(path,"POST",{...body,lines:[{...lines[0],itemVersion:dish.version+2}]},waiter)).status,409,
  "Stale menu version must not create an order");
 assert.equal((await request(path,"POST",body,kitchen)).status,403,"Kitchen cannot submit waiter orders");
 assert.equal((await request(path,"POST",body,cashier)).status,403,"Cashier cannot submit waiter orders");
 assert.equal((await request(path,"POST",body,other)).status,404,"Another restaurant cannot order this visit");
 const first=await expect<{created:boolean;round:{id:string;totalMinor:number;roundNumber:number};
  ticket:{id:string;status:string;version:number}}>(await request(path,"POST",body,waiter),201);
 assert.equal(first.created,true);assert.equal(first.round.roundNumber,1);
 assert.equal(first.round.totalMinor,64500);
 const replay=await expect<{created:boolean;round:{id:string}}>(
  await request(path,"POST",body,waiter),200);
 assert.equal(replay.created,false);assert.equal(replay.round.id,first.round.id);
 const parallel=await Promise.all(Array.from({length:15},()=>request(path,"POST",body,waiter)));
 for(const result of parallel){
  const response=await expect<{created:boolean;round:{id:string}}>(result,200);
  assert.equal(response.created,false);assert.equal(response.round.id,first.round.id);
 }
 const changed={...body,lines:[{...lines[0],quantity:1}]};
 const conflict=await expect<{code:string}>(await request(path,"POST",changed,waiter),409);
 assert.equal(conflict.code,"IDEMPOTENCY_CONFLICT",
  "Reusing the exact key for a different cart must never change an already accepted order");
 const rounds=await expect<{rounds:{id:string}[];estimateMinor:number}>(
  await request("/api/orders/visits/"+visitId+"/rounds","GET",undefined,waiter),200);
 assert.equal(rounds.rounds.length,1);assert.equal(rounds.rounds[0]?.id,first.round.id);
 assert.equal(rounds.estimateMinor,64500);
 const [stored]=await db.select().from(orderRound).where(eq(orderRound.id,first.round.id)).limit(1);
 assert.equal(stored?.orderNote,"Serve together");assert.equal(stored?.totalMinor,64500);
 const tickets=await db.select().from(kitchenTicket)
  .where(eq(kitchenTicket.roundId,first.round.id));
 const persistedLines=await db.select().from(orderLine).where(eq(orderLine.roundId,first.round.id));
 assert.equal(tickets.length,1,"One durable kitchen ticket per request key");
 assert.equal(persistedLines.length,1,"Exactly one immutable order line");
 assert.equal(persistedLines[0]?.note,"No peanuts");
 assert.equal((await request("/api/orders/rounds/"+first.round.id,"GET",undefined,other)).status,404);
 assert.equal((await request("/api/floor/visits/"+visitId+"/finish","POST",
  {reason:"Cannot bypass unsettled ticket"},owner)).status,409,
  "Food cannot be silently closed without cashier settlement");
 // The idempotency replay MUST succeed even after the publication snapshot changes.
 assert.equal((await request("/api/menu/items/"+product.id,"PATCH",meal(dish.version,23500),owner)).status,200);
 const stock=await expect<{updated:number}>(await request(
  "/api/menu/items/availability/bulk","POST",
  {changes:[{id:product.id,version:dish.version+1,soldOut:true,reason:"P25 test stock"}]},owner),200);
 assert.ok(stock);
 const afterChange=await expect<{created:boolean;round:{id:string;totalMinor:number}}>(
  await request(path,"POST",body,waiter),200);
 assert.equal(afterChange.created,false);assert.equal(afterChange.round.id,first.round.id);
 assert.equal(afterChange.round.totalMinor,64500,"Historical price immutable after menu changes");
 const newKey="p25_second_key_"+randomUUID().replaceAll("-","");
 const unavailable=await expect<{code:string}>(await request(
  path,"POST",{...body,idempotencyKey:newKey},waiter),409);
 assert.equal(unavailable.code,"ITEM_UNAVAILABLE",
  "New submission must reject sold-out meal even if it was previously ordered");
 const prep=await expect<{saved:boolean}>(await request(
  "/api/orders/tickets/"+first.ticket.id+"/transition",
  "POST",{version:first.ticket.version,nextStatus:"preparing"},kitchen),200);
 assert.equal(prep.saved,true);
 const ready=await expect<{saved:boolean}>(await request(
  "/api/orders/tickets/"+first.ticket.id+"/transition",
  "POST",{version:first.ticket.version+1,nextStatus:"ready"},kitchen),200);
 assert.equal(ready.saved,true);
 const details=await expect<{round:{id:string;totalMinor:number};ticket:{status:string;version:number}}>(
  await request("/api/orders/rounds/"+first.round.id,"GET",undefined,waiter),200);
 assert.equal(details.ticket.status,"ready");assert.equal(details.round.totalMinor,64500);
 const delivered=await request("/api/orders/rounds/"+first.round.id+"/serve",
  "POST",{version:first.ticket.version+2},waiter);
 assert.equal(delivered.status,200,
  "Waiter confirms actual food delivery after kitchen-ready: "+await delivered.text());
 console.info("PASS P25: real table/visit catalog, validation, exact-key request replays and altered hash rejection, duplicate-proof kitchen ticket, immutable prices after stock change, kitchen ready and waiter delivery.");
}
main().then(async()=>pool.end()).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
