import "dotenv/config";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "./db";
import { staffInvitation, tenantMembership, user } from "./schema";

if (process.env.NODE_ENV === "production" || !process.env.DEMO_PASSWORD) {
  throw new Error("P02 integration tests require CI credentials and a nonproduction database");
}
const ROOT=process.env.E2E_API_URL??"http://localhost:4000", PASSWORD=process.env.DEMO_PASSWORD;
async function req(path:string,method="GET",body?:unknown,cookie?:string) {
  return fetch(ROOT+path,{method,headers:{"Content-Type":"application/json",
    Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
async function json<T>(response:Response):Promise<T> {
  return response.json() as Promise<T>;
}
async function signup(name:string,email:string) {
  const res=await req("/api/auth/sign-up/email","POST",{email,name,password:PASSWORD});
  assert.equal(res.status,200,"new verified-email flow can create unprivileged identity: "+await res.text());
  const [person]=await db.select().from(user).where(eq(user.email,email)).limit(1);
  assert.ok(person,"signup created account");
  assert.equal(person.emailVerified,false,"signup does not grant verified status");
  return person.id;
}
async function login(email:string) {
  for(let attempts=0;attempts<5;attempts++){
    const response=await req("/api/auth/sign-in/email","POST",{email,password:PASSWORD});
    if(response.status===429){await new Promise(done=>setTimeout(done,11_000));continue;}
    assert.equal(response.status,200,"valid email can sign in: "+email+" "+await response.text());
    return response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
  }
  throw new Error("Login rate limited beyond retry budget");
}
async function main(){
  const newEmail="new-owner-ci@example.test";
  const newUserId=await signup("New CI Owner",newEmail);
  await db.update(user).set({emailVerified:true}).where(eq(user.id,newUserId));
  const owner=await login(newEmail);
  const status=await json<{mayCreate:boolean;tenantId:string|null}>(await req("/api/onboarding/status","GET",undefined,owner));
  assert.equal(status.mayCreate,true,"verified unassigned account can register a tenant");
  const draft={name:"CI Bistro",slug:"ci-bistro",locationName:"Main",city:"Kabul",
    phone:"",address:"",timezone:"Asia/Kabul",locale:"fa-AF",orderingPolicy:"waiter_approval",
    receiptFooter:"",acceptedTerms:true};
  assert.equal((await req("/api/onboarding/draft","PUT",draft,owner)).status,200,"draft persists");
  const saved=await json<{draft:{name:string}}>(await req("/api/onboarding/draft","GET",undefined,owner));
  assert.equal(saved.draft.name,"CI Bistro");
  const collision=await req("/api/onboarding/complete","POST",{...draft,slug:"demo-restaurant"},owner);
  assert.equal(collision.status,409,"slug uniqueness enforced by database");
  const onboard=await req("/api/onboarding/complete","POST",draft,owner);
  assert.equal(onboard.status,201,"verified owner can create tenant: "+await onboard.clone().text());
  const created=await json<{tenantId:string}>(onboard);
  assert.ok(created.tenantId);
  const again=await json<{created:boolean;tenantId:string}>(await req("/api/onboarding/complete","POST",draft,owner));
  assert.equal(again.created,false,"repeated signup is idempotent");
  assert.equal(again.tenantId,created.tenantId);
  const scoped=await req("/api/tenant/settings","GET",undefined,owner);
  assert.equal(scoped.status,200);
  const change=await req("/api/tenant/settings","PATCH",{name:"CI Bistro Updated",locationName:"Main",
    city:"Kabul",phone:"",address:"",timezone:"Asia/Kabul",locale:"en",
    receiptFooter:"Thank you",managerCanInvite:false},owner);
  assert.equal(change.status,200,"owner may update tenant-local settings");
  const staff=await json<{items:{id:string;role:string;status:string}[]}>(await req("/api/tenant/staff","GET",undefined,owner));
  assert.equal(staff.items.length,1);
  assert.equal(staff.items[0]!.role,"owner");
  const lastOwner=await req("/api/tenant/staff/"+staff.items[0]!.id,"PATCH",{role:"waiter",status:"active"},owner);
  assert.equal(lastOwner.status,403,"cannot demote sole owner");
  const inviteMail="new-waiter-ci@example.test";
  const inviteResp=await req("/api/tenant/invitations","POST",{email:inviteMail,role:"waiter",message:"Join our crew"},owner);
  assert.equal(inviteResp.status,201,"email sent via CI-only console provider: "+await inviteResp.clone().text());
  const invited=await json<{id:string}>(inviteResp);
  const token="test-token-p02-abc1234567890abcdef1234567890";
  await db.update(staffInvitation).set({tokenHash:createHash("sha256").update(token).digest("hex")})
    .where(eq(staffInvitation.id,invited.id));
  assert.equal((await req("/api/invitations/"+token)).status,200,"single-use token permits public preview");
  const invitedId=await signup("CI Waiter",inviteMail);
  await db.update(user).set({emailVerified:true}).where(eq(user.id,invitedId));
  const waiter=await login(inviteMail);
  const accept=await req("/api/invitations/"+token+"/accept","POST",{},waiter);
  assert.equal(accept.status,200,"verified matching email accepts invitation: "+await accept.clone().text());
  const reused=await req("/api/invitations/"+token+"/accept","POST",{},waiter);
  assert.equal(reused.status,409,"single-use invite cannot be accepted twice");
  const waiterContext=await json<{tenantId:string;role:string}>(await req("/api/context","GET",undefined,waiter));
  assert.equal(waiterContext.tenantId,created.tenantId);
  assert.equal(waiterContext.role,"waiter");
  const member=await db.select().from(tenantMembership)
    .where(and(eq(tenantMembership.tenantId,created.tenantId),eq(tenantMembership.userId,invitedId))).limit(1);
  assert.equal(member.length,1);
  assert.equal((await req("/api/tenant/settings","GET",undefined,waiter)).status,403,"waiter cannot edit tenant settings");
  const revoke=await req("/api/tenant/staff/"+member[0]!.id,"PATCH",{role:"waiter",status:"disabled"},owner);
  assert.equal(revoke.status,200,"owner may revoke waiter");
  assert.equal((await req("/api/context","GET",undefined,waiter)).status,403,"revoke prevents access immediately");
  const oldOwner=await login("owner-ci@example.test");
  const foreignMember=await req("/api/tenant/staff/"+member[0]!.id,"PATCH",{role:"manager",status:"active"},oldOwner);
  assert.equal(foreignMember.status,404,"owner cannot mutate another tenant's staff");
  const platform=await login("platform-ci@example.test");
  const platformList=await json<{items:{id:string}[]}>(await req("/api/platform/restaurants","GET",undefined,platform));
  assert.ok(platformList.items.some(t=>t.id===created.tenantId),"platform sees new tenant metadata");
  assert.equal((await req("/api/platform/restaurants/"+created.tenantId,"GET",undefined,platform)).status,200);
  assert.equal((await req("/api/platform/restaurants","GET",undefined,owner)).status,403,"restaurant owner cannot read platform listing");
  console.info("PASS P02: verified signup, resumable draft, atomic tenant creation, slug collision, settings, last-owner guard, invitation acceptance, revoke and tenant isolation, platform oversight.");
}
main().then(async()=>{await pool.end();}).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
