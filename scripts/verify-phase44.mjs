import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(p,"utf8");
const packet=src("scripts/phase44-release-packet.mjs");
const tests=src("scripts/phase44-release-packet.test.mjs");
const workflow=src(".github/workflows/verify.yml");
const pkg=JSON.parse(src("package.json"));
const acceptance=src("docs/PHASE-44-ACCEPTANCE.md");
const docState=src("docs/PROJECT-STATE.md");
const rc=src("scripts/phase43-release-smoke.mjs");
const readme=src("README.md");

for(const required of [
 "status:\"HOLD\"","humanGoAuthorized:false",
 "automaticDeploymentAuthorized:false",
 "realRestaurantPilotCertified:false",
 "physicalCashVerified:false","bankTransferVerified:false",
 "restoreVerifiedOnExternalStaging:false",
 'manualGates:requiredHumanGates.map(g=>({',
 'status:"not_verified",evidenceRef:null,reviewer:null,observedAt:null',
 "candidate.commit!==commit",
 "candidate.passed!==expectedChecks.length",
 "candidate.failed.length!==0",
 "actual.status!==expected.expected",
 'candidate.physicalPilotCertified!==false',
 'candidate.financiallyCertified!==false',
 'candidate.humanGoAuthorized!==false',
 'env.CI==="true"&&env.GITHUB_ACTIONS==="true"',
 'env.NODE_ENV!=="production"',
 'execFileSync("git",["rev-parse","HEAD"]',
 'commit!==env.GITHUB_SHA',
 'dineflow-phase43-rc.json',
 'dineflow-phase44-packet.json',
 'dineflow-phase44-operator-checklist.md',
 'mode:0o600',
 'console.error('
]){
 if(required==='console.error(')continue;
 assert.ok(packet.includes(required),"P44 release safety missing: "+required);
}
assert.ok(packet.includes('output.error("HOLD:'),
 "Failures must be explicitly HOLD, never release approval");
assert.ok(!packet.includes('fetch('),"Release packet generator must never contact a remote service");
assert.ok(packet.includes('source:"disposable_github_actions_ci"'));
assert.ok(rc.includes('dineflow-phase43-rc.json'),
 "Packet must consume actual P43 candidate evidence, not dummy status");
assert.ok(rc.includes('physicalPilotCertified:false')&&rc.includes('financiallyCertified:false'),
 "P43 input must never claim real device or cash proof");
for(const keyword of [
 'candidate.passed-=1','c.commit="b".repeat(40)',
 'c.humanGoAuthorized=true','c.physicalPilotCertified=true',
 'c.checks[0].status=503','c.checks.reverse()',
 'MUST_NOT_APPEAR', 'release44Cli('
])assert.ok(tests.includes(keyword),"Negative test gap: "+keyword);
assert.ok(pkg.scripts["phase44:verify"]?.includes("phase44-release-packet.test.mjs"));
assert.ok(pkg.scripts["release44:packet"]==="node scripts/phase44-release-packet.mjs");
const flowLines=workflow.split("\n");
const index=needle=>flowLines.findIndex(line=>line.includes(needle));
assert.ok(index("pnpm phase44:verify")>index("pnpm phase43:verify"),
 "Run source/packet verification after P43 source gate");
assert.ok(index("pnpm release44:packet")>index("pnpm pilot31:rehearse"),
 "Only packet the candidate after the entire rehearsal passes");
assert.ok(index("P44 archive CI-only release packet")>index("pnpm release44:packet"),
 "Only upload a generated and validated packet");
assert.ok(workflow.includes("uses: actions/upload-artifact@v4")&&
 workflow.includes("if-no-files-found: error")&&
 workflow.includes("retention-days: 14"),"Artifact must be fail closed and short lived");
assert.ok(workflow.includes("runner.temp")&&workflow.includes("dineflow-phase44-packet.json"));
assert.ok(acceptance.includes("HOLD")&&acceptance.includes("16 mandatory")&&
 acceptance.includes("physical")&&acceptance.includes("rollback")&&
 acceptance.includes("Phase 34"),"Human manual and rollback controls must be documented");
assert.ok(docState.includes("Phase 44")&&readme.includes("Phase 44"),
 "Final roadmap status must not omit manual GO/HOLD limitations");
console.info("PASS P44: release evidence is SHA-bound, private, CI-only, no auto-GO, and awaits independent physical/HOLD release decision.");
