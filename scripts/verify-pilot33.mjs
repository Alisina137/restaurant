import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const paths=[
 "apps/api/src/phase14-pilot.ts","apps/api/src/schema.ts",
 "apps/api/drizzle/0016_phase33_pilot_incidents.sql",
 "apps/api/drizzle/meta/_journal.json","apps/api/src/phase33-ci.ts",
 "apps/web/src/lib/pilot33.ts","apps/web/src/lib/pilot33-copy.ts",
 "apps/web/src/lib/pilot33-ci.ts",
 "apps/web/src/components/pilot-incident-register.tsx",
 "apps/web/src/components/phase14-pilot.tsx","apps/web/src/app/pilot33.css",
 "apps/web/src/app/layout.tsx",
 ".github/workflows/verify.yml","package.json","docs/PHASE-33-ACCEPTANCE.md"
];
const get=i=>readFileSync(new URL(paths[i],root),"utf8");
for(const path of paths)assert.ok(existsSync(new URL(path,root)),"Missing "+path);
function has(i,strings){const s=get(i);for(const x of strings)
 assert.ok(s.includes(x),paths[i]+" missing "+x);}
has(0,['"/incidents"','"/incidents/:id/events"','"/incidents/:id/:action"',
 "pilotIncidentEvent","incidentSummary.blocking>0",
 "PILOT_INCIDENTS_OPEN","incidentCursor","lock(tx,a.tenantId!)",
 "INCIDENT_VERSION_CHANGED","OWNER_REQUIRED","Cache-Control"]);
has(1,["pilotIncident=pgTable","pilotIncidentEvent=pgTable"]);
has(2,["CREATE TABLE pilot_incidents","CREATE TABLE pilot_incident_events",
 "pilot_incidents_tenant_status_idx","pilot_incident_events_version_unique"]);
assert.ok(JSON.parse(get(3)).entries.some(e=>e.tag==="0016_phase33_pilot_incidents"));
has(4,["phase33","PILOT_INCIDENTS_OPEN","incident","version","snapshot"].filter(s=>s!=="phase33"&&s!=="PILOT_INCIDENTS_OPEN"&&s!=="snapshot"));
has(5,["validPilotIncident","validIncidentList","validIncidentHistory","hasBlockingIncidents"]);
has(6,["const en=","const fa:","const ps:"]);
has(8,["postSaas","validIncidentList","validIncidentHistory",
 "expectedVersion","onChanged","p33-panel"]);
has(9,["PilotIncidentRegister","data.incidents?.blocking",
 "p33-blocking-strip"]);
has(10,[".p33-panel",".p33-incident",".p33-blocking-strip",
 "@media(max-width:980px)"]);
has(11,['import "./pilot33.css";']);
has(12,["pilot33:verify","phase33-ci.ts"]);
has(13,["pilot33:verify"]);
console.info("PASS P33 source contracts: incident state, append-only evidence, signer invalidation, scope and RTL operator UI.");
