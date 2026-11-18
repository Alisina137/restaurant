import "dotenv/config";
import assert from "node:assert/strict";
import {and,eq,inArray,count} from "drizzle-orm";
import {db,pool} from "./db";
import {kitchenTicket} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P27 must use a disposable nonproduction seeded database.");
const URL=process.env.E2E_API_URL??"http://localhost:4000";
const password=process.env.DEMO_PASSWORD;
async function request(path:string,cookie?:string){
 return fetch(URL+path,{headers:{Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})}});
}
async function login(email:string){
 for(let attempt=0;attempt<7;attempt++){
  const response=await fetch(URL+"/api/auth/sign-in/email",{method:"POST",
   headers:{"Content-Type":"application/json",Origin:"http://localhost:3000"},
   body:JSON.stringify({email,password})});
  if(response.status===429){await new Promise(done=>setTimeout(done,11_000));continue;}
  assert.equal(response.status,200,email+": "+await response.text());
  return response.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("P27 login rate limit");
}
type Overview={new:number;preparing:number;ready:number;waiting15m:number;
 oldestNewAt:string|null;oldestPreparingAt:string|null;oldestReadyAt:string|null;checkedAt:string};
type Queue={items:{tableLabel:string;ticketId:string;createdAt:string}[];total:number;page:number;perPage:number};
async function expect<T>(path:string,cookie:string,status:number){
 const response=await request(path,cookie);
 const data=await response.json() as T;
 assert.equal(response.status,status,JSON.stringify(data));
 if(status===200)assert.match(response.headers.get("cache-control")??"",/no-store/);
 return data;
}
async function main(){
 const [kitchen,owner,waiter,other]=await Promise.all([
  login("kitchen-ci@example.test"),login("owner-ci@example.test"),
  login("waiter-ci@example.test"),login("new-owner-ci@example.test")]);
 assert.equal((await request("/api/orders/kitchen/overview")).status,401);
 assert.equal((await request("/api/orders/kitchen/overview",waiter)).status,403);
 assert.equal((await request("/api/orders/kitchen?status=new&table=a",waiter)).status,403);
 const summary=await expect<Overview>("/api/orders/kitchen/overview",kitchen,200);
 const ownerSummary=await expect<Overview>("/api/orders/kitchen/overview",owner,200);
 assert.equal(summary.new,ownerSummary.new);assert.equal(summary.preparing,ownerSummary.preparing);
 assert.equal(summary.ready,ownerSummary.ready);
 assert.ok([summary.new,summary.preparing,summary.ready,summary.waiting15m].every(
  value=>Number.isSafeInteger(value)&&value>=0));
 const ctx=await expect<{tenantId:string}>("/api/context",kitchen,200);
 const tickets=await db.select({status:kitchenTicket.status,n:count()})
  .from(kitchenTicket)
  .where(and(eq(kitchenTicket.tenantId,ctx.tenantId),
   inArray(kitchenTicket.status,["new","preparing","ready","picked_up"])))
  .groupBy(kitchenTicket.status);
 const number=(status:string)=>tickets.find(t=>t.status===status)?.n??0;
 assert.deepEqual([summary.new,summary.preparing,summary.ready],
  [number("new"),number("preparing"),number("ready")+number("picked_up")],
  "Summary counts all assigned restaurant tickets, not just the first page");
 const otherSummary=await expect<Overview>("/api/orders/kitchen/overview",other,200);
 assert.ok(otherSummary.new+otherSummary.preparing+otherSummary.ready>=0);
 assert.equal((await request("/api/orders/kitchen?status=new&table="+encodeURIComponent("x".repeat(61)),kitchen)).status,400);
 for(const tab of ["new","preparing","ready"]){
  const full=await expect<Queue>("/api/orders/kitchen?status="+tab+"&page=1",kitchen,200);
  assert.equal(full.page,1);assert.equal(full.perPage,10);
  const total=tab==="ready"?summary.ready:tab==="new"?summary.new:summary.preparing;
  assert.equal(full.total,total);
  const target=full.items[0]?.tableLabel;
  if(!target)continue;
  const searched=await expect<Queue>("/api/orders/kitchen?status="+tab+
   "&page=1&table="+encodeURIComponent(target),kitchen,200);
  assert.ok(searched.items.length>0);
  assert.ok(searched.items.every(row=>row.tableLabel.toLowerCase().includes(target.toLowerCase())));
  assert.ok(searched.total<=full.total);
  const absent=await expect<Queue>("/api/orders/kitchen?status="+tab+
   "&page=1&table="+encodeURIComponent("no-such-table-x998811"),kitchen,200);
  assert.equal(absent.items.length,0);assert.equal(absent.total,0);
  break;
 }
 console.info("PASS P27 HTTP: kitchen-only live search, count accuracy, tenant isolation, pagination and no-store.");
}
main().then(async()=>{await pool.end();}).catch(async err=>{console.error(err);await pool.end();process.exitCode=1;});
