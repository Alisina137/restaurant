import test from "node:test";
import assert from "node:assert/strict";
import {webRoutes,anonymousApi,roles,roleChecks,localOrigin,
 checkStaticSurfaces,checkRoleAuthorization,runPhase43Smoke}
 from "./phase43-release-smoke.mjs";

function mockFetch({badPath="",badRole="",noApiReadiness=false}={}){
 const roleByEmail=new Map(Object.entries(roles).map(([role,email])=>[email,role]));
 const routes=new Map(webRoutes.map(([id,path,code])=>[path,code]));
 const api=new Map(anonymousApi.map(([id,path,status,body])=>[path,{status,body}]));
 const security=new Map(roleChecks.map(([id,role,path,status])=>
  [role+"|"+path,{id,status}]));
 return async(address,request)=>{
  assert.equal(request.redirect,"manual");
  assert.ok(request.signal,"Every request must be bounded");
  const url=new URL(address),isWeb=url.port==="3000",path=url.pathname+url.search;
  if(path==="/api/auth/sign-in/email"){
   assert.equal(request.method,"POST");
   const body=JSON.parse(request.body);
   const role=roleByEmail.get(body.email);
   assert.ok(role);
   const h=new Headers();
   h.append("set-cookie","session_id="+role+"; HttpOnly; Path=/");
   return new Response("{}",{status:200,headers:h});
  }
  assert.equal(request.method,"GET","CI smoke must never mutate a workflow");
  if(isWeb){
   const code=routes.get(path)??404;
   return new Response("<!doctype html><html><body>APP</body></html>",{
    status:badPath===path?500:code,headers:{"content-type":"text/html; charset=utf-8"}});
  }
  const cookie=request.headers?.Cookie??"";
  const role=cookie.startsWith("session_id=")?cookie.slice("session_id=".length):null;
  const route=role?security.get(role+"|"+path):null;
  if(role&&route){
   return Response.json({status:"ok"},{status:badRole===route.id?403:route.status});
  }
  const anonymous=api.get(path)??{status:404};
  const code=noApiReadiness&&path==="/api/health/ready"?503:anonymous.status;
  return Response.json({status:anonymous.body??"error"},{status:code});
 };
}
const params=fetchImpl=>({fetchImpl,apiOrigin:"http://localhost:4000",
 webOrigin:"http://localhost:3000",password:"UNIT_TEST_ONLY_123"});
test("hard reject remote or credential-bearing origins",()=>{
 assert.equal(localOrigin("http://127.0.0.1:3000",3000),"http://127.0.0.1:3000");
 for(const origin of ["http://example.com:3000","https://localhost:3000",
  "http://localhost:4000","http://user:pass@localhost:3000",
  "http://localhost:3000/private","http://localhost:3000/?token=secret",
  "http://localhost:3000/#info","http://[::1]:3000"])
  assert.throws(()=>localOrigin(origin,3000),origin);
});
test("real inventory covers all four web staff surfaces and excludes deep-link leakage",()=>{
 assert.ok(webRoutes.length>=20);
 for(const path of ["/app/overview","/app/pilot","/app/reports",
  "/app/billing/shifts","/cashier/checks","/cashier/shifts",
  "/kitchen/live","/kitchen/preparing","/kitchen/ready",
  "/platform/overview","/platform/pilots","/g/phase43-test-visit/menu"])
  assert.ok(webRoutes.some(r=>r[1]===path&&r[2]===200),path);
 for(const path of ["/cashier/reports","/platform/reports","/kitchen/reports",
  "/dev/interfaces","/platform/billing/shifts"])
  assert.ok(webRoutes.some(r=>r[1]===path&&r[2]===404),path);
});
test("complete CI route/role gate passes only safe expected browser and API responses",async()=>{
 const r=await runPhase43Smoke(params(mockFetch()));
 assert.equal(r.passed,true);
 assert.equal(r.checks.length,webRoutes.length+anonymousApi.length+roleChecks.length);
 assert.equal(r.checks.filter(x=>!x.ok).length,0);
 assert.equal(r.physicalPilotCertified,false);
 assert.equal(r.financiallyCertified,false);
 assert.equal(r.humanGoAuthorized,false);
 assert.match(r.designation,/NOT PHYSICAL OR FINANCIAL GO/);
});
test("unexpected web 500, API readiness 503, or cross-role 200 fails closed",async()=>{
 const a=await checkStaticSurfaces(params(mockFetch({badPath:"/app/reports"})));
 assert.ok(a.some(x=>x.id==="owner_reports"&&!x.ok));
 const b=await checkStaticSurfaces(params(mockFetch({noApiReadiness:true})));
 assert.ok(b.some(x=>x.id==="api_ready"&&!x.ok));
 const c=await checkRoleAuthorization(params(mockFetch({badRole:"owner_reports"})));
 assert.ok(c.some(x=>x.id==="owner_reports"&&!x.ok));
});
test("anonymous and staff role checks cannot be replaced by a green static-route status",async()=>{
 const r=await runPhase43Smoke(params(mockFetch({noApiReadiness:true})));
 assert.equal(r.passed,false);
 assert.ok(r.checks.some(x=>!x.ok));
});
