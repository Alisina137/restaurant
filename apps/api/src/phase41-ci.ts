import "dotenv/config";
import assert from "node:assert/strict";
import {eq} from "drizzle-orm";
import {db,pool} from "./db";
import {pilotGateEvent,pilotSignoffEvent,user} from "./schema";
import {pilotGates} from "./phase14-pilot";

if(process.env.CI!=="true"||process.env.NODE_ENV==="production"||
 !process.env.DATABASE_URL?.includes("localhost:5432/dineflow_ci")||
 !process.env.DEMO_PASSWORD)throw Error("Requires local disposable CI database.");
const api="http://localhost:4000";
async function req(path:string,cookie?:string,body?:unknown){
 return fetch(api+path,{method:body?"POST":"GET",
 headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})},
 body:body?JSON.stringify(body):undefined});
}
async function login(email:string){
 const r=await fetch(api+"/api/auth/sign-in/email",{method:"POST",
 headers:{"Content-Type":"application/json",Origin:"http://localhost:3000"},
 body:JSON.stringify({email,password:process.env.DEMO_PASSWORD})});
 assert.equal(r.status,200);
 return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
}
type Pilot={tenantId:string;complete:boolean;completed:number;status:string;fingerprint:string;
 gates:{key:string;review:{id:number}|null}[];
 ownerSignoff:{id:number;fingerprint:string}|null;platformDecision:{decision:string}|null};
async function main(){
 const owner=await login("new-owner-ci@example.test");
 const platform=await login("platform-ci@example.test");
 const initial=await req("/api/pilot",owner);
 assert.equal(initial.status,200);
 const state=await initial.json() as Pilot;
 assert.notEqual(state.tenantId,"dev-restaurant");
 const [actor]=await db.select({id:user.id}).from(user)
  .where(eq(user.email,"new-owner-ci@example.test")).limit(1);
 const [operator]=await db.select({id:user.id}).from(user)
  .where(eq(user.email,"platform-ci@example.test")).limit(1);
 assert.ok(actor&&operator);
 const evidence="CI-only simulated record for query-depth regression, NOT real pilot evidence.";
 await db.insert(pilotGateEvent).values(pilotGates.map(g=>({
  tenantId:state.tenantId,gateKey:g.key,result:"passed",actorId:actor.id,evidence
 })));
 const rows=await db.insert(pilotGateEvent).values(
  Array.from({length:520},(_,i)=>({
   tenantId:state.tenantId,gateKey:"roles",result:"passed",
   actorId:actor.id,evidence:evidence+i
  }))).returning({id:pilotGateEvent.id});
 const r=await req("/api/pilot",owner);
 const after=await r.json() as Pilot;
 assert.equal(after.completed,12);
 assert.equal(after.complete,true);
 assert.equal(after.gates.find(g=>g.key==="roles")?.review?.id,rows.at(-1)?.id);
 const sign=await req("/api/pilot/signoff",owner,{
  note:"CI-only simulated owner review for evidence deep-history regression."});
 assert.equal(sign.status,201);
 const id=(await sign.json() as {id:number}).id;
 await db.insert(pilotSignoffEvent).values(Array.from({length:58},()=>({
  tenantId:state.tenantId,stage:"platform",decision:"hold",
  actorId:operator.id,ownerSignoffId:id,fingerprint:after.fingerprint,
  note:"CI-only platform hold: not a production pilot approval."
 })));
 const checked=await req("/api/pilot",owner);
 const latest=await checked.json() as Pilot;
 assert.equal(latest.ownerSignoff?.id,id);
 assert.equal(latest.status,"held");
 assert.equal((await req("/api/platform/pilots/"+state.tenantId,platform)).status,200);
 console.info("PASS P41 deep evidence: 520 retests, 58 holds; original latest reviews and owner signature retained.");
}
main().then(async()=>{await pool.end()}).catch(async e=>{
 console.error(e);await pool.end();process.exitCode=1;
});
