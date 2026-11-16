import "dotenv/config";
import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";
import {eq} from "drizzle-orm";
import {db,pool} from "./db";
import {orderOutbox,orderRevision} from "./schema";

const ROOT=process.env.E2E_API_URL??"http://localhost:4000";
const password=process.env.DEMO_PASSWORD;
if(process.env.NODE_ENV==="production"||!password)
 throw new Error("P13 integration tests require a disposable CI database and DEMO_PASSWORD.");
async function request(path:string,init?:RequestInit){
 return fetch(ROOT+path,{...init,headers:{"Origin":"http://localhost:3000",...(init?.headers??{})}});
}
async function login(email:string){
 for(let i=0;i<6;i++){
  const r=await request("/api/auth/sign-in/email",{method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({email,password})});
  if(r.status===429){await delay(11_000);continue;}
  assert.equal(r.status,200,email+" sign in: "+await r.text());
  return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Rate limited sign-in "+email);
}
async function main(){
 const ready=await request("/api/health/ready",{headers:{"X-Request-ID":"phase13-readiness"}});
 assert.equal(ready.status,200,"PostgreSQL readiness");
 assert.equal(ready.headers.get("X-Request-ID"),"phase13-readiness");
 assert.equal(ready.headers.get("X-Content-Type-Options"),"nosniff");
 assert.equal(ready.headers.get("Cache-Control"),"no-store");
 assert.equal(ready.headers.get("Referrer-Policy"),"no-referrer");
 assert.equal(ready.headers.get("X-Frame-Options"),"DENY");
 const untrusted=await fetch(ROOT+"/api/health",{headers:{Origin:"https://attacker.example"}});
 assert.equal(untrusted.headers.get("Access-Control-Allow-Origin"),null,
  "CORS must not expose authenticated API to an untrusted browser origin");
 const invalid=await request("/api/does-not-exist");
 assert.equal(invalid.status,404);
 assert.equal((await invalid.json() as {code:string}).code,"NOT_FOUND");
 assert.equal((await request("/api/health/operations")).status,401);
 const owner=await login("owner-ci@example.test");
 const platform=await login("platform-ci@example.test");
 assert.equal((await request("/api/health/operations",{headers:{Cookie:owner}})).status,403,
  "restaurant users cannot inspect platform operational metadata");
 const ops=await request("/api/health/operations",{headers:{Cookie:platform}});
 assert.equal(ops.status,200);
 const status=await ops.json() as {pendingOutbox:number;polling:string};
 assert.ok(Number.isInteger(status.pendingOutbox));
 assert.equal(status.polling,"database_revision");
 // Simulate a crash between an accepted event and its revision reconciliation.
 const [event]=await db.select({id:orderOutbox.id,locationId:orderOutbox.locationId})
  .from(orderOutbox).limit(1);
 assert.ok(event,"previous phases should have persisted at least one order event");
 const [oldCursor]=await db.select({version:orderRevision.version})
  .from(orderRevision).where(eq(orderRevision.locationId,event!.locationId)).limit(1);
 await db.update(orderOutbox).set({deliveredAt:null}).where(eq(orderOutbox.id,event!.id));
 let processed=false;
 for(let i=0;i<16;i++){
  await delay(1000);
  const [r]=await db.select({deliveredAt:orderOutbox.deliveredAt})
   .from(orderOutbox).where(eq(orderOutbox.id,event!.id)).limit(1);
  if(r?.deliveredAt){processed=true;break;}
 }
 assert.ok(processed,"API background reconciler retries a pending durable event");
 const [cursor]=await db.select({version:orderRevision.version})
  .from(orderRevision).where(eq(orderRevision.locationId,event!.locationId)).limit(1);
 assert.ok((cursor?.version??0)>(oldCursor?.version??0),
  "replayed events advance the durable client revision cursor");
 console.info("PASS P13: security headers, request IDs, CORS, no-store, health permissions, crash recovery and revision.");
}
main().then(async()=>{await pool.end();}).catch(async error=>{
 console.error(error);await pool.end();process.exitCode=1;
});
