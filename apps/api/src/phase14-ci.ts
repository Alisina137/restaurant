import "dotenv/config";
import assert from "node:assert/strict";
import {setTimeout as wait} from "node:timers/promises";
import {db,pool} from "./db";
import {eq,and} from "drizzle-orm";
import {tenant,auditEvent} from "./schema";
const ROOT=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
if(process.env.NODE_ENV==="production"||!password)throw new Error("P14 requires seeded disposable CI database.");
async function login(email:string){
 for(let i=0;i<7;i++){
  const r=await fetch(ROOT+"/api/auth/sign-in/email",{method:"POST",headers:{
   "Content-Type":"application/json","Origin":"http://localhost:3000"},
   body:JSON.stringify({email,password})});
  if(r.status===429){await wait(11_000);continue;}
  assert.equal(r.status,200,"Sign in "+email+": "+await r.text());
  return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Sign-in throttled "+email);
}
async function request(path:string,cookie="",method="GET",payload?:unknown){
 const r=await fetch(ROOT+path,{method,headers:{
  "Content-Type":"application/json","Origin":"http://localhost:3000",...(cookie?{Cookie:cookie}:{})},
  body:payload===undefined?undefined:JSON.stringify(payload)});
 return r;
}
async function expect(path:string,cookie:string,status:number,method="GET",payload?:unknown){
 const r=await request(path,cookie,method,payload);
 assert.equal(r.status,status,method+" "+path+": expected "+status+", got "+r.status+" "+await r.clone().text());
 return r;
}
type Pilot={tenantId:string;gates:{key:string;review:{id:number;result:string}|null}[];
 status:string;complete:boolean;ownerSignoff:{id:number;fingerprint:string}|null;
 platformDecision:{id:number;decision:string}|null;fingerprint:string};
async function main(){
 const owner=await login("owner-ci@example.test");
 const platform=await login("platform-ci@example.test");
 const other=await login("new-owner-ci@example.test");
 const [org]=await db.select({id:tenant.id}).from(tenant).where(eq(tenant.id,"dev-restaurant")).limit(1);
 assert.ok(org);
 await expect("/api/pilot","",401);
 await expect("/api/platform/pilots",owner,403);
 await expect("/api/pilot",platform,403);
 const otherState=await(await expect("/api/pilot",other,200)).json() as Pilot;
 assert.notEqual(otherState.tenantId,org!.id,"Different owner cannot access target restaurant");
 const initial=await(await expect("/api/pilot",owner,200)).json() as Pilot;
 assert.equal(initial.tenantId,org!.id);
 assert.equal(initial.gates.length,12);
 assert.equal(initial.status,"blocked");
 await expect("/api/pilot/signoff",owner,409,"POST",{note:"Cannot sign before performing mandatory physical gates."});
 await expect("/api/platform/pilots/"+org!.id+"/decision",platform,409,"POST",
  {decision:"approved",note:"Cannot approve unverified pilot gates or missing owner sign-off."});
 await expect("/api/pilot/gates",owner,400,"POST",{key:"qr",result:"passed",evidence:"Too short"});
 await expect("/api/pilot/gates",owner,400,"POST",{key:"invalid",result:"passed",evidence:"An adequately long test description to be valid."});
 await expect("/api/pilot/gates",platform,403,"POST",{key:"qr",result:"passed",evidence:"Platform cannot impersonate a restaurant owner."});
 for(const item of initial.gates){
  await expect("/api/pilot/gates",owner,201,"POST",{key:item.key,result:"passed",
   evidence:"CI DISPOSABLE DATA ONLY: simulated attestation for "+item.key+". No actual production pilot."});
 }
 const complete=await(await expect("/api/pilot",owner,200)).json() as Pilot;
 assert.equal(complete.complete,true);
 assert.equal(complete.status,"awaiting_owner");
 await expect("/api/platform/pilots/"+org!.id+"/decision",platform,409,"POST",
  {decision:"approved",note:"Two-person review must block approval before owner's signature."});
 await expect("/api/pilot/signoff",owner,201,"POST",{note:"CI-only owner's assertion; no actual device or production testing completed."});
 const signed=await(await expect("/api/pilot",owner,200)).json() as Pilot;
 assert.equal(signed.status,"awaiting_platform");
 await expect("/api/platform/pilots/"+org!.id+"/decision",platform,201,"POST",
  {decision:"hold",note:"CI-only hold exercise: hold is independently auditable."});
 const held=await(await expect("/api/platform/pilots/"+org!.id,platform,200)).json() as Pilot;
 assert.equal(held.status,"held");
 await expect("/api/platform/pilots/"+org!.id+"/decision",platform,201,"POST",
  {decision:"approved",note:"CI-only approval state-machine exercise, not an actual pilot signoff."});
 const approved=await(await expect("/api/pilot",owner,200)).json() as Pilot;
 assert.equal(approved.status,"signed_off");
 assert.ok(approved.ownerSignoff&&approved.platformDecision);
 await expect("/api/pilot/gates",owner,201,"POST",{key:"cash",result:"failed",
  evidence:"CI-only regression: drawer reconciliation failed. Previously issued signatures must become invalid."});
 const stale=await(await expect("/api/pilot",owner,200)).json() as Pilot;
 assert.equal(stale.status,"blocked","An updated/failed gate invalidates both sign-offs");
 await expect("/api/platform/pilots/"+org!.id+"/decision",platform,409,"POST",
  {decision:"approved",note:"Previously approved evidence can no longer pass current gates."});
 const list=await(await expect("/api/platform/pilots",platform,200)).json() as {items:{id:string}[]};
 assert.ok(list.items.some(row=>row.id===org!.id));
 const event=await db.select({id:auditEvent.id}).from(auditEvent)
  .where(and(eq(auditEvent.tenantId,org!.id),eq(auditEvent.action,"pilot.platform_decision"))).limit(1);
 assert.ok(event.length>0,"Platform approval must be audited");
 console.info("PASS P14: scope, required physical gates, stale signature rejection, independent reviews, audit.");
}
main().then(async()=>{await pool.end();}).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
