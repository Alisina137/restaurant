/**
 * Phase 34: public, read-only deployment smoke checks.
 * Passing checks is NOT permission to launch a real restaurant pilot.
 */
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";

export function deploymentOrigin(value,ciLocal=false) {
 if(typeof value!=="string"||!value||value!==value.trim())throw Error("Origin is required.");
 let url;
 try { url=new URL(value); } catch { throw Error("Invalid origin."); }
 if(url.username||url.password||url.pathname!=="/"||url.search||url.hash)
  throw Error("Origins must not have credentials, paths or query strings.");
 const hostname=url.hostname.toLowerCase().replace(/^\[|\]$/g,"");
 if(ciLocal) {
  if(url.protocol!=="http:"||!["127.0.0.1","localhost"].includes(hostname))
   throw Error("Only loopback HTTP is valid in CI-local mode.");
 } else if(url.protocol!=="https:"||!hostname||hostname==="localhost"||
           hostname.endsWith(".localhost")||hostname.endsWith(".local")||
           hostname.endsWith(".test")||isIP(hostname)!==0) {
  throw Error("Remote smoke tests require a public HTTPS DNS origin.");
 }
 return url.origin;
}

async function probe(fetchImpl,origin,path,withBody,timeoutMs) {
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try {
  const response=await fetchImpl(origin+path,{
   method:"GET",redirect:"manual",cache:"no-store",signal:controller.signal
  });
  let body=null;
  if(withBody)try { body=await response.json(); } catch { /* mark missing below */ }
  return {status:response.status,headers:response.headers,body};
 } catch {
  // Avoid logging raw network exceptions: they may contain private hostnames.
  return null;
 } finally {clearTimeout(timer);}
}

export async function runReleasePreflight({
 apiOrigin,webOrigin,fetchImpl=globalThis.fetch,ciLocal=false,timeoutMs=6000
}) {
 const api=deploymentOrigin(apiOrigin,ciLocal);
 const web=deploymentOrigin(webOrigin,ciLocal);
 if(typeof fetchImpl!=="function")throw Error("Fetch is unavailable.");
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)
  throw Error("Timeout must be between 100 and 30000 ms.");
 const checks=[];
 const targets=[
  ["api_liveness",api,"/api/health",200,"ok"],
  ["api_database_readiness",api,"/api/health/ready",200,"ready"],
  ["anonymous_context_denied",api,"/api/context",401],
  ["anonymous_operations_denied",api,"/api/health/operations",401],
  ["web_sign_in",web,"/login",200],
  ["dev_launcher_absent",web,"/dev/interfaces",404]
 ];
 for(const [id,origin,path,status,bodyStatus] of targets) {
  const response=await probe(fetchImpl,origin,path,bodyStatus!==undefined,timeoutMs);
  checks.push({id,ok:!!response&&response.status===status&&
   (bodyStatus===undefined||response.body?.status===bodyStatus),
   detail:response?"HTTP "+response.status:"Unreachable or timed out"});
  if(id==="api_database_readiness") {
   checks.push({id:"api_no_cache_and_nosniff",ok:!!response&&
    /no-store/i.test(response.headers.get("cache-control")??"")&&
    response.headers.get("x-content-type-options")?.toLowerCase()==="nosniff",
    detail:response?"HTTP response header contract":"Unreachable or timed out"});
  }
 }
 return {passed:checks.every(x=>x.ok),checks,designation:ciLocal?
  "CI LOCAL SIMULATION — NOT DEPLOYMENT APPROVAL":"REMOTE SMOKE — NOT DEPLOYMENT APPROVAL"};
}

function parseArguments(argv,env) {
 const options=new Map(),allowed=new Set(["--api-origin","--web-origin","--ci-local"]);
 for(let i=0;i<argv.length;i++) {
  const arg=argv[i];
  if(!allowed.has(arg)||options.has(arg))throw Error("Invalid or repeated argument.");
  if(arg==="--ci-local") {options.set(arg,true);continue;}
  const value=argv[++i];
  if(!value||value.startsWith("--"))throw Error("Missing origin.");
  options.set(arg,value);
 }
 const ciLocal=!!options.get("--ci-local");
 if(ciLocal&&!(env.CI==="true"&&env.GITHUB_ACTIONS==="true"))
  throw Error("CI-local mode is restricted to GitHub Actions.");
 if(!options.has("--api-origin")||!options.has("--web-origin"))
  throw Error("Both origins are required.");
 return {apiOrigin:options.get("--api-origin"),webOrigin:options.get("--web-origin"),ciLocal};
}

export async function releasePreflightCli(argv=process.argv.slice(2),env=process.env,output=console) {
 try {
  const result=await runReleasePreflight(parseArguments(argv,env));
  output.log(result.designation);
  for(const check of result.checks)
   output.log((check.ok?"PASS ":"FAIL ")+check.id+" — "+check.detail);
  output.log(result.passed?"Smoke checks passed; physical and human release gates remain required.":
   "HOLD: investigate failed checks before considering deployment.");
  return result.passed?0:1;
 } catch {
  output.error("HOLD: invalid invocation. Specify clean HTTPS API and web origins.");
  return 2;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 process.exitCode=await releasePreflightCli();
