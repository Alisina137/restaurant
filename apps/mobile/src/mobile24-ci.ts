import assert from "node:assert/strict";
import {seatingValidation,serviceActionAllowed,tableOperations,readyToDeliver,visitOrderCount} from "./mobile24-ops";
import {m24} from "./mobile24-copy";
import type {Table} from "./floor";
import type {ServiceRequest} from "./service-copy";
function makeTable(status:Table["status"],visitId:string|null):Table{
 return {id:"table-24",label:"Table 24",sectionName:"Hall",sectionId:"hall",seats:3,
  status,assignedWaiterId:"waiter-24",assignedWaiterName:"Waiter",
  visitId,visitOpenedAt:visitId?"2026-11-17T00:00:00.000Z":null,
  visitPartySize:visitId?2:null,version:3,notes:""};
}
assert.equal(seatingValidation("1",3),"ok");
assert.equal(seatingValidation(" 2 ",3),"ok");
assert.equal(seatingValidation("3",3),"ok");
for(const invalid of ["", "0", "-1", "3.5","1e1","31","99","abc","1.0","2 2","202","٠٢"]){
 assert.equal(seatingValidation(invalid,3),"invalid","Invalid guest count must reject "+invalid);
}
assert.equal(seatingValidation("4",3),"capacity","Over-capacity waiter cannot open");
assert.equal(seatingValidation("4",3,"manager"),"ok","Only manager may approve over-capacity group");
assert.equal(seatingValidation("30",30),"ok");assert.equal(seatingValidation("30",29),"capacity");
assert.deepEqual(tableOperations(null,false),
 {canSeat:false,canClean:false,canServe:false,readOnly:true});
assert.deepEqual(tableOperations(makeTable("available",null),true),
 {canSeat:true,canClean:false,canServe:false,readOnly:false});
assert.deepEqual(tableOperations(makeTable("cleaning",null),true),
 {canSeat:false,canClean:true,canServe:false,readOnly:false});
assert.deepEqual(tableOperations(makeTable("occupied","visit-24"),true),
 {canSeat:false,canClean:false,canServe:true,readOnly:false});
assert.deepEqual(tableOperations(makeTable("occupied",null),true),
 {canSeat:false,canClean:false,canServe:false,readOnly:false},
 "Ghost occupied without visit cannot access order or PIN operations");
assert.deepEqual(tableOperations(makeTable("disabled",null),true),
 {canSeat:false,canClean:false,canServe:false,readOnly:false});
assert.deepEqual(tableOperations(makeTable("occupied","visit-24"),false),
 {canSeat:false,canClean:false,canServe:false,readOnly:true},
 "Unassigned waiter cannot create orders or access visit PIN");
const req={status:"pending",version:1} as ServiceRequest;
assert.equal(serviceActionAllowed(req,"acknowledge"),true);
assert.equal(serviceActionAllowed(req,"resolve"),true);
assert.equal(serviceActionAllowed({...req,status:"acknowledged"},"acknowledge"),false);
assert.equal(serviceActionAllowed({...req,status:"acknowledged"},"resolve"),true);
assert.equal(serviceActionAllowed({...req,status:"resolved"},"resolve"),false);
assert.equal(serviceActionAllowed({...req,status:"cancelled"},"acknowledge"),false);
for(const yes of ["ready","picked_up"])assert.equal(readyToDeliver(yes),true);
for(const no of ["accepted","new","preparing","served","voided"])assert.equal(readyToDeliver(no),false);
assert.equal(visitOrderCount(null),null,"Unavailable orders is not a fake zero");
assert.equal(visitOrderCount([]),0);assert.equal(visitOrderCount([{id:"o1"},{id:"o2"}]),2);
for(const locale of ["en","fa-AF","ps-AF"] as const)
 for(const key of ["tableDetails","seatGuests","capacityExceeded","pinRotateWarning",
  "pinExpires","guestPinSafety","settlementHint","requestUnavailable","noRequests",
  "requestHandled","noAssigned","maxParty","requestHistory","requestUpdated",
  "noConnection","statusPending","showAll"] as const)
  assert.ok(m24(locale,key).trim().length>3,locale+" missing "+key);
console.info("PASS P24 pure native actions: strict party/capacity validation, role-protected visit state, request transitions, food handoff, unavailable counts and all 3 locales.");
