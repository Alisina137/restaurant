import "dotenv/config";
import assert from "node:assert/strict";
import {and,eq,sql,desc} from "drizzle-orm";
import {db,pool} from "./db";
import {auditEvent,checkPayment,diningCheck,financeRefund} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P11 integration checks require disposable CI/development data only.");
const base=process.env.E2E_API_URL??"http://localhost:4000";
async function call(path:string,cookie?:string){
 return fetch(base+path,{headers:{Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})}});
}
async function login(email:string){
 for(let attempt=0;attempt<9;attempt++){
  const response=await fetch(base+"/api/auth/sign-in/email",{
   method:"POST",headers:{"Content-Type":"application/json",Origin:"http://localhost:3000"},
   body:JSON.stringify({email,password:process.env.DEMO_PASSWORD})});
  if(response.status===429){await new Promise(resolve=>setTimeout(resolve,11000));continue;}
  assert.equal(response.status,200,email+": "+await response.text());
  return response.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
 }
 throw new Error("Authentication rate limit did not clear.");
}
async function expect<T>(res:Response,status=200):Promise<T>{
 const content=await res.text();let data:unknown;
 try{data=JSON.parse(content);}catch{data=content;}
 assert.equal(res.status,status,JSON.stringify(data));
 return data as T;
}
type Daily={day:string;settledChecks:number;grossMinor:number;discountsMinor:number;
 taxMinor:number;serviceMinor:number;soldMinor:number;cashMinor:number;transferMinor:number;
 refundedMinor:number;paidMinor:number;netCollectedMinor:number};
type Sales={from:string;to:string;timezone:string;days:string[];daily:Daily[];
 totals:Daily&{tenders:number;refunds:number}};
function dateInZone(date:Date,timezone:string){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,year:"numeric",
  month:"2-digit",day:"2-digit"}).formatToParts(date);
 const value=(name:string)=>parts.find(p=>p.type===name)?.value;
 return [value("year"),value("month"),value("day")].join("-");
}
function sum(values:number[]){return values.reduce((a,b)=>a+b,0);}
async function main(){
 const owner=await login("owner-ci@example.test"),cashier=await login("cashier-ci@example.test");
 const waiter=await login("waiter-ci@example.test"),outsider=await login("new-owner-ci@example.test");
 const sales=await expect<Sales>(await call("/api/reports/sales",owner));
 assert.equal(sales.days.length,7);assert.equal(sales.daily.length,7);
 assert.equal(sales.totals.paidMinor,sales.totals.cashMinor+sales.totals.transferMinor);
 assert.equal(sales.totals.netCollectedMinor,sales.totals.paidMinor-sales.totals.refundedMinor);
 assert.equal(sales.totals.soldMinor,sales.totals.grossMinor-sales.totals.discountsMinor+
  sales.totals.taxMinor+sales.totals.serviceMinor);
 assert.equal(sales.totals.netCollectedMinor,sum(sales.daily.map(d=>d.netCollectedMinor)));
 assert.ok(sales.totals.grossMinor>0,"Phase 9 settled orders are present in reports.");
 assert.ok(sales.totals.refundedMinor>0,"Phase 10 refund must reduce net collected.");
 const whereRange=(d:Date)=>{const day=dateInZone(d,sales.timezone);
  return day>=sales.from&&day<=sales.to;};
 const checks=await db.select().from(diningCheck).where(and(
  eq(diningCheck.tenantId,"dev-restaurant"),eq(diningCheck.locationId,"dev-location"),
  eq(diningCheck.status,"settled")));
 const settled=checks.filter(c=>c.settledAt&&whereRange(c.settledAt));
 assert.equal(sales.totals.grossMinor,sum(settled.map(c=>c.subtotalMinor)));
 assert.equal(sales.totals.discountsMinor,sum(settled.map(c=>c.discountMinor)));
 assert.equal(sales.totals.soldMinor,sum(settled.map(c=>c.totalMinor)));
 const payments=await db.select().from(checkPayment).where(and(
  eq(checkPayment.tenantId,"dev-restaurant"),eq(checkPayment.locationId,"dev-location")));
 const refunds=await db.select().from(financeRefund).where(and(
  eq(financeRefund.tenantId,"dev-restaurant"),eq(financeRefund.locationId,"dev-location")));
 assert.equal(sales.totals.paidMinor,sum(payments.filter(p=>whereRange(p.createdAt)&&p.status==="posted")
  .map(p=>p.amountMinor)));
 assert.equal(sales.totals.refundedMinor,sum(refunds.filter(p=>whereRange(p.postedAt))
  .map(p=>p.amountMinor)));
 const items=await expect<{items:Array<{itemId:string;quantity:number;grossMinor:number;
  discountMinor:number;netMinor:number}>}>(await call("/api/reports/items",owner));
 assert.ok(items.items.length>0);
 assert.equal(sum(items.items.map(row=>row.grossMinor)),sales.totals.grossMinor,
  "Item gross must match settled non-void order line snapshots.");
 assert.equal(sum(items.items.map(row=>row.discountMinor)),sales.totals.discountsMinor,
  "Deterministic prorated discount shares must reconcile.");
 assert.equal(sum(items.items.map(row=>row.netMinor)),
  sales.totals.grossMinor-sales.totals.discountsMinor);
 const target=items.items[0]!;
 const subset=await expect<{items:Array<{itemId:string}>}>(
  await call("/api/reports/items?category=__not_a_category__",owner));
 assert.equal(subset.items.length,0);
 assert.equal((await call("/api/reports/items?category="+encodeURIComponent("a".repeat(101)),owner)).status,400);
 const service=await expect<{metrics:{tickets:number;prepared:number;served:number;
  prepMedianSeconds:number|null;cancelRatePercent:number|null}}>(await call("/api/reports/service",owner));
 assert.ok(service.metrics.tickets>0);assert.ok(service.metrics.prepared>=service.metrics.served);
 const overview=await expect<{businessDate:string;netCollectedTodayMinor:number;activeTables:number;
  unpaidChecks:number;ordersToday:number}>(await call("/api/reports/overview",owner));
 const day=await expect<Sales>(await call("/api/reports/sales?from="+overview.businessDate+
  "&to="+overview.businessDate,owner));
 assert.equal(overview.netCollectedTodayMinor,day.totals.netCollectedMinor);
 assert.ok(overview.ordersToday>=0&&overview.activeTables>=0&&overview.unpaidChecks>=0);
 for(const path of ["/api/reports/sales","/api/reports/service","/api/reports/audit",
  "/api/reports/export?kind=transactions"]){
  assert.equal((await call(path,cashier)).status,403,"Cashier must not have management exports.");
  assert.equal((await call(path,waiter)).status,403,"Waiter must not see sales intelligence.");
 }
 assert.equal((await call("/api/reports/sales")).status,401);
 assert.equal((await call("/api/reports/export?kind=invalid",owner)).status,400);
 assert.equal((await call("/api/reports/sales?from=2026-02-30",owner)).status,400);
 assert.equal((await call("/api/reports/sales?from=2026-01-01&to="+sales.to,owner)).status,400);
 const future=new Date(sales.to+"T12:00:00Z");future.setUTCDate(future.getUTCDate()+2);
 assert.equal((await call("/api/reports/sales?to="+future.toISOString().slice(0,10),owner)).status,400);
 const outsiderSales=await expect<Sales>(await call("/api/reports/sales",outsider));
 const outsiderDetails=await db.select().from(diningCheck).where(eq(diningCheck.tenantId,"dev-restaurant"));
 assert.ok(outsiderDetails.length>0);
 assert.notEqual(outsiderSales.totals.soldMinor,sales.totals.soldMinor,
  "Another tenant cannot see DineFlow demo financial data.");
 const file=await call("/api/reports/export?kind=transactions&from="+sales.from+"&to="+sales.to,owner);
 assert.equal(file.status,200);
 assert.ok(file.headers.get("content-type")?.includes("text/csv"));
 const raw=await file.text();
 assert.ok(raw.startsWith("\uFEFF"),"UTF-8 BOM helps multilingual spreadsheet imports");
 assert.ok(raw.includes('"refund"')&&raw.includes('"payment"'),"Refund and tender remain separate rows");
 const salesExport=await call("/api/reports/export?kind=sales",owner);
 assert.equal(salesExport.status,200);assert.ok((await salesExport.text()).includes("netCollectedMinor"));
 const itemsExport=await call("/api/reports/export?kind=items",owner);
 assert.equal(itemsExport.status,200);assert.ok((await itemsExport.text()).includes(target.itemId));
 const serviceExport=await call("/api/reports/export?kind=service",owner);
 assert.equal(serviceExport.status,200);assert.ok((await serviceExport.text()).includes("prepMedianSeconds"));
 const audit=await expect<{items:Array<{id:string;action:string}>;total:number}>(
  await call("/api/reports/audit?action=report.exported",owner));
 assert.ok(audit.total>=4);
 assert.ok(audit.items.some(x=>x.action==="report.exported"));
 const auditExport=await call("/api/reports/export?kind=audit",owner);
 assert.equal(auditExport.status,200);assert.ok((await auditExport.text()).includes("report.exported"));
 const [log]=await db.select().from(auditEvent).where(and(
  eq(auditEvent.tenantId,"dev-restaurant"),eq(auditEvent.action,"report.exported")))
  .orderBy(desc(auditEvent.createdAt)).limit(1);
 assert.ok(log,"Every downloaded report must append an audit event");
 console.info("P11 passed: money ledger reconciliation, item discount allocation, business-day timezone, KPIs, service metrics, export audit, cross-role/cross-tenant scope.");
}
void main().then(async()=>{await pool.end();}).catch(async error=>{
 console.error(error);await pool.end();process.exitCode=1;
});
