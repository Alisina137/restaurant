import assert from "node:assert/strict";
import {actionOutcome,advanceCursor,cleanUncertain,isTicketState,
 saveUncertain,validateWatermark,type KitchenChanges,type KitchenTicketState} from "./kitchen28";
import {k28} from "./kitchen28-copy";
const now=Date.parse("2026-11-18T10:00:00.000Z");
const uncertain={ticketId:"ticket-x",action:"handoff" as const,version:3,time:now-5000};
assert.deepEqual(cleanUncertain([uncertain],now),[uncertain]);
assert.deepEqual(cleanUncertain([uncertain],now+12*60*60_000),[]);
assert.deepEqual(cleanUncertain([{...uncertain,version:0}],now),[]);
assert.deepEqual(cleanUncertain([{...uncertain,action:"refund"}],now),[]);
assert.deepEqual(cleanUncertain("bad",now),[]);
assert.deepEqual(saveUncertain([uncertain],{...uncertain,version:4}).map(x=>x.version),[4]);
assert.equal(saveUncertain(Array(50).fill({...uncertain,ticketId:"x"}),uncertain).length,30);
const current:KitchenTicketState={ticketId:"a",roundId:"b",tableLabel:"T1",
 status:"picked_up",version:4,createdAt:new Date(now).toISOString(),startedAt:null,
 readyAt:null,pickedUpAt:null,pickupAcknowledgedAt:null,servedAt:null,notifiedAt:null,
 notifyCount:1,waiterSeenAt:null,waiterAlertExists:true,
 items:{total:2,ready:0,pickedUp:2,served:0}};
assert.equal(isTicketState(current),true);
assert.equal(isTicketState({...current,status:"other"}),false);
assert.equal(isTicketState({...current,version:-1}),false);
assert.equal(isTicketState({...current,items:{total:2,ready:3,pickedUp:0,served:0}}),false);
assert.equal(isTicketState(null),false);
assert.equal(validateWatermark({cursor:0,revision:1,checkedAt:new Date(now).toISOString()}),true);
assert.equal(validateWatermark({cursor:-1,revision:1,checkedAt:"x"}),false);
assert.equal(validateWatermark({cursor:1.3,revision:1,checkedAt:"x"}),false);
const page:KitchenChanges={events:[{cursor:11,roundId:"r",eventType:"kitchen.ready",createdAt:"date"},
 {cursor:13,roundId:"s",eventType:"kitchen.handed_off",createdAt:"date"}],nextCursor:13,hasMore:true};
assert.equal(advanceCursor(10,page),13);
assert.equal(advanceCursor(10,{...page,nextCursor:12}),null);
assert.equal(advanceCursor(10,{...page,events:page.events.slice().reverse()}),null);
assert.equal(advanceCursor(10,{...page,events:[]}),null);
assert.equal(advanceCursor(10,{...page,events:[],hasMore:false,nextCursor:10}),10);
assert.equal(advanceCursor(10,{...page,events:[{...page.events[0]!,cursor:10}]}),null);
assert.equal(advanceCursor(10,{...page,events:Array(51).fill(page.events[0])}),null);
assert.equal(actionOutcome(null,null),"unknown");
assert.equal(actionOutcome(503,"ERROR"),"unknown");
assert.equal(actionOutcome(409,"VERSION_CONFLICT"),"conflict");
assert.equal(actionOutcome(403,"ACCESS_DENIED"),"denied");
assert.equal(actionOutcome(429,"NOTIFICATION_THROTTLED"),"rejected");
for(const locale of ["en","fa-AF","ps-AF"] as const)
 for(const key of ["uncertain","verify","receipt","receiptPending","receiptConfirmed",
 "alertSent","alertSeen","replay","replayFallback","resync","syncIssue",
 "changed","retryAfterVerify","noAutoRetry"] as const)
  assert.ok(k28(locale,key).length>5,locale+" missing "+key);
console.info("PASS P28 kitchen: bounded cursor replay, invalid batch rejection, uncertain-write protection, receipt state, three locales.");
