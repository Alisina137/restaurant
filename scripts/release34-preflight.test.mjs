import {test} from "node:test";
import assert from "node:assert/strict";
import {deploymentOrigin,runReleasePreflight,releasePreflightCli} from "./release34-preflight.mjs";

const api="http://127.0.0.1:4000";
const web="http://127.0.0.1:3000";
function mockedFetch({dbDown=false,contextPublic=false,operationsPublic=false,
  launcherPublic=false,missingHeader=false,webDown=false,offline=false}={}) {
 return async (address,init)=>{
  assert.equal(init.method,"GET");
  assert.equal(init.redirect,"manual");
  assert.equal(init.cache,"no-store");
  assert.ok(init.signal);
  if(offline)throw Error("Sensitive details must not be emitted");
  const {pathname,port}=new URL(address);
  const headers=missingHeader?{}:{"cache-control":"no-store","x-content-type-options":"nosniff"};
  if(port==="4000") {
   if(pathname==="/api/health")return Response.json({status:"ok"},{headers});
   if(pathname==="/api/health/ready")return Response.json(
    dbDown?{code:"DB_UNAVAILABLE"}:{status:"ready"},
    {status:dbDown?503:200,headers});
   if(pathname==="/api/context")return Response.json({code:"UNAUTHENTICATED"},
    {status:contextPublic?200:401,headers});
   if(pathname==="/api/health/operations")return Response.json({code:"UNAUTHENTICATED"},
    {status:operationsPublic?200:401,headers});
  }
  if(port==="3000") {
   if(pathname==="/login")return new Response("",{status:webDown?503:200});
   if(pathname==="/dev/interfaces")return new Response("",{status:launcherPublic?200:404});
  }
  throw Error("Unexpected probe path");
 };
}
const settings=(flags={})=>({
 apiOrigin:api,webOrigin:web,ciLocal:true,fetchImpl:mockedFetch(flags)
});

test("reject insecure remote URLs, credentials, query strings and arbitrary CI hosts",()=>{
 assert.equal(deploymentOrigin("https://api.example.com/"),"https://api.example.com");
 for(const address of [
  "http://api.example.com","https://localhost","https://127.0.0.1",
  "https://api.example.com/private","https://u:p@api.example.com",
  "https://api.example.com/?key=value","https://api.example.com/#fragment",
  "https://api.example.test"
 ])assert.throws(()=>deploymentOrigin(address));
 assert.throws(()=>deploymentOrigin("http://remote.example.com",true));
 assert.equal(deploymentOrigin(api,true),api);
});
test("all seven read-only checks pass only for safe observed responses",async()=>{
 const result=await runReleasePreflight(settings());
 assert.equal(result.passed,true);
 assert.equal(result.checks.length,7);
 assert.match(result.designation,/NOT DEPLOYMENT APPROVAL/);
});
test("database outage, public private routes, dev launcher and missing security headers fail",async()=>{
 for(const flags of [
  {dbDown:true},{contextPublic:true},{operationsPublic:true},
  {launcherPublic:true},{missingHeader:true},{webDown:true},{offline:true}
 ]) {
  const result=await runReleasePreflight(settings(flags));
  assert.equal(result.passed,false,JSON.stringify(flags));
  assert.ok(result.checks.some(check=>!check.ok));
 }
});
test("local-only smoke cannot be invoked from a normal workstation",async()=>{
 const lines=[];
 const io={log:x=>lines.push(x),error:x=>lines.push(x)};
 const code=await releasePreflightCli([
  "--ci-local","--api-origin",api,"--web-origin",web
 ],{},io);
 assert.equal(code,2);
 assert.match(lines.join(" "),/HOLD/);
});
test("validation rejects unsafe URL before any network calls",async()=>{
 let called=false;
 await assert.rejects(()=>runReleasePreflight({
  apiOrigin:"https://u:p@api.example.com",webOrigin:"https://web.example.com",
  fetchImpl:async()=>{called=true;throw Error("unexpected");}
 }));
 assert.equal(called,false);
});
