import assert from "node:assert/strict";
import {eligibleObservationIds,validKitchenVisibility,validObservationResult} from "./kitchen30";
import {k30} from "./kitchen30-copy";
const id1="70e76694-d750-4c78-b41c-80c32b82e922";
const id2="7e574037-7235-4f89-8a08-9d30b7d631d0";
const row=(id:string,ticketId:string,version=1,status="new")=>
 ({id,ticketId,ticketVersion:version,status});
const data=(version:number)=>({
 ticket:{version,pickupAcknowledgedAt:null},round:{orderNote:"Kitchen request",totalMinor:3000},
 lines:[{id:"dish",quantity:2,itemNameFa:"غذا",itemNamePs:"خواړه",
  itemNameEn:"Meal",kitchenStatus:"new" as const,note:"no spice",
  modifierSnapshot:[],unitPriceMinor:1500,lineTotalMinor:3000}]
});
const first=row("round1",id1),second=row("round2",id2);
const details={round1:data(1),round2:data(2)};
assert.deepEqual(eligibleObservationIds([first,second],details,new Set()),[id1],
 "Never report a ticket whose inline details do not match page version.");
assert.deepEqual(eligibleObservationIds([first,row("round2",id2,2)],details,new Set()),[id1,id2]);
assert.deepEqual(eligibleObservationIds([first],details,new Set([id1])),[]);
assert.deepEqual(eligibleObservationIds([first],{round1:{...data(1),lines:[]}},new Set()),[]);
assert.deepEqual(eligibleObservationIds([row("round1",id1,1,"served")],details,new Set()),[]);
assert.deepEqual(eligibleObservationIds([row("round1","random",1)],details,new Set()),[]);
assert.equal(eligibleObservationIds(Array(40).fill(first),details,new Set()).length,1);
const now="2026-11-18T06:32:00.000Z";
const visibility={minutes:60,from:now,checkedAt:now,acceptedCount:4,observedCount:3,
 displayMedianSeconds:2.1,displayP95Seconds:4.4,
 activeWithoutReceipt:1,oldestWithoutReceiptAt:now,evidence:"foreground_client_report"};
assert.equal(validKitchenVisibility(visibility),true);
assert.equal(validKitchenVisibility({...visibility,acceptedCount:2}),false,
 "KDS receipts cannot exceed accepted orders");
assert.equal(validKitchenVisibility({...visibility,displayMedianSeconds:5.2}),false);
assert.equal(validKitchenVisibility({...visibility,minutes:12}),false);
assert.equal(validKitchenVisibility({...visibility,evidence:"seen_by_human"}),false);
assert.equal(validKitchenVisibility({...visibility,observedCount:0,
 displayMedianSeconds:null,displayP95Seconds:null}),true);
assert.equal(validKitchenVisibility({...visibility,observedCount:0}),false);
assert.equal(validKitchenVisibility({...visibility,observedCount:1,
 displayMedianSeconds:null}),false);
assert.equal(validKitchenVisibility({...visibility,activeWithoutReceipt:-1}),false);
assert.equal(validObservationResult({accepted:0,submitted:1},1),true);
assert.equal(validObservationResult({accepted:1,submitted:1},1),true);
assert.equal(validObservationResult({accepted:2,submitted:1},1),false);
assert.equal(validObservationResult({accepted:1,submitted:0},1),false);
assert.equal(validObservationResult(null,1),false);
for(const locale of ["en","fa-AF","ps-AF"] as const)
 for(const key of ["section","explain","observed","median","p95",
  "coverage","noSample","missing","oldest","signal","seconds",
  "refresh","error","deliveryError","historical","measurement",
  "scoped","retries"] as const)
  assert.ok(k30(locale,key).length>4,`${locale}: ${key}`);
console.info("PASS P30: foreground report ticket selection, idempotent response, null-sample and multilingual honesty.");
