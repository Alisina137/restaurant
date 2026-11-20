import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import {and,count,eq,isNull} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,user,orderRound,orderOutbox,kitchenTicket} from "./schema";

/** Phase 39 destructive contention simulation is disposable-CI ONLY.
 * Hold a real PostgreSQL row lock on a fresh table; confirm checkout times
 * out with safe original-key instructions, then commits exactly once when
 * the lock is released. No production DB or real restaurant usage permitted.
 */
const pgUrl=new URL(process.env.DATABASE_URL??"postgresql://invalid@invalid/invalid");
const apiUrl=new URL(process.env.E2E_API_URL??"http://localhost:4000");
if(process.env.NODE_ENV==="production"||process.env.CI!=="true"||
 !["localhost","127.0.0.1"].includes(pgUrl.hostname)||
 pgUrl.pathname!=="/dineflow_ci"||
 !["localhost","127.0.0.1"].includes(apiUrl.hostname)||
 apiUrl.protocol!=="http:"||!process.env.DEMO_PASSWORD)
 throw new Error("P39 requires disposable localhost PostgreSQL dineflow_ci, local HTTP API and CI=true.");
const api=apiUrl.origin;
const pass=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(api+path,{method,headers:{"Content-Type":"application/json",
  Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(response:Response,status:number):Promise<T>{
 const data=await response.json() as T;
 assert.equal(response.status,status,JSON.stringify(data));
 return data;
}
async function login(email:string){
 for(let i=0;i<7;i++){
  const response=await request("/api/auth/sign-in/email","POST",{email,password:pass});
  if(response.status===429){await delay(11000);continue;}
  assert.equal(response.status,200,"P39 CI fixture auth "+email);
  return response.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw Error("P39 test sign-in throttled");
}
async function main(){
 const [owner,waiter,kitchen,other]=await Promise.all([
  login("owner-ci@example.test"),login("waiter-ci@example.test"),
  login("kitchen-ci@example.test"),login("new-owner-ci@example.test")]);
 const [section]=await db.select({id:diningSection.id}).from(diningSection)
  .where(and(eq(diningSection.tenantId,"dev-restaurant"),
   eq(diningSection.active,true),isNull(diningSection.archivedAt))).limit(1);
 const [actor]=await db.select({id:user.id}).from(user)
  .where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(section&&actor,"Seeded active restaurant floor and waiter");
 const suffix=randomUUID().slice(0,8);
 const cat=await expect<{id:string}>(await request("/api/menu/categories","POST",{
  nameFa:"قفل "+suffix,namePs:"قلف "+suffix,nameEn:"P39 Lock "+suffix,
  description:"Disposable lock contention exercise",published:true,sortOrder:90
 },owner),201);
 const meal=await expect<{id:string}>(await request("/api/menu/items","POST",{
  categoryId:cat.id,nameFa:"آزمون "+suffix,namePs:"ازموینه "+suffix,
  nameEn:"P39 Safe Retry Meal",description:"One disposable food ticket",
  sku:"P39-"+suffix,priceMinor:11000,imageId:null,allergens:[],
  preparationMinutes:5,sortOrder:9,published:true,groupIds:[]
 },owner),201);
 const label="P39-"+suffix;
 const table=await expect<{id:string}>(await request("/api/floor/tables","POST",{
  sectionId:section.id,label,seats:4,sortOrder:81,active:true,
  assignedWaiterId:actor.id,notes:"P39 disposable row lock timeout"
 },owner),201);
 const visit=await expect<{visit:{id:string}}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),201);
 const catalog=await expect<{items:{id:string;version:number}[]}>(
  await request("/api/menu/catalog","GET",undefined,waiter),200);
 const dish=catalog.items.find(x=>x.id===meal.id);
 assert.ok(dish);
 const path="/api/orders/visits/"+visit.visit.id+"/rounds";
 const payload={
  idempotencyKey:"p39_"+randomUUID().replaceAll("-",""),
  note:"Same key, no duplicate ticket",
  lines:[{itemId:meal.id,itemVersion:dish.version,quantity:1,
   note:"No onion",selections:[]}]
 };
 assert.equal((await request(path,"POST",payload,other)).status,404,
  "Another restaurant cannot inject an order");
 const receiptPath="/api/orders/visits/"+visit.visit.id+"/submissions/"+
  encodeURIComponent(payload.idempotencyKey);
 // P40: the lookup is a private, read-only proof of THIS actor's submission,
 // not a global tenant order search, and does not need a currently open table.
 assert.equal((await request(receiptPath)).status,401);
 assert.equal((await request(receiptPath,"GET",undefined,kitchen)).status,403);
 assert.equal((await request(receiptPath,"GET",undefined,other)).status,404);
 assert.equal((await request(receiptPath,"GET",undefined,owner)).status,404,
  "Even another authorized employee cannot enumerate another submitter's receipt");
 const notYet=await request(receiptPath,"GET",undefined,waiter);
 assert.equal(notYet.status,404);
 assert.equal((await notYet.json() as {code:string}).code,"NOT_FOUND");
 assert.match(notYet.headers.get("cache-control")??"",/no-store/);
 assert.equal((await request("/api/orders/visits/"+visit.visit.id+
  "/submissions/invalid!", "GET",undefined,waiter)).status,400);
 const connection=await pool.connect();
 let held=false;
 try{
  await connection.query("BEGIN");
  held=true;
  await connection.query("SELECT id FROM dining_tables WHERE id=$1 FOR UPDATE",[table.id]);
  // No external fake mocks: this real PostgreSQL lock reproduces a stalled
  // kitchen/waiter checkout on the actual Express API, with no shared fixtures.
  const started=Date.now();
  const locked=await request(path,"POST",payload,waiter);
  const elapsed=Date.now()-started;
  const body=await locked.json() as {code:string;statusUncertain:boolean;
   retrySameKey:boolean;message:string};
  assert.equal(locked.status,503,"Lock wait returns explicit ambiguous status");
  assert.equal(body.code,"ORDER_STATUS_UNCERTAIN");
  assert.equal(body.statusUncertain,true);
  assert.equal(body.retrySameKey,true);
  assert.equal(locked.headers.get("retry-after"),"3");
  assert.match(locked.headers.get("cache-control")??"",/no-store/);
  assert.ok(elapsed>=6500&&elapsed<16000,
   "Configured 8-second lock budget bounds blocked checkout: "+elapsed);
  assert.ok(!JSON.stringify(body).includes("postgresql://"));
  assert.ok(!JSON.stringify(body).includes(table.id));
  assert.ok(!JSON.stringify(body).includes(payload.idempotencyKey),
   "Never echo private request identifiers in failure response");
 }finally{
  if(held)await connection.query("ROLLBACK");
  connection.release();
 }
 const accepted=await expect<{created:boolean;round:{id:string;totalMinor:number};
  ticket:{id:string}}>(await request(path,"POST",payload,waiter),201);
 assert.equal(accepted.created,true);
 assert.equal(accepted.round.totalMinor,11000);
 const confirmed=await request(receiptPath,"GET",undefined,waiter);
 assert.equal(confirmed.status,200);
 assert.match(confirmed.headers.get("cache-control")??"",/no-store/);
 const receipt=await confirmed.json() as {status:string;roundId:string};
 assert.deepEqual(receipt,{status:"accepted",roundId:accepted.round.id});
 assert.equal(JSON.stringify(receipt).includes(payload.idempotencyKey),false);
 assert.equal(JSON.stringify(receipt).includes("totalMinor"),false);

 const replay=await expect<{created:boolean;round:{id:string}}>(
  await request(path,"POST",payload,waiter),200);
 assert.equal(replay.created,false);
 assert.equal(replay.round.id,accepted.round.id);
 const changed=await expect<{code:string}>(await request(path,"POST",{
  ...payload,lines:payload.lines.map(line=>({...line,quantity:2}))
 },waiter),409);
 assert.equal(changed.code,"IDEMPOTENCY_CONFLICT");
 const [rounds]=await db.select({n:count()}).from(orderRound)
  .where(eq(orderRound.visitId,visit.visit.id));
 const [tickets]=await db.select({n:count()}).from(kitchenTicket)
  .where(eq(kitchenTicket.roundId,accepted.round.id));
 const [outbox]=await db.select({n:count()}).from(orderOutbox)
  .where(eq(orderOutbox.roundId,accepted.round.id));
 assert.equal(rounds?.n,1,"Only one accepted order after failure/retry");
 assert.equal(tickets?.n,1,"Only one kitchen ticket");
 assert.equal(outbox?.n,1,"Only one durable acceptance event");
 assert.equal((await request("/api/orders/kitchen/cards?status=new&table="+
  encodeURIComponent(label),"GET",undefined,kitchen)).status,200);
 console.info("PASS P39: real bounded lock contention and 503 Retry-After; same-key recovery; replay; tenant isolation; one ticket/event.");
}
main().then(async()=>{await pool.end();}).catch(async error=>{
 console.error(error);await pool.end();process.exitCode=1;
});
