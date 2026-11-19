import "dotenv/config";
import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";
import {pool} from "./db";

if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("Phase 35 requires a disposable development/CI database with seeded accounts.");
const root=process.env.E2E_API_URL??"http://localhost:4000";
const pw=process.env.DEMO_PASSWORD;
async function request(path:string,cookie?:string,method="GET"){
 return fetch(root+path,{method,headers:{Origin:"http://localhost:3000",
  ...(cookie?{Cookie:cookie}:{})}});
}
async function login(email:string){
 for(let attempts=0;attempts<7;attempts++){
  const response=await fetch(root+"/api/auth/sign-in/email",{
   method:"POST",headers:{"Content-Type":"application/json",Origin:"http://localhost:3000"},
   body:JSON.stringify({email,password:pw})});
  if(response.status===429){await delay(11000);continue;}
  assert.equal(response.status,200,email+" cannot authenticate");
  return response.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Rate limited test sign in");
}
type Ops={
 status:"ok"|"attention";severity:"ok"|"investigate"|"urgent";
 checkedAt:string;actionRequired:boolean;pilotCertified:false;
 scope:"server_instance_and_shared_outbox";signals:string[];
 pendingOutbox:number;oldestPendingAt:string|null;oldestPendingAgeSeconds:number|null;
 reconciler:{mode:string;lastSuccessAt:string|null;consecutiveFailures:number;inFlight:boolean;
  processedSinceStart:number};
 polling:"database_revision";
};
async function run(){
 assert.equal((await request("/api/health/operations")).status,401);
 const platform=await login("platform-ci@example.test");
 const owner=await login("owner-ci@example.test");
 assert.equal((await request("/api/health/operations",owner)).status,403);
 assert.equal((await request("/api/health/operations",platform,"POST")).status,404,
  "Read-only monitoring must not permit a mutation method");
 // P36: collect actual completed request samples without synthetic counters.
 const burst=await Promise.all(Array.from({length:24},()=>request("/api/context")));
 assert.ok(burst.every(x=>x.status===401));
 const http=await request("/api/health/operations",platform);
 assert.equal(http.status,200,"authorized platform operator must see operations");
 assert.match(http.headers.get("cache-control")??"",/no-store/);
 const body=await http.json() as Ops;
 assert.ok(["ok","attention"].includes(body.status));
 assert.ok(["ok","investigate","urgent"].includes(body.severity));
 assert.equal(body.pilotCertified,false);
 assert.equal(body.scope,"server_instance_and_shared_outbox");
 assert.equal(body.polling,"database_revision");
 assert.ok(!Number.isNaN(Date.parse(body.checkedAt)));
 assert.ok(Number.isSafeInteger(body.pendingOutbox)&&body.pendingOutbox>=0);
 assert.ok(Number.isSafeInteger(body.reconciler.consecutiveFailures));
 assert.ok(Number.isSafeInteger(body.reconciler.processedSinceStart));
 assert.ok(["starting","active","disabled","stopped"].includes(body.reconciler.mode));
 assert.ok(Array.isArray(body.signals));
 for(const signal of body.signals)
  assert.match(signal,/^(OUTBOX_BACKLOG|OUTBOX_DELAY|OUTBOX_CRITICAL_DELAY|WORKER_DISABLED|WORKER_RETRYING|WORKER_STALLED|WORKER_STARTING)$/);
 const serialized=JSON.stringify(body);
 for(const sensitive of ["DATABASE_URL","BETTER_AUTH_SECRET","password","userEmail","guestPin","payload"])
  assert.equal(serialized.includes(sensitive),false,"No private diagnostics: "+sensitive);
 // P36: platform-only five-minute rolling API evidence, never a global SLA.
 const performance=(body as Ops & {performance?:{
  sampleCount:number;sampleCapacity:number;windowSeconds:number;
  sampledFrom:string; p50Ms:number|null;p95Ms:number|null;
  pool:{total:number;idle:number;waiting:number;maxConfigured:number};
  availability:{actualSlaCertified:boolean};
  routeGroups:Array<{route:string;count:number;p95Ms:number}>;
 }}).performance;
 assert.ok(performance,"Phase 36 performance evidence required");
 assert.equal(performance.sampleCapacity,1024);
 assert.equal(performance.windowSeconds,300);
 assert.equal(performance.sampledFrom,"completed_api_requests_on_this_instance");
 assert.ok(performance.sampleCount>=20);
 assert.ok(performance.p50Ms!==null&&performance.p95Ms!==null);
 assert.equal(performance.availability.actualSlaCertified,false);
 assert.ok(performance.pool.total>=performance.pool.idle);
 assert.equal(performance.pool.maxConfigured,10);
 assert.ok(performance.routeGroups.length<=5);
 // Migration is genuinely present in the disposable PostgreSQL database.
 const index=await pool.query<{indexname:string;indexdef:string}>(`
  SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=current_schema()
  AND tablename='order_outbox' AND indexname='order_outbox_pending_order_idx'`);
 assert.equal(index.rows.length,1,"P36 ordered pending outbox index required");
 assert.match(index.rows[0]!.indexdef,/delivered_at IS NULL/i);
 console.info("PASS P36: real protected latency counters, safe pool pressure, and migrated partial index.");
 console.info("PASS P35: platform-only read-only recovery monitoring, stable payload, sanitized observability, no pilot certification.");
}
run().then(async()=>{await pool.end();}).catch(async error=>{
 console.error(error);await pool.end();process.exitCode=1;
});
