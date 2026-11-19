import test from "node:test";
import assert from "node:assert/strict";
import {createHttpPerformanceMonitor,assessAvailability} from "./phase36-performance";

test("empty latency snapshot is honest about insufficient evidence",()=>{
 const now=Date.parse("2026-11-19T00:00:00Z");
 const monitor=createHttpPerformanceMonitor(()=>now);
 const sample=monitor.snapshot();
 assert.equal(sample.sampleCount,0);
 assert.equal(sample.p50Ms,null);
 assert.equal(sample.p95Ms,null);
 assert.equal(sample.sampledFrom,"completed_api_requests_on_this_instance");
 assert.deepEqual(sample.routeGroups,[]);
 assert.deepEqual(assessAvailability(sample,{total:0,idle:0,waiting:0,maxConfigured:10}),
  {level:"insufficient_samples",signals:[],actualSlaCertified:false});
});

test("computes deterministic nearest-rank p50/p95 from completed request observations",()=>{
 let time=Date.parse("2026-11-19T00:00:00Z");
 const monitor=createHttpPerformanceMonitor(()=>time);
 for(let i=1;i<=20;i++)monitor.record("/api/context",200,i*100);
 const sample=monitor.snapshot();
 assert.equal(sample.sampleCount,20);
 assert.equal(sample.p50Ms,1000);
 assert.equal(sample.p95Ms,1900);
 assert.equal(sample.slowRequests,5);
 assert.deepEqual(sample.routeGroups,[{route:"/api/context",count:20,p95Ms:1900}]);
 const assessment=assessAvailability(sample,{total:6,idle:1,waiting:0,maxConfigured:10});
 assert.deepEqual(assessment.signals,["API_P95_ELEVATED"]);
 assert.equal(assessment.level,"investigate");
 assert.equal(assessment.actualSlaCertified,false);
});

test("counting 503/429 and pool contention is informative, never auto-gates a release",()=>{
 let now=Date.parse("2026-11-19T00:00:00Z");
 const monitor=createHttpPerformanceMonitor(()=>now);
 for(let i=0;i<20;i++)monitor.record("/api/menu",i<3?503:i<5?429:200,100);
 const sample=monitor.snapshot();
 assert.equal(sample.serverErrors,3);
 assert.equal(sample.rateLimited,2);
 assert.equal(sample.p95Ms,100);
 const assessment=assessAvailability(sample,{total:10,idle:0,waiting:3,maxConfigured:10});
 assert.deepEqual(assessment.signals,["API_SERVER_ERRORS","DB_POOL_WAITING"]);
 assert.equal(assessment.level,"investigate");
 assert.equal(assessment.actualSlaCertified,false);
});

test("retains at most 1024 recent samples, expires old measurements, and never stores URLs",()=>{
 let now=Date.parse("2026-11-19T00:00:00Z");
 const monitor=createHttpPerformanceMonitor(()=>now);
 monitor.record("/api/guest?qr=secret",500,9999);
 monitor.record("/api/guest/abc",200,12);
 monitor.record("/api/guest",200,Infinity);
 for(let i=0;i<1100;i++)monitor.record("/api/guest",200,i);
 const sample=monitor.snapshot();
 assert.equal(sample.sampleCount,1024);
 assert.equal(sample.limitedToRecentSamples,true);
 assert.equal(sample.serverErrors,0);
 assert.ok(!JSON.stringify(sample).includes("qr=secret"));
 assert.ok(!JSON.stringify(sample).includes("/abc"));
 now+=300_001;
 const expired=monitor.snapshot();
 assert.equal(expired.sampleCount,0);
 assert.equal(expired.p95Ms,null);
 assert.equal(expired.serverErrors,0);
});

test("unknown routes, negative duration and invalid status are ignored",()=>{
 const now=Date.parse("2026-11-19T00:00:00Z");
 const monitor=createHttpPerformanceMonitor(()=>now);
 for(const route of ["/api/auth/private-token","/private","/api/health","/api/other?secret=1"])
  monitor.record(route,200,100);
 monitor.record("/api/context",0,100);
 monitor.record("/api/context",600,100);
 monitor.record("/api/context",200,-1);
 assert.equal(monitor.snapshot().sampleCount,0);
});

test("few samples do not suggest healthy production latency",()=>{
 const now=Date.parse("2026-11-19T00:00:00Z");
 const monitor=createHttpPerformanceMonitor(()=>now);
 monitor.record("/api/orders",503,5000);
 const sample=monitor.snapshot();
 assert.equal(sample.sampleCount,1);
 assert.equal(assessAvailability(sample,{total:5,idle:3,waiting:0,maxConfigured:10}).level,
  "insufficient_samples");
 assert.deepEqual(assessAvailability(sample,{total:10,idle:0,waiting:3,maxConfigured:10}).signals,
  ["DB_POOL_WAITING"]);
});
