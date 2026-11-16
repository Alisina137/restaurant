import "dotenv/config";
import assert from "node:assert/strict";
import {eq,and} from "drizzle-orm";
import {db,pool} from "./db";
import {tenant,tenantMembership,user,subscriptionInvoice,invoiceProof} from "./schema";
const ROOT=process.env.E2E_API_URL??"http://localhost:4000",PASSWORD=process.env.DEMO_PASSWORD;
if(process.env.NODE_ENV==="production"||!PASSWORD)throw new Error("P12 integration requires disposable CI DB and DEMO_PASSWORD");
async function req(path:string,cookie:string,method="GET",body?:unknown){
 return fetch(ROOT+path,{method,headers:{"Content-Type":"application/json",
  Origin:"http://localhost:3000",Cookie:cookie},
  body:body===undefined?undefined:JSON.stringify(body)});
}
async function read<T>(r:Response):Promise<T>{return r.json() as Promise<T>;}
async function expect(path:string,cookie:string,status:number,method="GET",body?:unknown){
 const r=await req(path,cookie,method,body);
 assert.equal(r.status,status,`${method} ${path}: expected ${status}, got ${r.status}. ${await r.clone().text()}`);
 return r;
}
async function login(email:string){
 for(let i=0;i<5;i++){
  const r=await fetch(ROOT+"/api/auth/sign-in/email",{method:"POST",
   headers:{"Content-Type":"application/json",Origin:"http://localhost:3000"},
   body:JSON.stringify({email,password:PASSWORD})});
  if(r.status===429){await new Promise(done=>setTimeout(done,11000));continue;}
  assert.equal(r.status,200,"Sign in: "+email+" "+await r.text());
  return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Unable to log in "+email);
}
async function main(){
 const platform=await login("platform-ci@example.test"),owner=await login("new-owner-ci@example.test"),
  foreign=await login("owner-ci@example.test");
 const [org]=await db.select({id:tenant.id}).from(tenant).where(eq(tenant.slug,"ci-bistro")).limit(1);
 assert.ok(org,"P02 tenant exists");
 const tid=org!.id;
 const overview=await read<{tenants:number}>(await expect("/api/platform/overview",platform,200));
 assert.ok(overview.tenants>=2,"platform sees two tenants");
 await expect("/api/platform/overview",owner,403);
 await expect("/api/subscription",platform,403);
 const subscription=await read<{subscription:{status:string;planId:string}|null}>(await expect("/api/subscription",owner,200));
 assert.equal(subscription.subscription?.status,"trial","new tenant starts trial");
 await expect("/api/platform/settings",owner,403);
 const planList=await read<{items:{id:string;planKey:string}[]}>(await expect("/api/platform/plans",platform,200));
 assert.ok(planList.items.some(x=>x.id==="growth-v1"));
 const invoice=await read<{id:string;number:string}>(await expect("/api/platform/invoices",platform,201,"POST",
  {tenantId:tid,planId:"growth-v1",dueDays:14}));
 const initial=await read<{invoice:{status:string;amountMinor:number}}>(await expect(
  "/api/subscription/invoices/"+invoice.id,owner,200));
 assert.equal(initial.invoice.status,"issued");
 assert.equal(initial.invoice.amountMinor,199000);
 await expect("/api/subscription/invoices/"+invoice.id,foreign,404,"GET");
 const reference="P12-TEST-REFERENCE-10001";
 const proof=await read<{id:string;status:string}>(await expect(
  "/api/subscription/invoices/"+invoice.id+"/proofs",owner,201,"POST",
  {reference,method:"bank_transfer",amountMinor:199000,note:"CI transfer proof entered manually"}));
 assert.equal(proof.status,"pending");
 await expect("/api/subscription/invoices/"+invoice.id+"/proofs",owner,409,"POST",
  {reference:"OTHER",method:"cash",amountMinor:199000});
 const preReview=await read<{invoice:{status:string}}>(await expect("/api/subscription/invoices/"+invoice.id,owner,200));
 assert.equal(preReview.invoice.status,"issued","pending evidence must not count as paid");
 await expect("/api/platform/payments/"+proof.id+"/review",owner,403,"POST",
  {decision:"verify",reason:"Not authorized"});
 await expect("/api/platform/payments/"+proof.id+"/review",platform,200,"POST",
  {decision:"verify",reason:"Confirmed against external bank statement"});
 const paid=await read<{invoice:{status:string;paidAt:string}}>(await expect("/api/subscription/invoices/"+invoice.id,owner,200));
 assert.equal(paid.invoice.status,"paid");assert.ok(paid.invoice.paidAt);
 const after=await read<{subscription:{status:string;planId:string}}>(await expect("/api/subscription",owner,200));
 assert.equal(after.subscription.status,"active");assert.equal(after.subscription.planId,"growth-v1");
 // A reference already verified cannot be used for another invoice.
 const invoice2=await read<{id:string}>(await expect("/api/platform/invoices",platform,201,"POST",
  {tenantId:tid,planId:"growth-v1",dueDays:14}));
 const duplicate=await read<{id:string}>(await expect(
  "/api/subscription/invoices/"+invoice2.id+"/proofs",owner,201,"POST",
  {reference,method:"bank_transfer",amountMinor:199000}));
 await expect("/api/platform/payments/"+duplicate.id+"/review",platform,409,"POST",
  {decision:"verify",reason:"Deliberately duplicate reference"});
 const stillUnpaid=await read<{invoice:{status:string}}>(await expect(
  "/api/subscription/invoices/"+invoice2.id,owner,200));
 assert.equal(stillUnpaid.invoice.status,"issued");

 const restricted=await read<{id:string;version:number}>(await expect("/api/platform/plans",platform,201,"POST",
  {planKey:"ci_restricted",name:"CI Restricted",priceMinor:50000,periodDays:30,maxTables:1,maxStaff:2,maxLocations:1}));
 assert.equal(restricted.version,1);
 await expect("/api/platform/tenants/"+tid+"/plan",platform,200,"POST",{planId:restricted.id});
 // P02 invited waiter was disabled: reactivate for a realistic assigned table.
 const [waiter]=await db.select({id:user.id}).from(user).where(eq(user.email,"new-waiter-ci@example.test")).limit(1);
 assert.ok(waiter);
 await db.update(tenantMembership).set({status:"active"}).where(and(eq(tenantMembership.tenantId,tid),
   eq(tenantMembership.userId,waiter!.id)));
 await expect("/api/tenant/invitations",owner,409,"POST",
  {email:"another-p12-staff@example.test",role:"waiter",message:"Over quota"});
 const section=await read<{id:string}>(await expect("/api/floor/sections",owner,201,"POST",{name:"P12 CI dining"}));
 const table=await read<{id:string}>(await expect("/api/floor/tables",owner,201,"POST",
  {sectionId:section.id,label:"P12-1",seats:4,active:true,assignedWaiterId:waiter!.id}));
 await expect("/api/floor/tables",owner,409,"POST",
  {sectionId:section.id,label:"P12-2",seats:4,active:true,assignedWaiterId:waiter!.id});
 const visit=await read<{visit:{id:string};created:boolean}>(await expect(
  "/api/floor/visits/tables/"+table.id+"/open",owner,201,"POST",{partySize:2}));
 assert.ok(visit.created);
 await expect("/api/platform/tenants/"+tid+"/status",platform,200,"POST",
  {action:"suspend",reason:"Pilot safety lock test"});
 // Suspended owners retain access so existing visits can be closed safely.
 await expect("/api/context",owner,200);
 await expect("/api/floor/visits/"+visit.visit.id+"/finish",owner,200,"POST",
  {reason:"Close existing pilot visit"});
 await expect("/api/floor/visits/tables/"+table.id+"/open",owner,403,"POST",{partySize:2});
 await expect("/api/platform/tenants/"+tid+"/status",platform,200,"POST",
  {action:"restore",reason:"Verified active payment period"});
 const restored=await read<{subscription:{status:string}}>(await expect("/api/subscription",owner,200));
 assert.equal(restored.subscription.status,"active");
 const ticket=await read<{id:string}>(await expect("/api/subscription/tickets",owner,201,"POST",
  {kind:"technical",priority:"high",subject:"P12 acceptance support request",message:"Please verify a pilot setting."}));
 await expect("/api/subscription/tickets/"+ticket.id,owner,200);
 await expect("/api/subscription/tickets/"+ticket.id,foreign,404);
 await expect("/api/platform/support/tickets/"+ticket.id,platform,200);
 await expect("/api/platform/support/tickets/"+ticket.id,platform,200,"POST",
  {status:"in_progress",message:"Support triage recorded."});
 const grant=await read<{id:string}>(await expect("/api/subscription/grants",owner,201,"POST",
  {scope:"configuration_metadata",reason:"Review restaurant timezone for this case",minutes:1}));
 const meta=await read<{settings:{timezone:string}}>(await expect(
  "/api/platform/support/grants/"+grant.id+"/metadata",platform,200));
 assert.ok(meta.settings.timezone);
 await expect("/api/reports/sales",platform,403,"GET");
 await expect("/api/subscription/grants/"+grant.id+"/revoke",owner,200,"POST",{});
 await expect("/api/platform/support/grants/"+grant.id+"/metadata",platform,403);
 await expect("/api/platform/audit",owner,403);
 const audit=await read<{items:{action:string}[]}>(await expect("/api/platform/audit",platform,200));
 assert.ok(audit.items.some(x=>x.action==="platform.payment_verify"));
 const settings=await read<{trialDays:number;graceDays:number}>(await expect("/api/platform/settings",platform,200));
 await expect("/api/platform/settings",platform,400,"PATCH",
  {...settings,incidentBanner:"",supportEmail:"",confirm:false});
 await expect("/api/platform/settings",platform,200,"PATCH",
  {trialDays:settings.trialDays,graceDays:settings.graceDays,incidentBanner:"",supportEmail:"",confirm:true});
 const [ledger]=await db.select({status:subscriptionInvoice.status}).from(subscriptionInvoice)
  .where(eq(subscriptionInvoice.id,invoice.id)).limit(1);
 const proofs=await db.select({status:invoiceProof.status}).from(invoiceProof).where(eq(invoiceProof.invoiceId,invoice.id));
 assert.equal(ledger?.status,"paid");assert.equal(proofs.filter(x=>x.status==="verified").length,1);
 console.info("PASS P12: platform guards, trial, invoice snapshots, pending proof, verified payment, duplicate reference, quotas, existing visit closure while suspended, restore, tenant isolation, support grants and policy audit.");
}
main().then(async()=>{await pool.end();}).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
