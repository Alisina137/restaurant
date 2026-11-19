import assert from "node:assert/strict";
import {validPilotOperations,pilot32Signals} from "./pilot32";
import {p32} from "./pilot32-copy";
const at="2026-11-19T04:00:00.000Z";
const ready={
 tenantId:"tenant-dev",locationId:"location-dev",minutes:60,
 from:at,checkedAt:at,evidence:"tenant_scoped_database_snapshot",
 pilotCertified:false,acceptedWindow:4,observedWindow:3,
 activeTickets:2,activeWithoutReport:1,oldestUnreportedAt:at,pickupPending:1,
 openVisits:2,openChecks:1,openCashierShifts:1,
 activeTables:10,publishedItems:15,pendingOutbox:2,
 oldestPendingOutboxAt:at,oldestPendingOutboxAgeSeconds:75,
 measurement:"Outbox delivery means internal in-app revision processing, NOT device delivery."
} as const;
assert.equal(validPilotOperations(ready,60),true);
assert.deepEqual(pilot32Signals(ready),["unreported","outbox","receipt"]);
assert.equal(validPilotOperations({...ready,pilotCertified:true},60),false,
 "A live metric must never attest a real shift or production readiness");
assert.equal(validPilotOperations({...ready,observedWindow:5},60),false);
assert.equal(validPilotOperations({...ready,activeWithoutReport:4},60),false);
assert.equal(validPilotOperations({...ready,pickupPending:4},60),false);
assert.equal(validPilotOperations({...ready,minutes:15},15),false);
assert.equal(validPilotOperations(ready,180),false);
assert.equal(validPilotOperations({...ready,pendingOutbox:0,oldestPendingOutboxAt:at},60),false);
assert.equal(validPilotOperations({...ready,pendingOutbox:0,
 oldestPendingOutboxAt:null,oldestPendingOutboxAgeSeconds:null},60),true);
assert.deepEqual(pilot32Signals({...ready,activeWithoutReport:0,
 oldestPendingOutboxAgeSeconds:59,pickupPending:0}),[]);
assert.deepEqual(pilot32Signals({...ready,activeWithoutReport:0,
 oldestPendingOutboxAgeSeconds:null,pickupPending:1}),["receipt"]);
assert.equal(validPilotOperations({...ready,tenantId:""},60),false);
assert.equal(validPilotOperations({...ready,measurement:""},60),false);
for(const locale of ["en","fa-AF","ps-AF"] as const)
 for(const key of ["title","subtitle","window","hour","three","six",
  "refresh","checked","failed","retry","accepted","observed","active",
  "missing","pickups","visits","checks","shifts","tables","menu",
  "outbox","outboxOldest","warning","unreported","outboxWarn",
  "receipt","normal","limits","methodology","windowNote"] as const)
  assert.ok(p32(locale,key).length>=3,locale+" missing "+key);
console.info("PASS P32 pure: strict database evidence, no fabricated signoff, tenant-scoped signals and 3-locale labeling.");
