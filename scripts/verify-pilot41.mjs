import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const get=p=>readFileSync(p,"utf8");
const api=get("apps/api/src/phase14-pilot.ts");
const view=get("apps/web/src/components/phase14-pilot.tsx");
const panel=get("apps/web/src/components/pilot41-action-queue.tsx");
const model=get("apps/web/src/lib/pilot41.ts");
const incident=get("apps/web/src/components/pilot-incident-register.tsx");
const styles=get("apps/web/src/app/pilot41.css");
const layout=get("apps/web/src/app/layout.tsx");
const pkg=JSON.parse(get("package.json"));
const script=get("apps/api/src/phase41-ci.ts");

for(const clause of [
 "latestGateIds=q.select({id:max(pilotGateEvent.id)})",
 "groupBy(pilotGateEvent.gateKey)",
 "inArray(pilotGateEvent.id,latestGateIds)",
 "latestSignoffIds=q.select({id:max(pilotSignoffEvent.id)})",
 "groupBy(pilotSignoffEvent.stage)",
 "inArray(pilotSignoffEvent.id,latestSignoffIds)",
 "incidentEvent:"
])assert.ok(api.includes(clause),"Pilot query missing "+clause);
assert.ok(!api.includes(".limit(500)")&&!api.includes(".limit(50)"),
 "Pilot current evidence may not be truncated by global event history");
assert.ok(api.includes("incidentSummary.blocking===0"),
 "Real P0/P1 release blockers must remain enforced");
assert.ok(api.includes("await lock(tx,a.tenantId!)"),"Owner signoff must keep the tenant transaction lock");
assert.ok(model.includes('state.gates.length===12')&&
 model.includes("blocking===0"),"Never offer owner approval with missing evidence");
assert.ok(model.includes('kind:"external_verification"'),"Record-only approval must not imply production GO");
assert.ok(view.includes("<PilotActionQueue state={data}")&&
 view.includes('id={"p14-gate-"+g.key}')&&view.includes('id="p14-signoff"'),
 "Panel actions must link to actual gate or signature controls");
assert.ok(incident.includes('id="p33-incident-register"'),"Incident tasks must navigate to real register");
for(const clause of [
 '"fa-AF":','"ps-AF":','en:',"critical_incidents","failed_gate",
 "untested_gate","platform_review","p2_followup","external_verification",
 "askOwner","askPlatform"
])assert.ok(panel.includes(clause),"Three-locale action panel missing "+clause);
assert.ok(styles.includes("@media(max-width:680px)"),"Touch-size responsive pilot action cards required");
assert.ok(layout.includes('import "./pilot41.css"'),"New pilot panel styles not enabled");
assert.ok(pkg.scripts["pilot41:verify"]?.includes("pilot41-ci.ts"),
 "CI must execute pure action logic");
assert.ok(script.includes("length:520")&&script.includes("length:58"),
 "Real disposable regression must exceed prior global 500/50 cutoffs");
console.info("PASS P41: latest-per-gate/signature DB queries, P0/P1 signoff locks, responsive three-locale human action queue and deep-history tests.");
