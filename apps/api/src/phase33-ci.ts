import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq} from "drizzle-orm";
import {db,pool} from "./db";
import {auditEvent,pilotIncident,pilotIncidentEvent} from "./schema";

if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw Error("P33 incident integration only runs on seeded disposable nonproduction PostgreSQL.");
const base=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(base+path,{method,headers:{
  "Content-Type":"application/json",Origin:"http://localhost:3000",
  ...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(response:Response,status:number):Promise<T>{
 const text=await response.text();
 assert.equal(response.status,status,response.url+": "+text);
 return JSON.parse(text) as T;
}
async function login(email:string){
 for(let attempt=0;attempt<7;attempt++){
  const r=await request("/api/auth/sign-in/email","POST",{email,password});
  if(r.status===429){await new Promise(resolve=>setTimeout(resolve,11000));continue;}
  assert.equal(r.status,200,email+": "+await r.text());
  return r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw Error("P33 seed sign-in throttled");
}
type Pilot={status:string;complete:boolean;fingerprint:string;
 incidents:{total:number;open:number;blocking:number};
 ownerSignoff:{fingerprint:string}|null};
type Incident={id:string;version:number;status:string};
type Row={id:string;status:string;severity:string;gateKey:string;version:number};
type Page={items:Row[];total:number;page:number;perPage:number;status:string;severity:string};
type Events={incidentId:string;version:number;events:{id:number;version:number;action:string}[]};
async function main(){
 const [owner,waiter,kitchen,cashier,platform,other]=await Promise.all([
  login("owner-ci@example.test"),login("waiter-ci@example.test"),
  login("kitchen-ci@example.test"),login("cashier-ci@example.test"),
  login("platform-ci@example.test"),login("new-owner-ci@example.test")
 ]);
 const root="/api/pilot/incidents";
 for(const path of [root,root+"?status=all"]){
  assert.equal((await request(path)).status,401);
  for(const cookie of [waiter,kitchen,cashier,platform])
   assert.equal((await request(path,"GET",undefined,cookie)).status,403);
 }
 for(const query of ["?page=0","?page=1001","?page=1.25",
  "?status=unknown","?severity=p4"]){
  assert.equal((await request(root+query,"GET",undefined,owner)).status,400);
 }
 const before=await expect<Pilot>(await request("/api/pilot","GET",undefined,owner),200);
 assert.equal(before.incidents.total,0,"P33 seeded fixture starts without incidents");
 for(const payload of [
  {severity:"p3",gateKey:"orders",title:"Kitchen froze",details:"Actual P33 disposable test description"},
  {severity:"p0",gateKey:"unknown",title:"Kitchen froze",details:"Actual P33 disposable test description"},
  {severity:"p0",gateKey:"orders",title:"X",details:"Actual P33 disposable test description"},
  {severity:"p0",gateKey:"orders",title:"Kitchen froze",details:"too short"}
 ]){
  assert.equal((await request(root,"POST",payload,owner)).status,400);
 }
 const basePayload={severity:"p0",gateKey:"orders",title:"Kitchen ticket delivery uncertainty",
  details:"DISPOSABLE CI OBSERVATION ONLY: kitchen device did not confirm foreground rendering."};
 assert.equal((await request(root,"POST",basePayload,waiter)).status,403);
 assert.equal((await request(root,"POST",basePayload,platform)).status,403);
 const first=await expect<Incident>(await request(root,"POST",basePayload,owner),201);
 assert.match(first.id,/^[\da-f-]{36}$/i);
 assert.equal(first.version,1);assert.equal(first.status,"open");
 const afterOpen=await expect<Pilot>(await request("/api/pilot","GET",undefined,owner),200);
 assert.equal(afterOpen.incidents.blocking,1);
 assert.equal(afterOpen.incidents.open,1);
 assert.notEqual(afterOpen.fingerprint,before.fingerprint,
  "Opening incident invalidates all earlier recorded signatures");
 assert.equal(afterOpen.status,"blocked");
 const platformState=await expect<Pilot>(
  await request("/api/platform/pilots/dev-restaurant","GET",undefined,platform),200);
 assert.equal(platformState.incidents.blocking,1,"Platform reviewer sees true blockers, not private notes");
 const otherState=await expect<Pilot>(await request("/api/pilot","GET",undefined,other),200);
 assert.equal(otherState.incidents.total,0,"Second restaurant sees no foreign incidents");
 assert.equal((await request(root+"/"+first.id+"/events","GET",undefined,other)).status,404);
 assert.equal((await request(root+"/"+first.id+"/resolve","POST",{
  expectedVersion:1,note:"UNAUTHORIZED tenant attempted to resolve test incident, blocked."},other)).status,404);
 const wrong=randomUUID();
 assert.equal((await request(root+"/"+wrong+"/events","GET",undefined,owner)).status,404);
 const openedHistory=await expect<Events>(await request(
  root+"/"+first.id+"/events","GET",undefined,owner),200);
 assert.deepEqual(openedHistory.events.map(e=>e.action),["opened"]);
 // Existing P14 CI intentionally left 'cash' failed. Re-attest every gate as
 // a fixture, but a new P0 must STILL deny owner AND platform signoff.
 await expect<unknown>(await request("/api/pilot/gates","POST",{
  key:"cash",result:"passed",evidence:
   "DISPOSABLE CI RETEST ONLY: synthetic cash evidence is not a physical drawer test."
 },owner),201);
 const gateComplete=await expect<Pilot>(await request("/api/pilot","GET",undefined,owner),200);
 assert.equal(gateComplete.complete,true);
 assert.equal(gateComplete.incidents.blocking,1);
 assert.equal((await request("/api/pilot/signoff","POST",{
  note:"Attempt to sign physical service after CI gates passed but P0 still open."},owner)).status,409);
 assert.equal((await request("/api/platform/pilots/dev-restaurant/decision","POST",{
  decision:"approved",note:"Cannot bypass a real unresolved P0 with synthetic gate results."},platform)).status,409);
 assert.equal((await request(root+"/"+first.id+"/resolve","POST",{
  expectedVersion:1,note:"No unauthorized resolution for kitchen team."},waiter)).status,403);
 assert.equal((await request(root+"/"+first.id+"/resolve","POST",{
  expectedVersion:1,note:"Short."},owner)).status,400);
 assert.equal((await request(root+"/"+first.id+"/resolve","POST",{
  expectedVersion:22,note:"CI only, simulated retest and incident resolution with synthetic evidence link."},owner)).status,409);
 // P33: full-page bounded read, owner-only resolution; P2 items do not block.
 for(let i=0;i<11;i++){
  const result=await expect<Incident>(await request(root,"POST",{
   severity:"p2",gateKey:"devices",
   title:"Secondary tablet layout issue "+i,
   details:"CI-only tablet layout observation "+i+"; no actual physical device was tested."
  },owner),201);
  assert.equal(result.status,"open");
 }
 const list=await expect<Page>(await request(root+"?status=open&page=1","GET",undefined,owner),200);
 const page2=await expect<Page>(await request(root+"?status=open&page=2","GET",undefined,owner),200);
 assert.equal(list.total,12);assert.equal(page2.total,12);
 assert.equal(list.items.length,10);assert.equal(page2.items.length,2);
 assert.equal(new Set([...list.items,...page2.items].map(x=>x.id)).size,12);
 const p0Only=await expect<Page>(await request(root+"?severity=p0","GET",undefined,owner),200);
 assert.equal(p0Only.total,1);
 assert.equal(p0Only.items[0]?.id,first.id);
 assert.equal((await expect<Page>(await request(root+"?severity=p0","GET",undefined,other),200)).total,0);
 // Tenant-locked optimistic concurrency: only one of four can acknowledge.
 const updates=await Promise.all(Array.from({length:4},()=>request(
  root+"/"+first.id+"/resolve","POST",{
   expectedVersion:1,
   note:"CI synthetic retest: reported kitchen gap resolved in test fixture; no real-device evidence."
  },owner)));
 assert.equal(updates.filter(x=>x.status===200).length,1,"Exactly one concurrent incident resolution");
 assert.equal(updates.filter(x=>x.status===409).length,3,"Stale versions rejected");
 const resolved=await expect<Page>(await request(root+"?status=resolved","GET",undefined,owner),200);
 assert.equal(resolved.total,1);assert.equal(resolved.items[0]?.version,2);
 const changed=await expect<Pilot>(await request("/api/pilot","GET",undefined,owner),200);
 assert.equal(changed.incidents.blocking,0);
 assert.equal(changed.incidents.open,11,"Open P2 follow-ups do not block signoff");
 assert.equal(changed.status,"awaiting_owner","Incident changes invalidate original signatures");
 await expect<unknown>(await request("/api/pilot/signoff","POST",{
  note:"CI fixture signoff after synthetic incident resolution; real shift remains unperformed."
 },owner),201);
 await expect<unknown>(await request("/api/platform/pilots/dev-restaurant/decision","POST",{
  decision:"approved",note:"CI-only state-machine approval, NOT an actual operator or physical pilot certification."
 },platform),201);
 const approved=await expect<Pilot>(await request("/api/pilot","GET",undefined,owner),200);
 assert.equal(approved.status,"signed_off","Only manually recorded CI assertions are signed");
 // After approval a reopened P0 must immediately void owner AND platform approval.
 const reopen=await expect<Incident>(await request(root+"/"+first.id+"/reopen","POST",{
  expectedVersion:2,note:"DISPOSABLE CI regression: repeat observation indicates unresolved kitchen gap."
 },owner),200);
 assert.equal(reopen.version,3);
 const blocked=await expect<Pilot>(await request("/api/pilot","GET",undefined,owner),200);
 assert.equal(blocked.status,"blocked");assert.equal(blocked.incidents.blocking,1);
 assert.notEqual(blocked.fingerprint,approved.fingerprint);
 assert.equal((await request("/api/platform/pilots/dev-restaurant/decision","POST",{
  decision:"approved",note:"Cannot reuse an owner signoff after the P0 reopened."},platform)).status,409);
 const history=await expect<Events>(await request(root+"/"+first.id+"/events","GET",undefined,owner),200);
 assert.equal(history.version,3);
 assert.deepEqual(history.events.map(x=>x.action),["reopened","resolved","opened"]);
 assert.deepEqual(history.events.map(x=>x.version),[3,2,1]);
 const rows=await db.select({version:pilotIncidentEvent.version})
  .from(pilotIncidentEvent).where(and(eq(pilotIncidentEvent.tenantId,"dev-restaurant"),
   eq(pilotIncidentEvent.incidentId,first.id)));
 assert.equal(rows.length,3,"All 3 immutable incident revisions are retained");
 for(const action of ["pilot.incident_opened","pilot.incident_resolved","pilot.incident_reopened"]){
  const log=await db.select({id:auditEvent.id}).from(auditEvent)
   .where(and(eq(auditEvent.tenantId,"dev-restaurant"),eq(auditEvent.action,action))).limit(1);
  assert.ok(log.length,action+" audit record missing");
 }
 const [stored]=await db.select({status:pilotIncident.status,version:pilotIncident.version})
  .from(pilotIncident).where(eq(pilotIncident.id,first.id)).limit(1);
 assert.equal(stored?.status,"open");assert.equal(stored?.version,3);
 console.info("PASS P33 live: tenant separation, immutable incident history, owner-only retest, 10-row pagination, concurrent versions and P0/P1 release block invalidating signatures.");
}
main().then(async()=>{await pool.end();}).catch(async err=>{
 console.error(err);await pool.end();process.exitCode=1;
});
