import assert from "node:assert/strict";
import {currentDisplayMode,displayTime,validCardDetail,validKitchenCardPage,validKitchenPulse} from "./kitchen29";
import {k29} from "./kitchen29-copy";
const now="2026-11-18T06:00:00.000Z";
const detail={round:{orderNote:"no salt",totalMinor:12500},ticket:{version:2,pickupAcknowledgedAt:null},
 lines:[{id:"line-1",quantity:2,itemNameFa:"غذا",itemNameEn:"Rice",
  itemNamePs:"وریجې",note:"no peanuts",kitchenStatus:"new",
  modifierSnapshot:[],unitPriceMinor:6250,lineTotalMinor:12500}]};
assert.equal(validCardDetail(detail,2),true);
assert.equal(validCardDetail(detail,1),false,"Stale ticket version must disable writes");
assert.equal(validCardDetail({...detail,lines:[]},2),false,"Missing food details cannot authorize cooking");
assert.equal(validCardDetail({...detail,lines:[{...detail.lines[0],modifierSnapshot:null}]},2),false);
const page={items:[{id:"round",ticketId:"t1",ticketVersion:2,status:"new"}],
 total:1,page:1,perPage:10,serverMs:7.2,detailsByRound:{round:detail}};
assert.equal(validKitchenCardPage(page),true);
assert.equal(validKitchenCardPage({...page,serverMs:-1}),false);
assert.equal(validKitchenCardPage({...page,perPage:500}),false);
assert.equal(validKitchenCardPage({...page,detailsByRound:{}}),false);
const pulse={minutes:60,from:now,checkedAt:now,completed:1,prepMedianMinutes:3.1,
 prepP95Minutes:3.9,pendingReceipt:2,oldestPendingReceiptAt:null};
assert.equal(validKitchenPulse(pulse),true);
assert.equal(validKitchenPulse({...pulse,completed:-1}),false);
assert.equal(validKitchenPulse({...pulse,minutes:10}),false);
assert.equal(validKitchenPulse({...pulse,prepP95Minutes:NaN}),false);
assert.equal(validKitchenPulse({...pulse,prepP95Minutes:null,prepMedianMinutes:null,completed:0}),true);
assert.equal(currentDisplayMode("large"),"large");
assert.equal(currentDisplayMode("invalid"),"standard");
assert.equal(currentDisplayMode(null),"standard");
assert.equal(displayTime(null),"—");
assert.equal(displayTime(1.234),"1.2");
for(const locale of ["en","fa-AF","ps-AF"] as const)
 for(const key of ["pulse","pulseNote","median","p95","pending","oldestPending",
  "window","lastHour","lastThree","lastSix","noSample","large","standard",
  "largeHint","failed","retry","serverTime","oneRequest","readOnly"] as const)
  assert.ok(k29(locale,key).length>=3,locale+" missing "+key);
console.info("PASS P29 pure: safe bounded card payloads, stale version protection, real pulse validation and 3-locale display controls.");
