import "dotenv/config";
import assert from "node:assert/strict";
import {and,count,desc,eq} from "drizzle-orm";
import {db,pool} from "./db";
import {cashierShift,checkPayment,financeRefund,auditEvent,user} from "./schema";

if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P42 requires disposable CI/development fixture and DEMO_PASSWORD.");
const root=process.env.E2E_API_URL??"http://localhost:4000",pw=process.env.DEMO_PASSWORD;
async function request(path:string,cookie?:string){
 return fetch(root+path,{headers:{Origin:"http://localhost:3000",
  ...(cookie?{Cookie:cookie}:{})}});
}
async function login(email:string){
 for(let n=0;n<8;n++){
  const r=await fetch(root+"/api/auth/sign-in/email",{method:"POST",
   headers:{"Content-Type":"application/json",Origin:"http://localhost:3000"},
   body:JSON.stringify({email,password:pw})});
  if(r.status===429){await new Promise(resolve=>setTimeout(resolve,11000));continue;}
  assert.equal(r.status,200,email+" login failed");
  return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw Error("P42 test auth remained throttled");
}
type Evidence={
 shiftId:string;shiftStatus:string;evidence:string;currency:"AFN";pilotCertified:false;
 externalCashVerified:false;status:string;requiresInvestigation:boolean;signals:string[];
 totals:{openingFloatMinor:number;cashMinor:number;transferMinor:number;
  refundedCashMinor:number;refundedTransferMinor:number;netCollectedMinor:number;
  expectedDrawerMinor:number;closingCountMinor:number|null;varianceMinor:number|null;
  recordedExpectedMinor:number|null;recordedVarianceMinor:number|null;
  varianceThresholdMinor:number;postedPayments:number;refundCount:number};
 receipts:{linkedChecks:number;settledChecks:number;receiptCount:number;
  missingReceipts:number;receiptMismatches:number};
 checkedAt:string;
};
async function see(path:string,cookie:string,status=200){
 const r=await request(path,cookie);
 assert.equal(r.status,status,await r.clone().text());
 return {data:await r.json() as Evidence,response:r};
}
async function main(){
 // Runs AFTER the P09 payment/receipt/shift and P10 refund HTTP suites.
 const [owner,cashier,waiter,kitchen,other]=await Promise.all([
  login("owner-ci@example.test"),login("cashier-ci@example.test"),
  login("waiter-ci@example.test"),login("kitchen-ci@example.test"),
  login("new-owner-ci@example.test")
 ]);
 const [cashierActor,ownerActor]=await Promise.all([
  db.select({id:user.id}).from(user).where(eq(user.email,"cashier-ci@example.test")).limit(1),
  db.select({id:user.id}).from(user).where(eq(user.email,"owner-ci@example.test")).limit(1)
 ]);
 assert.ok(cashierActor[0]&&ownerActor[0]);
 const closed=await db.select().from(cashierShift).where(and(
  eq(cashierShift.tenantId,"dev-restaurant"),eq(cashierShift.status,"closed")))
  .orderBy(desc(cashierShift.closedAt));
 const original=closed.find(x=>x.cashierId===cashierActor[0]!.id);
 const supervisor=closed.find(x=>x.cashierId===ownerActor[0]!.id&&
  x.supervisorId!==null&&x.varianceMinor!==null&&x.varianceMinor!==0);
 assert.ok(original&&supervisor,"P09 seeded fixture must provide normal and supervised shifts");
 const path="/api/finance/shifts/"+original.id+"/reconciliation";
 const ownerPath="/api/finance/shifts/"+supervisor.id+"/reconciliation";
 const [auditBefore]=await db.select({n:count()}).from(auditEvent)
  .where(eq(auditEvent.tenantId,"dev-restaurant"));
 assert.equal((await request(path)).status,401);
 for(const token of [waiter,kitchen])
  assert.equal((await request(path,token)).status,403,"Noncashier access denied");
 assert.equal((await request(path,other)).status,404,"Foreign tenant cannot inspect cash drawer");
 assert.equal((await request(ownerPath,cashier)).status,404,
  "Cashier must never see another employee's shift");
 const current=await see(path,cashier);
 assert.match(current.response.headers.get("cache-control")??"",/no-store/);
 const same=await see(path,owner);
 assert.deepEqual(current.data,same.data,"Owner and owning cashier see the same immutable evidence");
 assert.equal(current.data.shiftId,original.id);
 assert.equal(current.data.shiftStatus,"closed");
 assert.equal(current.data.pilotCertified,false);
 assert.equal(current.data.externalCashVerified,false);
 assert.equal(current.data.currency,"AFN");
 assert.ok(Number.isFinite(Date.parse(current.data.checkedAt)));
 assert.equal(current.data.totals.recordedExpectedMinor,original.expectedMinor);
 assert.equal(current.data.totals.recordedVarianceMinor,original.varianceMinor);
 assert.equal(current.data.totals.varianceMinor,original.varianceMinor);
 assert.equal(current.data.receipts.missingReceipts,0);
 assert.equal(current.data.receipts.receiptMismatches,0);
 assert.ok(current.data.receipts.receiptCount>0,"Settled original check has immutable receipt");
 const payments=await db.select({method:checkPayment.method,status:checkPayment.status,
  amountMinor:checkPayment.amountMinor})
  .from(checkPayment).where(eq(checkPayment.shiftId,original.id));
 const refunds=await db.select({method:financeRefund.method,
  amountMinor:financeRefund.amountMinor}).from(financeRefund)
  .where(eq(financeRefund.shiftId,original.id));
 const independent=original.openingFloatMinor+
  payments.filter(x=>x.method==="cash"&&x.status==="posted")
   .reduce((n,x)=>n+x.amountMinor,0)-
  refunds.filter(x=>x.method==="cash").reduce((n,x)=>n+x.amountMinor,0);
 assert.equal(current.data.totals.expectedDrawerMinor,independent);
 assert.equal(current.data.totals.netCollectedMinor,
  current.data.totals.cashMinor+current.data.totals.transferMinor-
   current.data.totals.refundedCashMinor-current.data.totals.refundedTransferMinor);
 const supervised=(await see(ownerPath,owner)).data;
 assert.equal(supervised.totals.varianceMinor,supervisor.varianceMinor);
 assert.equal(supervised.externalCashVerified,false);
 assert.ok(supervised.signals.includes("VARIANCE_ABOVE_LIMIT"));
 assert.ok(!supervised.signals.includes("SUPERVISOR_ACK_MISSING"));
 assert.equal(supervised.requiresInvestigation,true,
  "Even acknowledged above-threshold cash variance needs real reconciliation");
 const active=await db.select().from(cashierShift).where(and(
  eq(cashierShift.tenantId,"dev-restaurant"),eq(cashierShift.cashierId,cashierActor[0]!.id),
  eq(cashierShift.status,"open"))).limit(1);
 assert.ok(active[0],"P10 refund suite opened a new active cashier shift");
 const open=(await see("/api/finance/shifts/"+active[0].id+"/reconciliation",cashier)).data;
 assert.equal(open.status,"open_requires_physical_count");
 assert.equal(open.totals.varianceMinor,null);
 assert.ok(open.totals.refundedCashMinor>0,"The P10 cash refund impacts the new shift drawer");
 assert.equal(open.externalCashVerified,false);
 const [auditAfter]=await db.select({n:count()}).from(auditEvent)
  .where(eq(auditEvent.tenantId,"dev-restaurant"));
 assert.equal(auditBefore?.n,auditAfter?.n,"Read-only reconciliation must not create audits");
 const serialized=JSON.stringify(current.data);
 for(const privateField of ["idempotencyKey","requestHash","externalReference","cashierId","customerPhone"])
  assert.equal(serialized.includes(privateField),false,"No private transaction fields: "+privateField);
 console.info("PASS P42 seeded finance: role/tenant isolation, original receipt, closed variance, acknowledged supervision, later refund, independent totals and no writes.");
}
main().then(async()=>{await pool.end();}).catch(async err=>{
 console.error(err);await pool.end();process.exitCode=1;
});
