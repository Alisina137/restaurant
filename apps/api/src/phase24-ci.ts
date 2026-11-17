import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq,isNull} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P24 acceptance requires seeded disposable development PostgreSQL.");
const URL=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(URL+path,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
  ...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(response:Response,expected:number){
 const json=await response.json() as T;
 assert.equal(response.status,expected,JSON.stringify(json));return json;
}
async function signIn(email:string){
 for(let i=0;i<8;i++){
  const r=await request("/api/auth/sign-in/email","POST",{email,password});
  if(r.status===429){await new Promise(resolve=>setTimeout(resolve,11000));continue;}
  assert.equal(r.status,200,email+": "+await r.text());
  return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Timed out signing in after rate limiting.");
}
type TableRead={table:{id:string;version:number;status:string;visitId:string|null;
  assignedWaiterId:string|null;visitPartySize:number|null};canOpen:boolean};
type Requests={items:{id:string;status:string;version:number}[];total:number;page:number;perPage:number};
async function main(){
 const [owner,waiter,cashier,other]=await Promise.all([
  signIn("owner-ci@example.test"),signIn("waiter-ci@example.test"),
  signIn("cashier-ci@example.test"),signIn("new-owner-ci@example.test")]);
 const [section]=await db.select({id:diningSection.id}).from(diningSection)
  .where(and(eq(diningSection.tenantId,"dev-restaurant"),
   eq(diningSection.active,true),isNull(diningSection.archivedAt))).limit(1);
 const [staff]=await db.select({id:user.id}).from(user).where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(section&&staff,"P04 seeded sections and waiter required.");
 const label="P24"+randomUUID().slice(0,8);
 const table=await expect<{id:string}>(await request("/api/floor/tables","POST",{
  sectionId:section.id,label,seats:3,sortOrder:50,notes:"P24 waiter visit",
  active:true,assignedWaiterId:staff.id},owner),201);
 assert.equal((await request("/api/floor/tables/"+table.id)).status,401,"Table detail is private.");
 assert.equal((await request("/api/floor/tables/"+table.id,"GET",undefined,other)).status,404,
  "Other restaurant cannot access table detail.");
 const initial=await expect<TableRead>(await request("/api/floor/tables/"+table.id,"GET",undefined,waiter),200);
 assert.equal(initial.canOpen,true,"Assigned waiter can seat this table");
 assert.equal(initial.table.status,"available");
 assert.equal((await request("/api/floor/visits/tables/"+table.id+"/open",
  "POST",{partySize:0},waiter)).status,400,"Empty party rejected");
 const oversize=await expect<{code:string}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:4},waiter),409);
 assert.equal(oversize.code,"CAPACITY_REVIEW","Oversized party requires manager");
 const opened=await expect<{created:boolean;visit:{id:string}}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),201);
 assert.equal(opened.created,true);const visitId=opened.visit.id;
 const openedAgain=await expect<{created:boolean;visit:{id:string}}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),200);
 assert.equal(openedAgain.created,false);
 assert.equal(openedAgain.visit.id,visitId,"Duplicate clicks return same visit");
 const occupied=await expect<TableRead>(await request("/api/floor/tables/"+table.id,"GET",undefined,waiter),200);
 assert.equal(occupied.table.status,"occupied");assert.equal(occupied.table.visitPartySize,2);
 assert.equal(occupied.table.visitId,visitId);
 assert.equal((await request("/api/floor/tables/"+table.id+"/ready",
  "POST",{version:occupied.table.version},waiter)).status,409,
  "Occupied table cannot be marked clean");
 assert.equal((await request("/api/floor/visits/"+visitId,"GET",undefined,other)).status,404);
 const rounds=await expect<{rounds:unknown[];estimateMinor:number}>(
  await request("/api/orders/visits/"+visitId+"/rounds","GET",undefined,waiter),200);
 assert.equal(rounds.rounds.length,0);assert.equal(rounds.estimateMinor,0);
 assert.equal((await request("/api/orders/visits/"+visitId+"/rounds","GET",undefined,other)).status,404);
 const pin=await expect<{pin:string;version:number}>(await request(
  "/api/guest/staff/visits/"+visitId+"/pin","GET",undefined,waiter),200);
 assert.match(pin.pin,/^\d{6}$/,"Guest PIN is six digits and tied to active visit");
 assert.equal((await request("/api/guest/staff/visits/"+visitId+"/pin",
  "GET",undefined,other)).status,404,"Foreign restaurant cannot read private PIN");
 const rotated=await expect<{pin:string;version:number}>(await request(
  "/api/guest/staff/visits/"+visitId+"/pin/rotate",
  "POST",{version:pin.version},waiter),200);
 assert.equal(rotated.version,pin.version+1);
 assert.notEqual(rotated.pin,pin.pin,"PIN rotation revokes old credential");
 const stalePin=await expect<{code:string}>(await request(
  "/api/guest/staff/visits/"+visitId+"/pin/rotate",
  "POST",{version:pin.version},waiter),409);
 assert.equal(stalePin.code,"VERSION_CONFLICT","Stale PIN version forbidden");
 const guestApprovals=await expect<{total:number;items:unknown[]}>(await request(
  "/api/guest/staff/approvals?status=pending&tableId="+table.id+"&page=1",
  "GET",undefined,waiter),200);
 assert.equal(guestApprovals.total,0,"Filtered guest approvals must have real zero count");
 const created=await expect<{request:{id:string;version:number}}>(await request(
  "/api/service/visits/"+visitId+"/requests",
  "POST",{type:"water",note:"Please bring water"},waiter),201);
 const list=await expect<Requests>(await request(
  "/api/service/requests?status=active&tableId="+table.id+"&page=1",
  "GET",undefined,waiter),200);
 assert.equal(list.total,1);assert.equal(list.page,1);
 assert.equal(list.items[0]?.id,created.request.id);
 const otherList=await expect<Requests>(await request(
  "/api/service/requests?status=active&tableId="+table.id+"&page=1",
  "GET",undefined,other),200);
 assert.equal(otherList.total,0,"Foreign restaurant must not enumerate service for table");
 assert.equal((await request("/api/service/requests?status=active&tableId="+table.id,
  "GET",undefined,cashier)).status,403,"Cashier cannot access waiter service list");
 const reqId=created.request.id;
 const ack=await expect<{version:number;status:string}>(await request(
  "/api/service/requests/"+reqId+"/transition","POST",
  {version:created.request.version,action:"acknowledge"},waiter),200);
 assert.equal(ack.status,"acknowledged");
 assert.equal((await request("/api/service/requests/"+reqId+"/transition",
  "POST",{version:created.request.version,action:"resolve"},waiter)).status,409,
  "Double-click with stale version must fail");
 const done=await expect<{status:string;resolutionNote:string}>(await request(
  "/api/service/requests/"+reqId+"/transition","POST",
  {version:ack.version,action:"resolve",note:"Water delivered"},waiter),200);
 assert.equal(done.status,"resolved");assert.equal(done.resolutionNote,"Water delivered");
 const resolved=await expect<Requests>(await request(
  "/api/service/requests?status=resolved&tableId="+table.id+"&page=1",
  "GET",undefined,waiter),200);
 assert.equal(resolved.total,1);
 assert.equal(resolved.items[0]?.id,reqId);
 assert.equal((await request("/api/floor/visits/"+visitId+"/finish",
  "POST",{reason:"Waiter bypass test"},waiter)).status,403,
  "Waiter may not bypass cashier with manual visit finish");
 const closed=await expect<{finished:boolean;nextTableStatus:string}>(await request(
  "/api/floor/visits/"+visitId+"/finish","POST",{reason:"P24 zero-order pilot visit"},owner),200);
 assert.equal(closed.finished,true);assert.equal(closed.nextTableStatus,"cleaning");
 const cleaning=await expect<TableRead>(await request(
  "/api/floor/tables/"+table.id,"GET",undefined,waiter),200);
 assert.equal(cleaning.table.status,"cleaning");assert.equal(cleaning.table.visitId,null);
 assert.equal((await request("/api/floor/tables/"+table.id+"/ready",
  "POST",{version:occupied.table.version},waiter)).status,409,
  "Cleaning-ready button must reject stale table version");
 const ready=await expect<{available:boolean}>(await request(
  "/api/floor/tables/"+table.id+"/ready","POST",{version:cleaning.table.version},waiter),200);
 assert.equal(ready.available,true);
 const available=await expect<TableRead>(await request(
  "/api/floor/tables/"+table.id,"GET",undefined,waiter),200);
 assert.equal(available.table.status,"available");
 assert.equal((await request("/api/floor/tables/"+table.id+"/ready",
  "POST",{version:available.table.version},waiter)).status,409,
  "Already clean table cannot be marked clean again");
 await expect<{archived:boolean}>(await request("/api/floor/tables/"+table.id+"/archive",
  "POST",{version:available.table.version},owner),200);
 console.info("PASS P24: scoped waiter table detail, seating/capacity/idempotency, visit rounds, guest PIN/rotation, table-scoped guest approvals and service requests, request revision/resolve, manager-only finish, cleaning/version and archive.");
}
main().then(async()=>{await pool.end();}).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
