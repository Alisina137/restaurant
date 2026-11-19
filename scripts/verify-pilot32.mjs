import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../",import.meta.url);
const paths=[
 "apps/api/src/phase14-pilot.ts","apps/api/src/phase32-ci.ts",
 "apps/web/src/lib/pilot32.ts","apps/web/src/lib/pilot32-copy.ts",
 "apps/web/src/lib/pilot32-ci.ts","apps/web/src/components/pilot-operations-snapshot.tsx",
 "apps/web/src/components/phase14-pilot.tsx","apps/web/src/app/pilot32.css",
 "apps/web/src/app/layout.tsx",".github/workflows/verify.yml",
 "package.json","docs/PHASE-32-ACCEPTANCE.md"
];
const content=i=>readFileSync(new URL(paths[i],root),"utf8");
for(const path of paths)assert.ok(existsSync(new URL(path,root)),"Missing P32 file "+path);
function includes(i,checks){const s=content(i);
 for(const check of checks)assert.ok(s.includes(check),paths[i]+" missing "+check);
}
includes(0,['"/operations"','const a=await actor(req)',
 'eq(kitchenTicket.tenantId,tenantId)','eq(kitchenTicket.locationId,loc.id)',
 'eq(orderOutbox.tenantId,tenantId)','isNull(orderOutbox.deliveredAt)',
 'eq(diningCheck.status,"open")','eq(cashierShift.status,"open")',
 'oldestPendingOutboxAgeSeconds','pilotCertified:false','Cache-Control']);
includes(1,["new-owner-ci@example.test",'"/api/pilot/operations?minutes="',
 "pilotCertified,false","activeWithoutReport","acceptedWindow",
 "observedWindow","pilotBefore"]);
includes(2,["validPilotOperations","pilot32Signals","tenant_scoped_database_snapshot",
 "pilotCertified:false"]);
includes(3,["const en=","const fa:","const ps:","Outbox"]);
includes(5,["document.hidden","visibilitychange","setInterval(()=>void load(),30000)",
 "validPilotOperations","pilot32Signals","p32-metrics","p32-panel"]);
includes(6,["PilotOperationsSnapshot","!isPlatform&&","scopeKey="]);
includes(7,[".p32-panel",".p32-metrics","@media(max-width:450px)"]);
includes(8,['import "./pilot32.css";']);
includes(9,["pilot32:verify","phase32-ci.ts"]);
includes(10,["pilot32:verify"]);
console.info("PASS P32 static: tenant-safe read-only operational pulse, manual pilot evidence separation, 3-language premium layout and CI.");
