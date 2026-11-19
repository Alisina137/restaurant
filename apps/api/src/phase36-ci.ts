import "dotenv/config";
import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";
import {pool} from "./db";

if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("Phase 36 exercises only disposable seeded CI databases.");
const api=process.env.E2E_API_URL??"http://localhost:4000";
const pass=process.env.DEMO_PASSWORD;
async function req(path:string,cookie?:string){
 return fetch(api+path,{method:"GET",headers:{Origin:"http://localhost:3000",
  ...(cookie?{Cookie:cookie}:{})}});
}
async function login(email:string){
 for(let i=0;i<7;i++){
  const response=await fetch(api+"/api/auth/sign-in/email",{method:"POST",
   headers:{"Content-Type":"application/json",Origin:"http://localhost:3000"},
   body:JSON.stringify({email,password:pass})});
  if(response.status===429){await delay(11000);continue;}
  assert.equal(response.status,200,"Login failed for CI fixture "+email);
  return response.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw Error("Fixture sign in remained rate limited.");
}
type Performance={
 sampleCount:number;sampleCapacity:number;windowSeconds:number;
 sampledFrom:string;limitedToRecentSamples:boolean;
 p50Ms:number|null;p95Ms:number|null;
 serverErrors:number;rateLimited:number;slowRequests:number;
 checkedAt:string;uptimeSeconds:number;
 routeGroups:Array<{route:string;count:number;p95Ms:number}>;
 pool:{total:number;idle:number;waiting:number;maxConfigured:number};
 availability:{level:string;signals:string[];actualSlaCertified:false};
};
async function main(){
 // Real authentication and tenant-role gates: never expose instance internals to
 // anonymous callers or ordinary restaurant owner/manager users.
 assert.equal((await req("/api/health/operations")).status,401);
 const [platform,owner]=await Promise.all([
  login("platform-ci@example.test"),login("owner-ci@example.test")]);
 assert.equal((await req("/api/health/operations",owner)).status,403);
 // Observe real completed HTTP responses; do not seed synthetic counters.
 const samples=await Promise.all(Array.from({length:24},()=>req("/api/context")));
 assert.ok(samples.every(x=>x.status===401),"No authenticated session disclosed");
 const response=await req("/api/health/operations",platform);
 assert.equal(response.status,200);
 assert.match(response.headers.get("cache-control")??"",/no-store/);
 const body=await response.json() as {pilotCertified:false;performance:Performance};
 assert.equal(body.pilotCertified,false);
 const x=body.performance;
 assert.equal(x.sampleCapacity,1024);
 assert.equal(x.windowSeconds,300);
 assert.equal(x.sampledFrom,"completed_api_requests_on_this_instance");
 assert.ok(x.sampleCount>=20,"Recorded 24 real HTTP 401 responses");
 assert.ok(x.sampleCount<=1024);
 assert.ok(typeof x.limitedToRecentSamples==="boolean");
 assert.ok(x.p95Ms!==null&&x.p50Ms!==null&&x.p95Ms>=x.p50Ms);
 assert.ok([x.serverErrors,x.rateLimited,x.slowRequests,x.uptimeSeconds]
  .every(n=>Number.isSafeInteger(n)&&n>=0));
 assert.ok(x.pool.total>=x.pool.idle&&x.pool.maxConfigured===10&&x.pool.waiting>=0);
 assert.equal(x.availability.actualSlaCertified,false);
 assert.ok(["observed","investigate","insufficient_samples"].includes(x.availability.level));
 assert.ok(x.routeGroups.length<=5);
 for(const area of x.routeGroups) {
  assert.match(area.route,/^\/api\/(auth|guest|invitations|onboarding|platform|finance|subscription|orders|reports|floor|menu|service|tenant|context|other)$/);
  assert.ok(Number.isInteger(area.count)&&area.count>0);
 }
 const exposed=JSON.stringify(x);
 for(const secret of ["DATABASE_URL","BETTER_AUTH_SECRET","token=","guestPin","requestBody",
 "postgresql://","/api/orders/visits/","/api/guest/t/"]) {
  assert.equal(exposed.includes(secret),false,"No sensitive request details: "+secret);
 }
 // Additive partial index must actually exist in the migrated disposable DB.
 const result=await pool.query<{indexname:string;indexdef:string}>(`
   SELECT indexname,indexdef FROM pg_indexes
   WHERE schemaname = current_schema()
     AND tablename='order_outbox'
     AND indexname='order_outbox_pending_order_idx'`);
 assert.equal(result.rows.length,1,"Pending outbox index migration applied");
 assert.match(result.rows[0]!.indexdef,/created_at.*id/i);
 assert.match(result.rows[0]!.indexdef,/delivered_at IS NULL/i);
 console.info(JSON.stringify({scenario:"P36 disposable API performance and index contract",
  observedRequests:x.sampleCount,p50Ms:x.p50Ms,p95Ms:x.p95Ms,
  indexPresent:true,productionSlaCertified:false}));
}
main().then(async()=>{await pool.end();}).catch(async e=>{
 console.error(e);await pool.end();process.exitCode=1;
});
