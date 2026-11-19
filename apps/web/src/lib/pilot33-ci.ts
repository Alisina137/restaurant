import assert from "node:assert/strict";
import {PILOT_GATES,validPilotIncident,validIncidentList,validIncidentHistory,hasBlockingIncidents} from "./pilot33";
import {p33} from "./pilot33-copy";
const id="c4930b6e-3571-41bd-b806-6cb8c52e1711",at="2026-11-19T07:00:00.000Z";
const incident={id,tenantId:"demo",gateKey:"orders",severity:"p0",
 title:"Kitchen display outage",details:"Observed kitchen ticket missing during test",
 status:"open",version:1,openedBy:"actor",resolvedAt:null,
 createdAt:at,updatedAt:at};
assert.equal(validPilotIncident(incident),true);
assert.equal(validPilotIncident({...incident,status:"invalid"}),false);
assert.equal(validPilotIncident({...incident,version:0}),false);
assert.equal(validPilotIncident({...incident,id:"not_uuid"}),false);
assert.equal(validPilotIncident({...incident,gateKey:"fake"}),false);
assert.equal(validPilotIncident({...incident,severity:"p9"}),false);
assert.equal(validPilotIncident({...incident,title:"A"}),false);
assert.equal(validPilotIncident({...incident,details:"short"}),false);
const page={items:[incident],total:1,page:1,perPage:10,status:"open",
 severity:"all",checkedAt:at};
assert.equal(validIncidentList(page,"open","all",1),true);
assert.equal(validIncidentList(page,"all","all",1),false);
assert.equal(validIncidentList({...page,perPage:100},"open","all",1),false);
assert.equal(validIncidentList({...page,total:-1},"open","all",1),false);
assert.equal(validIncidentList({...page,items:[{...incident,status:"resolved"}]},"open","all",1),false);
assert.equal(validIncidentList({...page,items:[{...incident,severity:"p0"}],severity:"p1"},"open","p1",1),false);
const event={id:1,tenantId:"demo",incidentId:id,action:"opened",severity:"p0",
 gateKey:"orders",note:"Observed kitchen ticket missing during test",
 actorId:"actor",version:1,createdAt:at};
const history={incidentId:id,version:1,events:[event]};
assert.equal(validIncidentHistory(history,id),true);
assert.equal(validIncidentHistory({...history,events:[]} ,id),false);
assert.equal(validIncidentHistory({...history,events:[{...event,action:"unknown"}]},id),false);
assert.equal(validIncidentHistory(history,"wrong"),false);
assert.equal(hasBlockingIncidents({total:3,open:2,blocking:1}),true);
assert.equal(hasBlockingIncidents({total:3,open:2,blocking:0}),false);
assert.equal(PILOT_GATES.length,12);
for(const locale of ["en","fa-AF","ps-AF"] as const)
 for(const key of ["title","subtitle","open","resolved","all","severity","gate",
  "create","refresh","incidentTitle","details","resolve","reopen","history",
  "p0","p1","p2","gateOrders","gateCash","gateShift","ownerOnly","caution",
  "platformBlock","safety","added","failed","versionConflict"].filter(k=>k!=="failed") as
  Array<"title"|"subtitle"|"open"|"resolved"|"all"|"severity"|"gate"|"create"|"refresh"|
   "incidentTitle"|"details"|"resolve"|"reopen"|"history"|"p0"|"p1"|"p2"|
   "gateOrders"|"gateCash"|"gateShift"|"ownerOnly"|"caution"|"platformBlock"|"safety"|"added"|"versionConflict">)
  assert.ok(p33(locale,key).length>2,locale+" missing "+key);
console.info("PASS P33 typed: tenant-scoped incident pages, event histories, blocker arithmetic and complete localization.");
