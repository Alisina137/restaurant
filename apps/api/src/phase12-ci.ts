
import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq,isNull,sql} from "drizzle-orm";
import {db,pool} from "./db";
import {diningTable,tenantMembership,user} from "./schema";
import {saasInvoice,saasPaymentClaim,saasSupportGrant,saasSubscription} from "./phase12-schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P12 tests run only with disposable CI/development credentials.");
const base=process.env.E2E_API_URL??"http://localhost:4000";
async function call(path:string,method="GET",body?:object,cookie?:string){
 return fetch(base+path,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
  ...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
async function signIn(email:string){
 for(let attempt=0;attempt<10;attempt++){
  const r=await call("/api/auth/sign-in/email","POST",{email,password:process.env.DEMO_PASSWORD});
  if(r.status===429){await new Promise(done=>setTimeout(done,11000));continue;}
  assert.equal(r.status,200,email+": "+await r.text());
  return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw Error("Rate limit remained active: "+email);
}
async function get<T>(response:Response,status=200):Promise<T>{
 const raw=await response.text();let data:unknown;
 try{data=JSON.parse(raw);}catch{data=raw;}
 assert.equal(response.status,status,JSON.stringify(data));
 return data as T;
}
async function main(){
 const platform=await signIn("platform-ci@example.test"),
  owner=await signIn("owner-ci@example.test"),
  other=await signIn("new-owner-ci@example.test"),
  cashier=await signIn("cashier-ci@example.test");
 const sub=await get<{subscription:{planId:string},canChange:boolean}>(
  await call("/api/saas/subscription","GET",undefined,owner));
 assert.ok(sub.subscription.planId);assert.equal(sub.canChange,true);
 assert.equal((await call("/api/saas/subscription","GET",undefined,cashier)).status,403);
 assert.equal((await call("/api/platform/plans","GET",undefined,owner)).status,403);
 assert.equal((await call("/api/platform/overview","GET",undefined,platform)).status,200);
 const planCode="p12-"+randomUUID().slice(0,8);
 const plan={code:planCode,name:"CI Paid Pilot",priceMinor:5000,periodDays:30,staffLimit:99,
  tableLimit:999,locationLimit:1};
 const first=await get<{plan:{id:string;version:number}}>(await call("/api/platform/plans",
  "POST",plan,platform),201);
 assert.equal(first.plan.version,1);
 const second=await get<{plan:{id:string;version:number}}>(await call("/api/platform/plans",
  "POST",{...plan,priceMinor:5500},platform),201);
 assert.equal(second.plan.version,2);
 await get(await call("/api/platform/tenants/dev-restaurant/plan","POST",
  {planId:second.plan.id},platform));
 const invoice=await get<{invoice:{id:string;number:string;amountMinor:number;status:string}}>(
  await call("/api/platform/invoices","POST",{tenantId:"dev-restaurant"},platform),201);
 assert.equal(invoice.invoice.amountMinor,5500);assert.equal(invoice.invoice.status,"draft");
 await get(await call("/api/platform/invoices/"+invoice.invoice.id+"/issue","POST",{},platform));
 const foreign=await call("/api/saas/invoices/"+invoice.invoice.id,"GET",undefined,other);
 assert.equal(foreign.status,404,"Other tenant must not read invoice.");
 assert.equal((await call("/api/saas/invoices/"+invoice.invoice.id+"/proof","POST",
  {method:"bank_transfer",reference:"foreign",proofNote:"Not my invoice"},other)).status,404);
 const proof=await get<{id:string;status:string}>(
  await call("/api/saas/invoices/"+invoice.invoice.id+"/proof","POST",
   {method:"bank_transfer",reference:"P12-"+randomUUID(),proofNote:"Test bank receipt number and payee confirmed."},
   owner),201);
 assert.equal(proof.status,"pending");
 const [notPaid]=await db.select({status:saasInvoice.status}).from(saasInvoice)
  .where(eq(saasInvoice.id,invoice.invoice.id));
 assert.equal(notPaid?.status,"issued","Payment proof alone must never settle invoice.");
 assert.equal((await call("/api/saas/invoices/"+invoice.invoice.id+"/proof","POST",
  {method:"cash",reference:"duplicate",proofNote:"Should be blocked while pending"},owner)).status,409);
 assert.equal((await call("/api/platform/payments/"+proof.id+"/review","POST",
  {decision:"verify"},cashier)).status,403);
 await get(await call("/api/platform/payments/"+proof.id+"/review","POST",
  {decision:"verify"},platform));
 const [paid]=await db.select({status:saasInvoice.status}).from(saasInvoice)
  .where(eq(saasInvoice.id,invoice.invoice.id));
 const [verified]=await db.select({status:saasPaymentClaim.status}).from(saasPaymentClaim)
  .where(eq(saasPaymentClaim.id,proof.id));
 assert.equal(paid?.status,"paid");assert.equal(verified?.status,"verified");
 assert.equal((await call("/api/platform/payments/"+proof.id+"/review","POST",
  {decision:"verify"},platform)).status,409,"Double verification must fail.");
 const board=await get<{sections:{id:string}[];tables:{id:string;assignedWaiterId:string|null}[]}>(
  await call("/api/floor/tables/board","GET",undefined,owner));
 assert.ok(board.sections.length>0,"P04 section is needed for P12 entitlement test.");
 const [waiter]=await db.select({id:user.id}).from(tenantMembership)
  .innerJoin(user,eq(user.id,tenantMembership.userId))
  .where(and(eq(tenantMembership.tenantId,"dev-restaurant"),eq(tenantMembership.role,"waiter"),
   eq(tenantMembership.status,"active"))).limit(1);
 assert.ok(waiter,"P04 restores demo waiter");
 const baseTable={sectionId:board.sections[0]!.id,seats:4,sortOrder:999,
  notes:"P12 disposable acceptance",active:true,assignedWaiterId:waiter.id};
 const createTable=(label:string)=>call("/api/floor/tables","POST",{...baseTable,label},owner);
 const a=await get<{id:string}>(await createTable("P12A-"+randomUUID().slice(0,4)),201);
 const b=await get<{id:string}>(await createTable("P12B-"+randomUUID().slice(0,4)),201);
 const [{n:tableCount}]=await db.select({n:sql<number>`COUNT(*)::integer`}).from(diningTable)
  .where(and(eq(diningTable.tenantId,"dev-restaurant"),isNull(diningTable.archivedAt)));
 assert.ok(tableCount>=2);
 const tight=await get<{plan:{id:string}}>(await call("/api/platform/plans","POST",
  {...plan,code:planCode+"-tight",priceMinor:5500,tableLimit:tableCount},platform),201);
 await get(await call("/api/platform/tenants/dev-restaurant/plan","POST",{planId:tight.plan.id},platform));
 assert.equal((await createTable("P12C-"+randomUUID().slice(0,4))).status,409,
  "New tables must enforce plan ceiling.");
 await get(await call("/api/platform/tenants/dev-restaurant/plan","POST",{planId:second.plan.id},platform));
 const tooSmall=await get<{plan:{id:string}}>(await call("/api/platform/plans","POST",
  {...plan,code:planCode+"-small",staffLimit:1},platform),201);
 assert.equal((await call("/api/platform/tenants/dev-restaurant/plan","POST",
  {planId:tooSmall.plan.id},platform)).status,409,"Cannot downsize below active staff count.");
 const visit=await get<{visit:{id:string}}>(
  await call("/api/floor/visits/tables/"+a.id+"/open","POST",{partySize:2},owner),201);
 await get(await call("/api/platform/tenants/dev-restaurant/suspend","POST",
  {reason:"P12 suspension lifecycle test"},platform));
 assert.equal((await call("/api/context","GET",undefined,owner)).status,200,
  "Suspended tenant owners retain access to existing operations.");
 assert.equal((await call("/api/floor/visits/"+visit.visit.id,"GET",undefined,owner)).status,200,
  "Existing visit remains readable during suspension.");
 assert.equal((await call("/api/finance/checks","GET",undefined,cashier)).status,200,
  "Cashier can reach check settlement during suspension.");
 assert.equal((await call("/api/floor/visits/tables/"+b.id+"/open","POST",
  {partySize:2},owner)).status,409,"New visits must be blocked after platform suspension.");
 await get(await call("/api/platform/tenants/dev-restaurant/restore","POST",
  {reason:"Verified invoice and pilot service restoration"},platform));
 await get(await call("/api/floor/visits/tables/"+b.id+"/open","POST",{partySize:2},owner),201);
 const ticket=await get<{id:string}>(await call("/api/support/tickets","POST",
  {category:"billing",priority:"normal",subject:"Test invoice",message:"Please review subscription terms."},
  owner),201);
 assert.equal((await call("/api/support/tickets/"+ticket.id,"GET",undefined,other)).status,404,
  "Tenant support conversations must be private.");
 assert.equal((await call("/api/support/tickets/"+ticket.id,"GET",undefined,platform)).status,200);
 const grant=await get<{id:string}>(await call("/api/support/grants","POST",
  {tenantId:"dev-restaurant",reason:"CI request metadata debugging only"},platform),201);
 assert.equal((await call("/api/support/grants/"+grant.id+"/metadata","GET",undefined,platform)).status,403);
 assert.equal((await call("/api/support/grants/"+grant.id+"/review","POST",
  {decision:"approve"},other)).status,404);
 await get(await call("/api/support/grants/"+grant.id+"/review","POST",
  {decision:"approve"},owner));
 const metadata=await get<{restaurant:{name:string;slug:string},locations:number}>(
  await call("/api/support/grants/"+grant.id+"/metadata","GET",undefined,platform));
 assert.ok(metadata.restaurant.name);assert.ok(!("orders" in metadata));
 await get(await call("/api/support/grants/"+grant.id+"/review","POST",
  {decision:"revoke"},owner));
 assert.equal((await call("/api/support/grants/"+grant.id+"/metadata","GET",undefined,platform)).status,403);
 const [revoked]=await db.select().from(saasSupportGrant).where(eq(saasSupportGrant.id,grant.id));
 assert.equal(revoked?.status,"revoked");
 const ownerAudit=await get<{items:{action:string}[]}>(
  await call("/api/platform/audit?action=saas.payment_verified","GET",undefined,platform));
 assert.ok(ownerAudit.items.length>0);
 assert.equal((await call("/api/platform/audit","GET",undefined,owner)).status,403);
 console.info("PASS P12: immutable plan versions, proof awaiting independent verification, single-invoice settlement, tenant isolation, table/staff limits, suspension grace-safe service and owner-approved expiring support grants.");
}
void main().then(async()=>{await pool.end();}).catch(async e=>{
 console.error(e);await pool.end();process.exitCode=1;
});
