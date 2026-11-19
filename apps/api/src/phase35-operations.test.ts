import test from "node:test";
import assert from "node:assert/strict";
import {createOutboxRuntimeMonitor,evaluateOperations} from "./phase35-operations";

test("outbox monitoring starts idle, records success/failure and resets correctly",()=>{
 let time=Date.parse("2026-11-19T09:00:00.000Z");
 const monitor=createOutboxRuntimeMonitor(()=>time);
 monitor.start();
 assert.equal(monitor.snapshot().mode,"starting");
 monitor.begin();
 monitor.failure();
 assert.equal(monitor.snapshot().consecutiveFailures,1);
 assert.equal(monitor.snapshot().lastFailureAt,new Date(time).toISOString());
 time+=3000;
 monitor.begin();monitor.success(200);
 let sample=monitor.snapshot();
 assert.equal(sample.mode,"active");
 assert.equal(sample.consecutiveFailures,0);
 assert.equal(sample.processedSinceStart,200);
 assert.equal(sample.inFlight,false);
 monitor.success(0);
 assert.equal(monitor.snapshot().processedSinceStart,200);
 monitor.stop();
 assert.equal(monitor.snapshot().mode,"stopped");
 monitor.start();
 assert.equal(monitor.snapshot().processedSinceStart,0);
 assert.equal(monitor.snapshot().lastFailureAt,null);
});

test("outbox monitor never records an exception message or order payload",()=>{
 let t=Date.parse("2026-11-19T09:00:00.000Z");
 const m=createOutboxRuntimeMonitor(()=>t);
 m.start();
 m.begin();m.failure();
 assert.ok(!JSON.stringify(m.snapshot()).includes("errorMessage"));
 assert.ok(!JSON.stringify(m.snapshot()).includes("tenant"));
 const start=m.snapshot().startedAt;
 assert.equal(start,new Date(t).toISOString());
});

test("newly starting worker has a grace window, never certifies a pilot",()=>{
 let time=Date.parse("2026-11-19T09:00:00.000Z");
 const m=createOutboxRuntimeMonitor(()=>time);m.start();
 const status=evaluateOperations(0,null,m.snapshot(),time+10_000);
 assert.equal(status.status,"ok");
 assert.equal(status.severity,"ok");
 assert.deepEqual(status.signals,["WORKER_STARTING"]);
 assert.equal(status.pilotCertified,false);
 assert.equal(status.scope,"server_instance_and_shared_outbox");
 assert.equal(status.actionRequired,false);
});

test("backlog and ageing have deterministic warning and urgent boundaries",()=>{
 const time=Date.parse("2026-11-19T09:00:00.000Z");
 const m=createOutboxRuntimeMonitor(()=>time);m.start();m.success(1);
 assert.equal(evaluateOperations(1,60,m.snapshot(),time).status,"ok");
 const warn=evaluateOperations(1,61,m.snapshot(),time);
 assert.equal(warn.status,"attention");
 assert.equal(warn.severity,"investigate");
 assert.deepEqual(warn.signals,["OUTBOX_DELAY"]);
 const urgent=evaluateOperations(1,301,m.snapshot(),time);
 assert.equal(urgent.severity,"urgent");
 assert.ok(urgent.signals.includes("OUTBOX_CRITICAL_DELAY"));
 assert.equal(evaluateOperations(5001,0,m.snapshot(),time).severity,"urgent");
});

test("disabled, failed or stalled workers remain visible, not falsely healthy",()=>{
 let time=Date.parse("2026-11-19T09:00:00.000Z");
 const m=createOutboxRuntimeMonitor(()=>time);
 m.disable();
 assert.deepEqual(evaluateOperations(0,null,m.snapshot(),time).signals,["WORKER_DISABLED"]);
 assert.equal(evaluateOperations(0,null,m.snapshot(),time).status,"attention");
 m.start();m.begin();m.failure();m.begin();m.failure();m.begin();m.failure();
 const failing=evaluateOperations(3,1,m.snapshot(),time);
 assert.equal(failing.severity,"urgent");
 assert.ok(failing.signals.includes("WORKER_RETRYING"));
 m.start();
 const stalled=evaluateOperations(4,1,m.snapshot(),time+31_000);
 assert.equal(stalled.severity,"urgent");
 assert.ok(stalled.signals.includes("WORKER_STALLED"));
 const emptyStalled=evaluateOperations(0,null,m.snapshot(),time+31_000);
 assert.equal(emptyStalled.severity,"investigate");
});

test("a successful retry clears failure escalation without changing durable counts",()=>{
 let time=Date.parse("2026-11-19T09:00:00.000Z");
 const m=createOutboxRuntimeMonitor(()=>time);
 m.start();m.begin();m.failure();m.failure();m.failure();
 assert.equal(evaluateOperations(1,1,m.snapshot(),time).severity,"urgent");
 time+=1000;
 m.begin();m.success(1);
 const healthy=evaluateOperations(0,null,m.snapshot(),time);
 assert.equal(healthy.status,"ok");
 assert.equal(healthy.severity,"ok");
 assert.equal(m.snapshot().consecutiveFailures,0);
});
