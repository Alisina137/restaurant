import assert from "node:assert/strict";
import type {Board,Table} from "./floor";
import {floorMetrics,filterFloorTables,orderTab,selectableVisits} from "./mobile23-data";
import {m23} from "./mobile23-copy";
const table=(id:string,patch:Partial<Table>={}):Table=>({
 id,label:"Table "+id,sectionId:"hall",sectionName:"Main Hall",seats:4,status:"available",
 assignedWaiterId:null,assignedWaiterName:null,visitId:null,visitPartySize:null,
 visitOpenedAt:null,version:1,notes:"",...patch});
const board:Board={
 actorId:"waiter-1",role:"waiter",locationId:"kabul-1",
 sections:[{id:"hall",name:"Main Hall",sortOrder:1},{id:"terrace",name:"Terrace",sortOrder:2}],
 tables:[
  table("1",{status:"occupied",assignedWaiterId:"waiter-1",assignedWaiterName:"Mina",visitId:"visit-1",visitPartySize:2}),
  table("2",{status:"occupied",assignedWaiterId:"waiter-2",assignedWaiterName:"Ali",visitId:"visit-2",visitPartySize:3}),
  table("3",{status:"available",assignedWaiterId:"waiter-1",assignedWaiterName:"Mina"}),
  table("4",{status:"available",assignedWaiterId:"waiter-1",visitId:"stale-visit"}),
  table("5",{status:"cleaning",assignedWaiterId:"waiter-1"}),
  table("6",{status:"disabled",assignedWaiterId:"waiter-1"}),
  table("7",{sectionId:"terrace",sectionName:"Terrace",label:"میز هفت",assignedWaiterId:"waiter-1"}),
  table("8",{sectionId:"terrace",sectionName:"Terrace",label:"Upper Patio",assignedWaiterId:null}),
 ]
};
const metrics=floorMetrics(board);
assert.deepEqual(metrics,{all:8,mine:6,myOccupied:1,available:4,occupied:2,cleaning:1,disabled:1});
assert.equal(floorMetrics(null).myOccupied,0);
const view={tab:"mine" as const,status:null,section:"",query:""};
assert.equal(filterFloorTables(board,view).length,6);
assert.deepEqual(filterFloorTables(board,{...view,status:"occupied"}).map(x=>x.id),["1"]);
assert.deepEqual(filterFloorTables(board,{...view,section:"terrace"}).map(x=>x.id),["7"]);
assert.deepEqual(filterFloorTables(board,{...view,query:"  МINА  "}).length,0);
assert.deepEqual(filterFloorTables(board,{...view,query:"  MiNA  "}).map(x=>x.id),["1","3"]);
assert.deepEqual(filterFloorTables(board,{...view,query:"  میز  "}).map(x=>x.id),["7"]);
assert.equal(filterFloorTables(board,{...view,tab:"attention"}).length,0,
 "The attention queue must show real service/ready orders, not invented table state.");
assert.equal(filterFloorTables(board,{...view,tab:"all",section:"terrace",status:"available"}).length,2);
assert.deepEqual(selectableVisits(board).map(x=>x.id),["1"],
 "Only actual occupied visits assigned to the current waiter are eligible to order.");
assert.deepEqual(selectableVisits(null),[]);
for(const [input,want] of [["active","active"],["ready","ready"],["completed","completed"],
 ["preparing","active"],["../../admin","active"],[undefined,"active"]] as const)
 assert.equal(orderTab(input),want);
for(const locale of ["en","fa-AF","ps-AF"] as const)
 for(const key of ["workspace","menu","floor","openRequests","noRole","disconnected",
  "readyAlert","vibrationHelp","noAttention","chooseTable","orderOpen","navigation"] as const){
  const word=m23(locale,key);
  assert.ok(word.trim().length>2,locale+" "+key);
 }
console.info("PASS P23 mobile: genuine visit/role metrics, searchable multilingual floor filters, assigned-order safety, canonical order tabs and complete locale copy.");
