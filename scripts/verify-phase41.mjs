import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const get=path=>readFileSync(path,"utf8");
const board=get("apps/web/src/components/pilot41-readiness-board.tsx");
const model=get("apps/web/src/lib/pilot41-readiness.ts");
const review=get("apps/web/src/components/phase14-pilot.tsx");
const api=get("apps/api/src/phase14-pilot.ts");
const css=get("apps/web/src/app/pilot41.css");
const layout=get("apps/web/src/app/layout.tsx");
for(const piece of ['pilotReadinessPlan(snapshot)','p.steps.map(','step.kind==="incident"',
 'step.kind==="gate"','step.kind==="platform_review"','step.kind==="platform_hold"',
 'onChooseGate(key!)','role="status"','role="note"'])
 assert.ok(board.includes(piece),"Missing user-visible action path: "+piece);
for(const locale of ['en:', '"fa-AF":', '"ps-AF":'])
 assert.ok(board.includes(locale),"Missing locale "+locale);
assert.ok(review.includes("<PilotReadinessBoard snapshot={data} locale={locale} isPlatform={isPlatform}"),
 "Show same action plan to owner and independent platform reviewer");
assert.ok(review.includes('document.getElementById("p14-gate-form")?.scrollIntoView'),
 "Gate actions must scroll to existing real evidence form, not a stub");
assert.ok(model.includes('externallyCertified:false')&&
 model.includes('steps.push({kind:"externally_unverified"})'),
 "Never imply CI metrics or internal signatures certify physical release");
assert.ok(model.includes("input.incidents.blocking===0")&&
 model.includes('input.ownerSignoff.fingerprint===input.fingerprint'),
 "Require current owner sign-off and zero P0/P1 blockers");
assert.ok(model.includes('input.platformDecision.ownerSignoffId===input.ownerSignoff?.id'),
 "Platform signature must target current owner sign-off");
assert.ok(api.includes("incidentEvent:")||api.includes("incidentEvent:"),
 "Incident changes must still invalidate signed evidence");
assert.ok(api.includes('tenantPilotRouter.post("/signoff"')&&
 api.includes('platformPilotRouter.post("/:id/decision"'),
 "Keep original real signoff routes and authorization checks");
assert.ok(css.includes("@media(max-width:510px)")&&
 css.includes(".p41-open:focus-visible"),"Responsive keyboard action button required");
assert.ok(layout.includes('import "./pilot41.css"'),"Load design styles");
console.info("PASS Phase 41: owner and platform readiness actions, 3 locales, signature freshness, incident priority, no auto-GO.");
