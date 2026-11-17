import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {pool} from "./db";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("Phase 21 floor acceptance requires seeded, nonproduction CI credentials.");
const root=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function call(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(root+path,{method,headers:{Origin:"http://localhost:3000","Content-Type":"application/json",
  ...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
async function session(email:string):Promise<string>{
 for(let attempt=0;attempt<8;attempt++){
  const response=await call("/api/auth/sign-in/email","POST",{email,password});
  if(response.status===429){await new Promise(done=>setTimeout(done,11000));continue;}
  assert.equal(response.status,200,email+": "+await response.text());
  return response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw new Error("Login remained rate limited");
}
async function expect<T>(r:Response,status=200):Promise<T>{
 const text=await r.text();
 assert.equal(r.status,status,"Unexpected status: "+text.slice(0,900));
 return JSON.parse(text) as T;
}
type Table={id:string;label:string;status:string;version:number;assignedWaiterId:string|null;
 sectionId:string;visitId:string|null};
type Page<T>={items:T[];total:number;page:number;perPage:number};
const floor="/api/floor";
async function main(){
 const owner=await session("owner-ci@example.test"),
   waiter=await session("waiter-ci@example.test"),
   kitchen=await session("kitchen-ci@example.test"),
   other=await session("new-owner-ci@example.test");
 assert.equal((await call(floor+"/tables?q=test")).status,401);
 assert.equal((await call(floor+"/tables?q=test","GET",undefined,waiter)).status,403);
 assert.equal((await call(floor+"/sections?q=test","GET",undefined,kitchen)).status,403);
 const waiters=await expect<{items:{id:string;name:string}[]}>(
  await call(floor+"/tables/staff","GET",undefined,owner));
 const assigned=waiters.items[0]?.id;
 assert.ok(assigned,"Seed must have an active restaurant waiter");
 const unique="P21"+randomUUID().slice(0,5),name="Zone "+unique+" West";
 const s1=await expect<{id:string}>(await call(floor+"/sections","POST",
  {name,sortOrder:17,active:true},owner),201);
 const s2=await expect<{id:string}>(await call(floor+"/sections","POST",
  {name:"Zone "+unique+" East",sortOrder:18,active:true},owner),201);
 const sectionSearch=await expect<Page<{id:string}>>(
  await call(floor+"/sections?q="+encodeURIComponent(unique),"GET",undefined,owner));
 assert.ok(sectionSearch.items.some(s=>s.id===s1.id)&&sectionSearch.items.some(s=>s.id===s2.id));
 assert.equal(sectionSearch.perPage,10);
 const absentSections=await expect<Page<{id:string}>>(
  await call(floor+"/sections?q="+unique,"GET",undefined,other));
 assert.equal(absentSections.total,0,"A different restaurant cannot search private dining sections.");
 const payload=(id:string,label:string,waiterId:string|null,active=true)=>({
  label,sectionId:id,seats:4,sortOrder:33,notes:"Area "+unique,
  active,assignedWaiterId:waiterId
 });
 const a=await expect<{id:string}>(await call(floor+"/tables","POST",payload(s1.id,unique+"A",assigned),owner),201);
 const z=await expect<{id:string}>(await call(floor+"/tables","POST",payload(s1.id,unique+"B",null),owner),201);
 const d=await expect<{id:string}>(await call(floor+"/tables","POST",payload(s2.id,unique+"C",assigned,false),owner),201);
 const bySearch=await expect<Page<Table>>(await call(floor+"/tables?q="+unique,"GET",undefined,owner));
 assert.ok([a.id,z.id,d.id].every(id=>bySearch.items.some(x=>x.id===id)));
 assert.equal(bySearch.total,3);
 const bySection=await expect<Page<Table>>(await call(
  floor+"/tables?q="+unique+"&section="+s1.id,"GET",undefined,owner));
 assert.deepEqual(new Set(bySection.items.map(x=>x.id)),new Set([a.id,z.id]));
 assert.equal(bySection.total,2);
 const notAssigned=await expect<Page<Table>>(await call(
  floor+"/tables?q="+unique+"&waiter=unassigned","GET",undefined,owner));
 assert.deepEqual(notAssigned.items.map(x=>x.id),[z.id]);
 const mine=await expect<Page<Table>>(await call(
  floor+"/tables?q="+unique+"&waiter="+assigned,"GET",undefined,owner));
 assert.deepEqual(new Set(mine.items.map(x=>x.id)),new Set([a.id,d.id]));
 const disabled=await expect<Page<Table>>(await call(
  floor+"/tables?q="+unique+"&status=disabled","GET",undefined,owner));
 assert.deepEqual(disabled.items.map(x=>x.id),[d.id]);
 const available=await expect<Page<Table>>(await call(
  floor+"/tables?q="+unique+"&status=available","GET",undefined,owner));
 assert.deepEqual(new Set(available.items.map(x=>x.id)),new Set([a.id,z.id]));
 assert.equal((await call(floor+"/tables?status=reserved","GET",undefined,owner)).status,400,
  "Reserved status is not supported; it must not be faked.");
 const foreign=await expect<Page<Table>>(await call(floor+"/tables?q="+unique,"GET",undefined,other));
 assert.equal(foreign.total,0,"Search is tenant/location scoped.");
 const visit=await expect<{visit:{id:string}}>(await call(floor+"/visits/tables/"+a.id+"/open",
  "POST",{partySize:2},owner),201);
 const occupied=await expect<Page<Table>>(await call(
  floor+"/tables?q="+unique+"&status=occupied","GET",undefined,owner));
 assert.deepEqual(occupied.items.map(x=>x.id),[a.id]);
 const activeRow=occupied.items[0]!;
 assert.equal(activeRow.visitId,visit.visit.id,"Occupancy filter is derived from actual open visits.");
 assert.equal((await call(floor+"/tables/"+a.id+"/archive","POST",
  {version:activeRow.version},owner)).status,409);
 assert.equal((await call(floor+"/tables/"+a.id,"PATCH",
  {...payload(s1.id,unique+"A",null),version:activeRow.version},owner)).status,409,
  "Occupied table cannot lose its waiter assignment.");
 await expect<{finished:boolean}>(await call(floor+"/visits/"+visit.visit.id+"/finish",
  "POST",{reason:"Guest checked out without an order"},owner));
 const clean=await expect<Page<Table>>(await call(floor+"/tables?q="+unique+"&status=cleaning",
  "GET",undefined,owner));
 assert.deepEqual(clean.items.map(x=>x.id),[a.id]);
 await expect<{available:boolean}>(await call(floor+"/tables/"+a.id+"/ready",
  "POST",{version:clean.items[0]!.version},owner));
 const cleanAgain=await expect<Page<Table>>(await call(floor+"/tables?q="+unique+"&status=cleaning",
  "GET",undefined,owner));
 assert.equal(cleanAgain.total,0);
 const afterReady=await expect<Page<Table>>(await call(floor+"/tables?q="+unique+"&status=available",
  "GET",undefined,owner));
 assert.deepEqual(new Set(afterReady.items.map(x=>x.id)),new Set([a.id,z.id]));
 for(const id of [a.id,z.id,d.id]){
  const row=await expect<{table:Table}>(await call(floor+"/tables/"+id,"GET",undefined,owner));
  await expect<{archived:boolean}>(await call(floor+"/tables/"+id+"/archive",
   "POST",{version:row.table.version},owner));
 }
 const gone=await expect<Page<Table>>(await call(floor+"/tables?q="+unique,"GET",undefined,owner));
 assert.equal(gone.total,0);
 const archived=await expect<Page<Table>>(await call(floor+"/tables?archive=1&q="+unique,
  "GET",undefined,owner));
 assert.equal(archived.total,3,"Archived history remains queryable.");
 for(const [id]of [[s1.id],[s2.id]]){
  const row=await expect<Page<{id:string;version:number}>>(await call(
   floor+"/sections?q="+unique,"GET",undefined,owner));
  const s=row.items.find(x=>x.id===id);
  assert.ok(s,"Unarchived section should be visible");
  await expect<{archived:boolean}>(await call(floor+"/sections/"+id+"/archive",
   "POST",{version:s.version},owner));
 }
 const sectionsGone=await expect<Page<{id:string}>>(await call(
  floor+"/sections?q="+unique,"GET",undefined,owner));
 assert.equal(sectionsGone.total,0);
 console.info("PASS P21 floor: role+tenant scope, SQL search and filters, live occupancy, waiter assignment, capacity lifecycle and archive.");
}
main().then(async()=>{await pool.end();}).catch(async error=>{
 console.error(error);await pool.end();process.exitCode=1;
});
