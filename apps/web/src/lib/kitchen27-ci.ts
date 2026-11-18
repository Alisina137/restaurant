import assert from "node:assert/strict";
import {elapsedMinutes,elapsedLabel,newTicketIds,preparedSummary,priority,validSummary,type KitchenOverview} from "./kitchen27";
import {k27} from "./kitchen27-copy";
const now=Date.parse("2026-11-18T09:00:00.000Z");
const ago=(minutes:number)=>new Date(now-minutes*60_000).toISOString();
assert.equal(elapsedMinutes(ago(4),now),4);
assert.equal(elapsedMinutes(ago(61),now),61);
assert.equal(elapsedLabel(0),"0m");
assert.equal(elapsedLabel(61),"1h 1m");
assert.equal(elapsedLabel(null),"—");
assert.equal(elapsedMinutes("invalid",now),null);
assert.equal(elapsedMinutes(new Date(now+30000).toISOString(),now),0);
assert.equal(priority("new",ago(14),null,now),"normal");
assert.equal(priority("preparing",ago(15),null,now),"attention");
assert.equal(priority("ready",ago(90),ago(2),now),"normal","Ready-age starts at readiness");
assert.equal(priority("ready",ago(90),ago(17),now),"attention");
assert.equal(priority("picked_up",ago(19),null,now),"attention");
assert.deepEqual(newTicketIds(new Set(["a"]),new Set(["a","b"]),false),[]);
assert.deepEqual(newTicketIds(new Set(["a"]),new Set(["a","b"]),true),["b"]);
assert.deepEqual(newTicketIds(new Set(["a"]),new Set(["a"]),true),[]);
assert.deepEqual(preparedSummary([{kitchenStatus:"new"},{kitchenStatus:"preparing"},
 {kitchenStatus:"ready"},{kitchenStatus:"picked_up"},{kitchenStatus:"served"}]),{ready:3,total:5});
const valid:KitchenOverview={new:1,preparing:2,ready:3,waiting15m:1,
 oldestNewAt:ago(17),oldestPreparingAt:ago(11),oldestReadyAt:ago(1),checkedAt:new Date(now).toISOString()};
assert.equal(validSummary(valid),true);
assert.equal(validSummary({...valid,ready:-1}),false);
assert.equal(validSummary({...valid,new:"five"}),false);
assert.equal(validSummary({...valid,oldestNewAt:42}),false);
assert.equal(validSummary(null),false);
for(const locale of ["en","fa-AF","ps-AF"] as const)
 for(const key of ["board","subtitle","incoming","prepping","handoff","attention",
 "tableSearch","clearSearch","lineProgress","itemNotes","orderNotes","readySince",
 "confirmReady","markRemaining","updatedInOtherTab","stale","pollOnly","liveStream",
 "allSorted","soundBlocked","invalidDate","noMoreHandoff"] as const)
  assert.ok(k27(locale,key).length>3,locale+" missing "+key);
console.info("PASS P27 kitchen selectors: genuine counts, elapsed priority, partial prep, foreground alert baseline, three-language copy.");
