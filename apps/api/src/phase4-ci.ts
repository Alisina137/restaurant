import "dotenv/config";
import assert from "node:assert/strict";
import {and,count,eq} from "drizzle-orm";
import {db,pool} from "./db";
import {diningVisit,tenantMembership,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P04 integration tests require nonproduction CI credentials.");
const BASE=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function req(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(BASE+path,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
  ...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
async function json<T>(response:Response,status:number):Promise<T>{
 const val=await response.json() as T;
 assert.equal(response.status,status,JSON.stringify(val));
 return val;
}
async function signIn(email:string){
 for(let attempt=0;attempt<5;attempt++){
  const r=await req("/api/auth/sign-in/email","POST",{email,password});
  if(r.status===429){await new Promise(done=>setTimeout(done,11000));continue;}
  assert.equal(r.status,200,await r.text());
  return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Authentication rate limited");
}
const section=(name:string)=>({name,sortOrder:0,active:true});
const table=(sectionId:string,waiterId:string,label:string)=>({
 sectionId,label,seats:4,sortOrder:0,notes:"Window table",active:true,assignedWaiterId:waiterId});
async function main(){
 const owner=await signIn("owner-ci@example.test"),waiter=await signIn("waiter-ci@example.test"),
   kitchen=await signIn("kitchen-ci@example.test"),other=await signIn("new-owner-ci@example.test");
 // P01 identity regression disables the seeded demo waiter; restore the fixture for P04.
 const [seededWaiter]=await db.select({id:user.id}).from(user).where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(seededWaiter,"seed waiter identity");
 await db.update(tenantMembership).set({status:"active"}).where(and(
   eq(tenantMembership.userId,seededWaiter!.id),eq(tenantMembership.tenantId,"dev-restaurant"),
   eq(tenantMembership.role,"waiter")));
 const prefix="/api/floor";
 assert.equal((await req(prefix+"/tables/board")).status,401);
 assert.equal((await req(prefix+"/tables/board","GET",undefined,kitchen)).status,403);
 const staff=await json<{items:{id:string;name:string}[]}>(await req(prefix+"/tables/staff","GET",undefined,owner),200);
 const waiterId=staff.items[0]?.id;assert.ok(waiterId,"demo waiter exists");
 const c1=await json<{id:string}>(await req(prefix+"/sections","POST",section("Indoor"),owner),201);
 const c2=await json<{id:string}>(await req(prefix+"/sections","POST",section("Patio"),owner),201);
 assert.equal((await req(prefix+"/sections","POST",section("Indoor"),owner)).status,409,"duplicate section name");
 assert.equal((await req(prefix+"/sections","POST",{name:"x",sortOrder:0,active:true},owner)).status,400);
 const a=await json<{id:string}>(await req(prefix+"/tables","POST",table(c1.id,waiterId,"A1"),owner),201);
 assert.equal((await req(prefix+"/tables","POST",table(c2.id,waiterId,"A1"),owner)).status,409,"label unique across location");
 assert.equal((await req(prefix+"/tables","POST",{...table(c1.id,waiterId,"Bad"),seats:0},owner)).status,400);
 const all=[a];
 for(let i=2;i<=10;i++){
  const created=await json<{id:string}>(await req(prefix+"/tables","POST",
    table(i<=5?c1.id:c2.id,waiterId,"A"+i),owner),201);
  all.push(created);
 }
 const b0=await json<{tables:{id:string;status:string}[];actorId:string}>(await req(prefix+"/tables/board","GET",undefined,waiter),200);
 assert.equal(b0.tables.length,10);assert.equal(b0.tables.find(t=>t.id===a.id)?.status,"available");
 assert.equal(b0.actorId,waiterId);
 const version0=await json<{version:number}>(await req(prefix+"/revision","GET",undefined,owner),200);
 assert.ok(version0.version>=12);
 // Cross-tenant, privilege and waiter assignment enforcement.
 assert.equal((await req(prefix+"/tables/"+a.id,"GET",undefined,other)).status,404);
 assert.equal((await req(prefix+"/tables/"+a.id+"/ready","POST",{version:1},other)).status,404);
 assert.equal((await req(prefix+"/tables","POST",table(c1.id,waiterId,"Other"),waiter)).status,403);
 assert.equal((await req(prefix+"/sections","POST",section("Forbidden"),waiter)).status,403);
 assert.equal((await req(prefix+"/tables/"+a.id+"/open","POST",{partySize:2},waiter)).status,404,
  "Only explicitly named visits endpoint exists");
 assert.equal((await req(prefix+"/visits/tables/"+a.id+"/open","POST",{partySize:5},waiter)).status,409,
  "waiter needs approval above capacity");
 const opened=await json<{visit:{id:string;partySize:number};created:boolean}>(
  await req(prefix+"/visits/tables/"+a.id+"/open","POST",{partySize:3},waiter),201);
 assert.equal(opened.visit.partySize,3);assert.equal(opened.created,true);
 const duplicate=await json<{visit:{id:string};created:boolean}>(
  await req(prefix+"/visits/tables/"+a.id+"/open","POST",{partySize:3},owner),200);
 assert.equal(duplicate.visit.id,opened.visit.id);assert.equal(duplicate.created,false);
 const occupied=await json<{table:{status:string;version:number}}>(await req(prefix+"/tables/"+a.id,"GET",undefined,owner),200);
 assert.equal(occupied.table.status,"occupied");
 assert.equal((await req(prefix+"/tables/"+a.id+"/archive","POST",{version:occupied.table.version},owner)).status,409);
 assert.equal((await req(prefix+"/tables/"+a.id,"PATCH",
  {...table(c1.id,waiterId,"A1"),active:false,version:occupied.table.version},owner)).status,409);
 assert.equal((await req(prefix+"/sections/"+c1.id+"/archive","POST",{version:1},owner)).status,409);
 assert.equal((await req(prefix+"/visits/"+opened.visit.id+"/finish","POST",
  {reason:"Guest departed"},waiter)).status,403,"waiter cannot pilot-close visit");
 // Two simultaneous manager requests must converge on one committed visit.
 const x=all[1]!.id;
 const [raceA,raceB]=await Promise.all([
  req(prefix+"/visits/tables/"+x+"/open","POST",{partySize:2},owner),
  req(prefix+"/visits/tables/"+x+"/open","POST",{partySize:2},owner)]);
 assert.deepEqual([raceA.status,raceB.status].sort(),[200,201],"open is collision-safe");
 const ia=await raceA.json() as {visit:{id:string}},ib=await raceB.json() as {visit:{id:string}};
 assert.equal(ia.visit.id,ib.visit.id);
 const [visits]=await db.select({total:count()}).from(diningVisit)
  .where(and(eq(diningVisit.tableId,x),eq(diningVisit.status,"open")));
 assert.equal(visits?.total,1,"partial unique constraint protects active visits");
 const closed=await json<{finished:boolean}>(await req(prefix+"/visits/"+opened.visit.id+"/finish",
  "POST",{reason:"Pilot seating completed"},owner),200);assert.equal(closed.finished,true);
 assert.equal((await req(prefix+"/visits/"+opened.visit.id+"/finish","POST",
  {reason:"Closing twice"},owner)).status,409,"cannot close twice");
 const cleaning=await json<{table:{status:string;version:number}}>(await req(prefix+"/tables/"+a.id,"GET",undefined,owner),200);
 assert.equal(cleaning.table.status,"cleaning");
 assert.equal((await req(prefix+"/visits/tables/"+a.id+"/open","POST",{partySize:2},waiter)).status,409,
  "cannot seat a table undergoing cleaning");
 assert.equal((await req(prefix+"/tables/"+a.id+"/ready","POST",{version:cleaning.table.version},waiter)).status,200);
 const ready=await json<{table:{status:string;version:number}}>(await req(prefix+"/tables/"+a.id,"GET",undefined,owner),200);
 assert.equal(ready.table.status,"available");
 assert.equal((await req(prefix+"/tables/"+a.id+"/ready","POST",{version:cleaning.table.version},waiter)).status,409);
 // Keep history on soft archive. Block occupied and cross-tenant modifications.
 const archived=await json<{archived:boolean}>(await req(prefix+"/tables/"+a.id+"/archive",
  "POST",{version:ready.table.version},owner),200);
 assert.equal(archived.archived,true);
 const archives=await json<{items:{id:string}[]}>(await req(prefix+"/tables?archive=1","GET",undefined,owner),200);
 assert.ok(archives.items.some(t=>t.id===a.id));
 assert.equal((await req(prefix+"/tables/"+x+"/archive","POST",{version:2},owner)).status,409);
 const details=await json<{table:{label:string;status:string}}>(await req(prefix+"/tables/"+x,"GET",undefined,waiter),200);
 assert.equal(details.table.status,"occupied");
 const after=await json<{version:number}>(await req(prefix+"/revision","GET",undefined,waiter),200);
 assert.ok(after.version>version0.version);
 const newBoard=await json<{tables:{id:string}[]}>(await req(prefix+"/tables/board","GET",undefined,owner),200);
 assert.equal(newBoard.tables.some(t=>t.id===a.id),false,"archive hidden from active floor");
 assert.equal(newBoard.tables.some(t=>t.id===x),true);
 console.info("PASS P04: location/role scoping, categories, 10 tables, assignment, capacity, unique active-visit race, cleaning lifecycle, archive guard and revision.");
}
main().then(async()=>{await pool.end();}).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
