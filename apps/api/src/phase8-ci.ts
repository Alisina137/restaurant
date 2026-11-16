import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {eq} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,serviceRequest,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P08 must run only against disposable development PostgreSQL.");
const base=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string,token?:string){
 return fetch(base+path,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
 ...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:"Bearer "+token}:{})},
 body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(r:Response,code:number):Promise<T>{
 const data=await r.json() as T;assert.equal(r.status,code,JSON.stringify(data));return data;
}
async function login(email:string){
 for(let attempt=0;attempt<5;attempt++){
  const r=await request("/api/auth/sign-in/email","POST",{email,password});
  if(r.status===429){await new Promise(resolve=>setTimeout(resolve,11000));continue;}
  assert.equal(r.status,200,email+": "+await r.text());
  return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Sign-in retry exhausted");
}
async function main(){
 const [owner,waiter,cashier,other]=await Promise.all([
  login("owner-ci@example.test"),login("waiter-ci@example.test"),
  login("cashier-ci@example.test"),login("new-owner-ci@example.test")]);
 const [section]=await db.select().from(diningSection).where(eq(diningSection.tenantId,"dev-restaurant")).limit(1);
 const [w]=await db.select().from(user).where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(section&&w);
 const label="H"+randomUUID().slice(0,7);
 const table=await expect<{id:string}>(await request("/api/floor/tables","POST",{
  sectionId:section.id,label,seats:4,active:true,assignedWaiterId:w.id,sortOrder:99,notes:"P08 service test"
 },owner),201);
 const opened=await expect<{visit:{id:string}}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),201);
 const visitId=opened.visit.id;
 const qr=await expect<{url:string}>(await request("/api/guest/staff/qrs/"+table.id,"POST",{},owner),201);
 const segments=new URL(qr.url).pathname.split("/");
 const pin=await expect<{pin:string}>(await request(
  "/api/guest/staff/visits/"+visitId+"/pin","GET",undefined,waiter),200);
 const guest=await expect<{token:string}>(await request(
  "/api/guest/entry/"+segments[2]+"/"+segments[3]+"/"+segments[4]+"/verify","POST",
  {pin:pin.pin}),200);
 assert.equal((await request("/api/guest/requests")).status,401,"PIN session mandatory");
 const first=await expect<{created:boolean;request:{id:string;version:number;status:string}}>(
  await request("/api/guest/requests","POST",{type:"call_waiter",note:"Please help"},undefined,guest.token),201);
 assert.equal(first.created,true);
 const second=await expect<{created:boolean;deduplicated:boolean;request:{id:string}}>(
  await request("/api/guest/requests","POST",{type:"call_waiter",note:"Please help"},undefined,guest.token),200);
 assert.equal(second.deduplicated,true);
 assert.equal(second.request.id,first.request.id,"Repeated clicks share one request");
 const inbox=await expect<{items:{id:string;tableLabel:string}[];total:number}>(
  await request("/api/service/requests?status=active","GET",undefined,waiter),200);
 assert.ok(inbox.items.some(x=>x.id===first.request.id&&x.tableLabel===label));
 assert.equal((await request("/api/service/requests","GET",undefined,cashier)).status,403);
 const otherList=await expect<{items:{id:string}[]}>(
  await request("/api/service/requests","GET",undefined,other),200);
 assert.ok(!otherList.items.some(x=>x.id===first.request.id),"Other tenant cannot read");
 assert.equal((await request("/api/service/requests/"+first.request.id+"/transition","POST",{
  version:1,action:"resolve"},other)).status,404);
 const acknowledge=await expect<{status:string;version:number}>(
  await request("/api/service/requests/"+first.request.id+"/transition","POST",{
   version:1,action:"acknowledge"},waiter),200);
 assert.equal(acknowledge.status,"acknowledged");assert.equal(acknowledge.version,2);
 assert.equal((await request("/api/service/requests/"+first.request.id+"/transition","POST",{
  version:1,action:"resolve"},waiter)).status,409,"Concurrent device version guard");
 const visible=await expect<{items:{id:string;status:string}[]}>(
   await request("/api/guest/requests","GET",undefined,undefined,guest.token),200);
 assert.equal(visible.items.find(x=>x.id===first.request.id)?.status,"acknowledged");
 const done=await expect<{status:string;resolutionNote:string}>(
  await request("/api/service/requests/"+first.request.id+"/transition","POST",{
   version:2,action:"resolve",note:"Water delivered"},waiter),200);
 assert.equal(done.status,"resolved");
 assert.equal(done.resolutionNote,"Water delivered");
 const after=await expect<{active:number}>(
  await request("/api/service/requests/count","GET",undefined,waiter),200);
 assert.equal(after.active,0);
 assert.equal((await request("/api/guest/requests","POST",{
  type:"other",note:"x"},undefined,guest.token)).status,400);
 assert.equal((await request("/api/guest/requests","POST",{
  type:"unsupported",note:"hello"},undefined,guest.token)).status,400);
 const bill=await expect<{request:{id:string}}>(await request("/api/guest/requests","POST",{
  type:"bill",note:"Ready to pay"},undefined,guest.token),201);
 const requested=await expect<{items:{visitId:string;requested:boolean}[]}>(
  await request("/api/finance/checks?tab=requested","GET",undefined,cashier),200);
 assert.ok(requested.items.some(x=>x.visitId===visitId&&x.requested));
 const tableRequests=await expect<{items:{id:string}[]}>(
  await request("/api/service/requests?tableId="+table.id,"GET",undefined,waiter),200);
 assert.ok(tableRequests.items.some(x=>x.id===bill.request.id));
 const [stored]=await db.select().from(serviceRequest).where(eq(serviceRequest.id,bill.request.id)).limit(1);
 assert.equal(stored?.status,"pending");
 assert.equal((await request("/api/service/visits/"+visitId+"/requests","POST",{
  type:"water",note:"Bring water"},cashier)).status,403);
 console.info("PASS P08: verified guest requests, dedup, acknowledgment/resolution, cashier bill filter, note validation and tenant/role scopes.");
}
main().then(async()=>pool.end()).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
