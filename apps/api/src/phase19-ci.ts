import "dotenv/config";
import assert from "node:assert/strict";
import {pool} from "./db";

if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw Error("Phase 19 CI must use disposable development data.");
const ROOT=process.env.E2E_API_URL??"http://localhost:4000";
async function call(path:string,cookie?:string){
 return fetch(ROOT+path,{headers:{Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})}});
}
async function signIn(email:string){
 for(let n=0;n<8;n++){
  const response=await fetch(ROOT+"/api/auth/sign-in/email",{
   method:"POST",headers:{"Content-Type":"application/json",Origin:"http://localhost:3000"},
   body:JSON.stringify({email,password:process.env.DEMO_PASSWORD})});
  if(response.status===429){await new Promise(resolve=>setTimeout(resolve,11000));continue;}
  assert.equal(response.status,200,email+" login: "+await response.text());
  return response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw Error("Sign-in remained throttled after backoff");
}
type Day={date:string;netCollectedMinor:number;netSalesMinor:number;settledChecks:number;refundsMinor:number};
type Dash={
 generatedAt:string;
 period:{days:number;from:string;to:string;previousFrom:string;previousTo:string;
  timezone:string;businessDate:string;currency:string};
 live:Record<string,number>;
 performance:{
  current:{settledChecks:number;netSalesMinor:number;netCollectedMinor:number;
   grossSalesMinor:number;refundedMinor:number;paidMinor:number;tenders:number;cashMinor:number;transferMinor:number};
  previous:{settledChecks:number;netSalesMinor:number;netCollectedMinor:number;refundedMinor:number};
  daily:Day[]
 };
 topItems:Array<{itemId:string;quantity:number;netMinor:number}>;
 service:{tickets:number;prepared:number;served:number;prepMedianSeconds:number|null;
  prepP95Seconds:number|null;cancelRatePercent:number|null};
 accountingNote:string;
};
type Sales={
 daily:Array<{day:string;netCollectedMinor:number}>;
 totals:{settledChecks:number;soldMinor:number;netCollectedMinor:number;grossMinor:number;
  refundedMinor:number;paidMinor:number};
};
const sum=(data:number[])=>data.reduce((a,b)=>a+b,0);
async function expectJson<T>(response:Response,status=200):Promise<T>{
 const body=await response.text();
 assert.equal(response.status,status,body.slice(0,2000));
 return JSON.parse(body) as T;
}
async function checkPeriod(cookie:string,days:7|30){
 const response=await call("/api/reports/dashboard?period="+days,cookie);
 assert.match(response.headers.get("cache-control")??"",/no-store/);
 const dashboard=await expectJson<Dash>(response);
 assert.equal(dashboard.period.days,days);
 assert.equal(dashboard.period.currency,"AFN");
 assert.equal(dashboard.performance.daily.length,days);
 assert.equal(dashboard.performance.daily[0]?.date,dashboard.period.from);
 assert.equal(dashboard.performance.daily.at(-1)?.date,dashboard.period.to);
 assert.equal(dashboard.period.businessDate,dashboard.period.to);
 assert.equal(new Date(dashboard.period.to+"T00:00:00Z").getTime()-
  new Date(dashboard.period.from+"T00:00:00Z").getTime(),(days-1)*86400000);
 assert.equal(new Date(dashboard.period.from+"T00:00:00Z").getTime()-
  new Date(dashboard.period.previousTo+"T00:00:00Z").getTime(),86400000);
 assert.equal(new Date(dashboard.period.previousTo+"T00:00:00Z").getTime()-
  new Date(dashboard.period.previousFrom+"T00:00:00Z").getTime(),(days-1)*86400000);
 assert.ok(Number.isFinite(new Date(dashboard.generatedAt).getTime()));
 const sales=await expectJson<Sales>(await call("/api/reports/sales?from="+
  dashboard.period.from+"&to="+dashboard.period.to,cookie));
 const past=await expectJson<Sales>(await call("/api/reports/sales?from="+
  dashboard.period.previousFrom+"&to="+dashboard.period.previousTo,cookie));
 assert.equal(dashboard.performance.current.netCollectedMinor,sales.totals.netCollectedMinor,
  "Dashboard collection must exactly match report ledger, never an estimate.");
 assert.equal(dashboard.performance.current.netSalesMinor,sales.totals.soldMinor);
 assert.equal(dashboard.performance.current.refundedMinor,sales.totals.refundedMinor);
 assert.equal(dashboard.performance.current.grossSalesMinor,sales.totals.grossMinor);
 assert.equal(dashboard.performance.current.paidMinor,sales.totals.paidMinor);
 assert.equal(dashboard.performance.previous.netCollectedMinor,past.totals.netCollectedMinor);
 assert.equal(dashboard.performance.previous.settledChecks,past.totals.settledChecks);
 assert.equal(dashboard.performance.current.netCollectedMinor,
  dashboard.performance.current.paidMinor-dashboard.performance.current.refundedMinor);
 assert.equal(sum(dashboard.performance.daily.map(d=>d.netCollectedMinor)),
  dashboard.performance.current.netCollectedMinor);
 assert.deepEqual(dashboard.performance.daily.map(d=>d.netCollectedMinor),
  sales.daily.map(d=>d.netCollectedMinor));
 const liveKeys=["activeTables","unpaidChecks","ordersToday","newTickets",
  "preparingTickets","readyTickets","pendingGuestApprovals","pendingServiceRequests"];
 for(const key of liveKeys)assert.ok(Number.isSafeInteger(dashboard.live[key])&&dashboard.live[key]!>=0,
  "Live queue count must be real nonnegative integer: "+key);
 assert.ok(dashboard.topItems.length<=5,"Ranking must stay bounded");
 assert.ok(dashboard.service.prepared<=dashboard.service.tickets);
 assert.ok(dashboard.service.served<=dashboard.service.tickets);
 assert.ok(typeof dashboard.accountingNote==="string"&&dashboard.accountingNote.length>10);
 return dashboard;
}
async function main(){
 const owner=await signIn("owner-ci@example.test");
 const cashier=await signIn("cashier-ci@example.test");
 const waiter=await signIn("waiter-ci@example.test");
 const otherTenant=await signIn("new-owner-ci@example.test");
 const dashboard7=await checkPeriod(owner,7);
 const dashboard30=await checkPeriod(owner,30);
 assert.equal(dashboard7.period.to,dashboard30.period.to);
 assert.ok(dashboard30.performance.current.grossSalesMinor>=dashboard7.performance.current.grossSalesMinor);
 const other=await checkPeriod(otherTenant,7);
 assert.notEqual(other.performance.current.netSalesMinor,dashboard7.performance.current.netSalesMinor,
  "Restaurant dashboard must not leak another tenant's settled sales.");
 assert.equal((await call("/api/reports/dashboard")).status,401,"Login required");
 assert.equal((await call("/api/reports/dashboard?period=7",cashier)).status,403);
 assert.equal((await call("/api/reports/dashboard?period=7",waiter)).status,403);
 for(const bad of ["0","90","-7","seven","7&from=2020-01-01","30&to=2099-01-01"]){
  assert.equal((await call("/api/reports/dashboard?period="+bad,owner)).status,400,"Invalid dashboard scope "+bad);
 }
 console.info("P19 passed: 7/30-day business ranges, prior period, settled/posted ledger, live queues, tenant/role isolation.");
}
void main().then(async()=>{await pool.end();}).catch(async e=>{
 console.error(e);await pool.end();process.exitCode=1;
});
