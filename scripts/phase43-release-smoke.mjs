import {pathToFileURL} from "node:url";
import {isIP} from "node:net";
import {execFileSync} from "node:child_process";
import {writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

/**
 * Phase 43 is a CI-only release *candidate* probe, not a production acceptance
 * test. These safe GETs verify actual production-built Next route shells and
 * real API authorization, not React hydration or real hardware/payment events.
 */
export const webRoutes=[
 ["web_login","/login",200],
 ["owner_overview","/app/overview",200],
 ["owner_pilot","/app/pilot",200],
 ["owner_reports","/app/reports",200],
 ["owner_finance_shifts","/app/billing/shifts",200],
 ["cashier_checks","/cashier/checks",200],
 ["cashier_shifts","/cashier/shifts",200],
 ["cashier_receipts","/cashier/receipts",200],
 ["kitchen_new","/kitchen/live",200],
 ["kitchen_preparing","/kitchen/preparing",200],
 ["kitchen_ready","/kitchen/ready",200],
 ["platform_overview","/platform/overview",200],
 ["platform_pilot","/platform/pilots",200],
 ["guest_qr_shell","/g/phase43-test-visit/menu",200],
 ["wrong_cashier_reports","/cashier/reports",404],
 ["wrong_platform_reports","/platform/reports",404],
 ["wrong_kitchen_reports","/kitchen/reports",404],
 ["wrong_app_kitchen","/app/ready",404],
 ["wrong_platform_finance","/platform/billing/shifts",404],
 ["wrong_platform_pilot","/platform/pilot",404],
 ["development_launcher_not_exposed","/dev/interfaces",404]
];
export const anonymousApi=[
 ["api_live","/api/health",200,"ok"],
 ["api_ready","/api/health/ready",200,"ready"],
 ["context_requires_session","/api/context",401],
 ["owner_reports_private","/api/reports/dashboard?period=7",401],
 ["private_cashier_shift","/api/finance/shifts/current",401],
 ["private_cashier_reconciliation","/api/finance/shifts/unknown/reconciliation",401],
 ["private_finance_receipts","/api/finance/receipts",401],
 ["private_pilot","/api/pilot",401],
 ["private_platform","/api/platform/pilots",401],
 ["private_operations","/api/health/operations",401],
 ["private_kitchen_cards","/api/orders/kitchen/cards?status=new",401]
];
export const roles={
 owner:"owner-ci@example.test",
 cashier:"cashier-ci@example.test",
 kitchen:"kitchen-ci@example.test",
 waiter:"waiter-ci@example.test",
 platform:"platform-ci@example.test",
 foreignOwner:"new-owner-ci@example.test"
};
/** The gate never emits authentication cookies, email addresses or API bodies. */
export const roleChecks=[
 ["owner_reports","owner","/api/reports/dashboard?period=7",200],
 ["cashier_not_owner_reports","cashier","/api/reports/dashboard?period=7",403],
 ["waiter_not_owner_reports","waiter","/api/reports/dashboard?period=7",403],
 ["kitchen_not_owner_reports","kitchen","/api/reports/dashboard?period=7",403],
 ["owner_pilot","owner","/api/pilot",200],
 ["platform_cannot_impersonate_owner","platform","/api/pilot",403],
 ["cashier_not_pilot","cashier","/api/pilot",403],
 ["foreign_tenant_has_own_pilot","foreignOwner","/api/pilot",200],
 ["platform_pilot_directory","platform","/api/platform/pilots",200],
 ["owner_cannot_approve_pilot","owner","/api/platform/pilots",403],
 ["waiter_not_platform","waiter","/api/platform/pilots",403],
 ["cashier_own_shift","cashier","/api/finance/shifts/current",200],
 ["owner_shift_visibility","owner","/api/finance/shifts/current",200],
 ["kitchen_not_cashier","kitchen","/api/finance/shifts/current",403],
 ["waiter_not_cashier","waiter","/api/finance/shifts/current",403],
 ["platform_not_cashier","platform","/api/finance/shifts/current",403],
 ["owner_shift_oversight","owner","/api/finance/shifts/oversight",200],
 ["cashier_not_shift_oversight","cashier","/api/finance/shifts/oversight",403],
 ["cashier_own_receipts","cashier","/api/finance/receipts",200],
 ["kitchen_not_receipts","kitchen","/api/finance/receipts",403],
 ["kitchen_cards","kitchen","/api/orders/kitchen/cards?status=new",200],
 ["cashier_not_kitchen","cashier","/api/orders/kitchen/cards?status=new",403],
 ["platform_operational_read","platform","/api/health/operations",200],
 ["owner_not_platform_operations","owner","/api/health/operations",403],
 ["owner_pilot_operations","owner","/api/pilot/operations?minutes=60",200],
 ["cashier_not_pilot_operations","cashier","/api/pilot/operations?minutes=60",403]
];

export function localOrigin(input,port){
 const url=new URL(input);
 if(url.protocol!=="http:"||url.port!==String(port)||
  !["localhost","127.0.0.1"].includes(url.hostname)||
  url.username||url.password||url.search||url.hash||
  !["","/"].includes(url.pathname)||isIP(url.hostname)===6)
  throw Error("Phase 43 may only probe explicit localhost CI origins.");
 return url.origin;
}
async function get(fetchImpl,url,cookie,timeoutMs){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  return await fetchImpl(url,{method:"GET",redirect:"manual",cache:"no-store",
   signal:controller.signal,headers:cookie?{Cookie:cookie}:{}});
 }catch{return null;}finally{clearTimeout(timer);}
}
function result(id,response,expected,kind,requiredStatus){
 const status=response?.status??null;
 const contentType=response?.headers?.get("content-type")??"";
 let ok=status===expected;
 if(kind==="web"&&status===200)ok=ok&&/text\/html/i.test(contentType);
 if(requiredStatus)ok=ok&&requiredStatus===response?.__safeBodyStatus;
 return {id,ok,status,expected};
}
async function statusBody(response){
 try{
  const payload=await response.json();
  return typeof payload==="object"&&payload!==null?
   (typeof payload.status==="string"?payload.status:null):null;
 }catch{return null;}
}
export async function checkStaticSurfaces({fetchImpl=globalThis.fetch,
 apiOrigin="http://127.0.0.1:4000",webOrigin="http://127.0.0.1:3000",
 timeoutMs=12000}={}){
 const api=localOrigin(apiOrigin,4000),web=localOrigin(webOrigin,3000);
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)throw Error("Invalid timeout");
 const checks=[];
 // Sequential bounded probes: avoid introducing artificial noisy load.
 for(const [id,path,status] of webRoutes){
  const response=await get(fetchImpl,web+path,null,timeoutMs);
  checks.push(result(id,response,status,"web"));
 }
 for(const [id,path,status,bodyStatus] of anonymousApi){
  const response=await get(fetchImpl,api+path,null,timeoutMs);
  let ok=response?.status===status;
  if(bodyStatus&&response)ok=ok&&(await statusBody(response))===bodyStatus;
  checks.push({id,ok,status:response?.status??null,expected:status});
 }
 return checks;
}
async function signIn(fetchImpl,origin,email,password,timeoutMs){
 // Login is the only mutation in the smoke test; it's a CI-only auth request.
 // Password, Set-Cookie and response body never leave this function.
 for(let i=0;i<7;i++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  let response;
  try{
   response=await fetchImpl(origin+"/api/auth/sign-in/email",{
    method:"POST",redirect:"manual",signal:controller.signal,
    headers:{"Content-Type":"application/json","Origin":"http://localhost:3000"},
    body:JSON.stringify({email,password})});
  }catch{throw Error("CI fixture login unreachable");}
  finally{clearTimeout(timer);}
  if(response.status===429){
   await new Promise(resolve=>setTimeout(resolve,11000));continue;
  }
  if(response.status!==200)throw Error("CI fixture login failed");
  const cookie=response.headers.getSetCookie?.()
   .map(part=>part.split(";")[0]).join("; ");
  if(!cookie)throw Error("CI fixture login cookie missing");
  return cookie;
 }
 throw Error("CI fixture authentication remained rate-limited");
}
export async function checkRoleAuthorization({fetchImpl=globalThis.fetch,
 apiOrigin="http://127.0.0.1:4000",password,timeoutMs=12000}={}){
 const api=localOrigin(apiOrigin,4000);
 if(!password||typeof password!=="string")throw Error("Disposable fixture password required");
 const cookies={};
 for(const [role,email] of Object.entries(roles))
  cookies[role]=await signIn(fetchImpl,api,email,password,timeoutMs);
 const checks=[];
 for(const [id,role,path,status] of roleChecks){
  const response=await get(fetchImpl,api+path,cookies[role],timeoutMs);
  checks.push({id,ok:response?.status===status,status:response?.status??null,expected:status});
 }
 return checks;
}
export async function runPhase43Smoke(options={}){
 const web=await checkStaticSurfaces(options);
 const auth=await checkRoleAuthorization(options);
 const checks=[...web,...auth];
 return {passed:checks.every(c=>c.ok),checks,
  designation:"CI RELEASE CANDIDATE SIMULATION — NOT PHYSICAL OR FINANCIAL GO",
  physicalPilotCertified:false,financiallyCertified:false,
  humanGoAuthorized:false};
}

async function cli(){
 if(process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true"||
  process.env.NODE_ENV==="production"||
  !process.env.DEMO_PASSWORD||
  !process.env.DATABASE_URL?.includes("@localhost:5432/dineflow_ci")){
  console.error("HOLD: Phase 43 live smoke is restricted to disposable GitHub CI.");
  return 2;
 }
 try{
  const result=await runPhase43Smoke({password:process.env.DEMO_PASSWORD});
  for(const check of result.checks)
   console.log((check.ok?"PASS ":"FAIL ")+check.id+" — HTTP "+(check.status??"unreachable")+
    " expected "+check.expected);
  const commit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
  const summary={designation:result.designation,commit,
   checkedAt:new Date().toISOString(),total:result.checks.length,
   passed:result.checks.filter(c=>c.ok).length,
   failed:result.checks.filter(c=>!c.ok).map(c=>c.id),
   checks:result.checks,physicalPilotCertified:false,
   financiallyCertified:false,humanGoAuthorized:false};
  const destination=join(process.env.RUNNER_TEMP??tmpdir(),"dineflow-phase43-rc.json");
  writeFileSync(destination,JSON.stringify(summary,null,2)+"\n",{mode:0o600});
  console.log("P43 candidate SHA "+commit+"; "+summary.passed+"/"+summary.total+
   " checked; "+result.designation);
  console.log(result.passed?
   "Smoke passed; physical devices, finance, backups and independent GO/HOLD remain mandatory.":
   "HOLD: release candidate route/authorization smoke has failed checks.");
  return result.passed?0:1;
 }catch{
  console.error("HOLD: Phase 43 local smoke failed; no deployment or human approval implied.");
  return 1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 process.exitCode=await cli();
