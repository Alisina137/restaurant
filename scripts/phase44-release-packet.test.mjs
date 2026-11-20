import test from "node:test";
import assert from "node:assert/strict";
import {webRoutes,anonymousApi,roleChecks} from "./phase43-release-smoke.mjs";
import {
 requiredHumanGates,expectedProbeCounts,validatePhase43Candidate,
 buildPhase44Packet,markdownPacket,release44Cli
} from "./phase44-release-packet.mjs";

const sha="a".repeat(40);
const safeCandidate=()=>({
 designation:"CI RELEASE CANDIDATE SIMULATION — NOT PHYSICAL OR FINANCIAL GO",
 commit:sha,checkedAt:"2026-11-20T12:34:56.000Z",
 physicalPilotCertified:false,financiallyCertified:false,humanGoAuthorized:false,
 checks:[
  ...webRoutes.map(([id,,expected])=>({id,expected,status:expected,ok:true})),
  ...anonymousApi.map(([id,,expected])=>({id,expected,status:expected,ok:true})),
  ...roleChecks.map(([id,,,expected])=>({id,expected,status:expected,ok:true}))
 ],
 total:expectedProbeCounts.total,passed:expectedProbeCounts.total,failed:[]
});
const meta={commit:sha,runId:"456789012",runAttempt:"2",createdAt:"2026-11-20T13:00:00Z"};
test("full production-built CI evidence is acceptable for a strictly HOLD packet",()=>{
 const p=buildPhase44Packet(safeCandidate(),meta);
 assert.equal(expectedProbeCounts.total,webRoutes.length+anonymousApi.length+roleChecks.length);
 assert.equal(expectedProbeCounts.total,58);
 assert.equal(p.schema,"dineflow.phase44.release-candidate.v1");
 assert.equal(p.status,"HOLD");
 assert.equal(p.decision.current,"HOLD");
 assert.equal(p.automatedDecision,"CI_CHECKS_PASSED_ONLY");
 assert.equal(p.humanGoAuthorized,false);
 assert.equal(p.automaticDeploymentAuthorized,false);
 assert.equal(p.physicalCashVerified,false);
 assert.equal(p.bankTransferVerified,false);
 assert.equal(p.realRestaurantPilotCertified,false);
 assert.equal(p.restoreVerifiedOnExternalStaging,false);
 assert.equal(p.provenance.gitCommit,sha);
 assert.equal(p.provenance.githubRunId,meta.runId);
 assert.equal(p.provenance.githubRunAttempt,2);
 assert.equal(p.automatedEvidence.results.length,58);
 assert.ok(p.manualGates.length>=15);
 assert.ok(p.manualGates.every(g=>g.status==="not_verified"&&
  g.evidenceRef===null&&g.reviewer===null&&g.observedAt===null));
 assert.ok(requiredHumanGates.some(g=>g.id==="independent_platform_decision"));
 assert.ok(requiredHumanGates.some(g=>g.id==="bank_transfer_independent"));
 assert.ok(requiredHumanGates.some(g=>g.id==="postgres_restore_and_rollback"));
 const checklist=markdownPacket(p);
 assert.match(checklist,/HOLD — NOT APPROVED FOR PRODUCTION/);
 assert.match(checklist,/Two-person independent GO\/HOLD/);
 assert.ok(checklist.includes(sha));
 assert.equal(checklist.split("- [ ]").length,p.manualGates.length+1);
 assert.ok(!checklist.includes("- [x]"),"No automated manual pass");
});
test("rejects missing, foreign, failed, reordered or dishonest candidate evidence",()=>{
 const changes=[
  c=>{c.commit="b".repeat(40);},
  c=>{c.checkedAt="not-a-time";},
  c=>{c.humanGoAuthorized=true;},
  c=>{c.physicalPilotCertified=true;},
  c=>{c.financiallyCertified=true;},
  c=>{c.total-=1;},
  c=>{c.passed-=1;},
  c=>{c.failed.push("bad-check");},
  c=>{c.checks.pop();},
  c=>{c.checks[0].status=503;},
  c=>{c.checks[0].ok=false;},
  c=>{c.checks[0].expected=404;},
  c=>{c.checks[0].id="leaked-route";},
  c=>{c.checks.reverse();},
  c=>{c.designation="PRODUCTION APPROVED";}
 ];
 for(const change of changes){
  const c=safeCandidate();change(c);
  assert.throws(()=>validatePhase43Candidate(c,sha));
  assert.throws(()=>buildPhase44Packet(c,meta));
 }
 assert.throws(()=>buildPhase44Packet(safeCandidate(),{...meta,commit:"bad"}));
 assert.throws(()=>buildPhase44Packet(safeCandidate(),{...meta,runId:"not-numeric"}));
 assert.throws(()=>buildPhase44Packet(safeCandidate(),{...meta,runAttempt:"0"}));
 assert.throws(()=>buildPhase44Packet(safeCandidate(),{...meta,createdAt:"bad"}));
});
test("whitelists only known public probe labels and HTTP statuses into packet",()=>{
 const candidate=safeCandidate();
 candidate.checks[0].authorizationSecret="MUST_NOT_APPEAR";
 candidate.unrecognizedPrivateData={cookie:"MUST_NOT_APPEAR"};
 const packet=buildPhase44Packet(candidate,meta);
 const raw=JSON.stringify(packet)+markdownPacket(packet);
 assert.ok(!raw.includes("MUST_NOT_APPEAR"),"Packet must not copy unknown API data");
 assert.ok(!raw.includes("Cookie"),"Packet has no auth cookie");
 assert.ok(!raw.includes("DATABASE_URL"),"Packet has no environment configuration");
 assert.ok(packet.automatedEvidence.results.every(x=>
  Object.keys(x).sort().join(",")==="httpStatus,id"));
});
test("local machine cannot generate packet or claim GO using CI-only entrypoint",()=>{
 const lines=[];
 const io={log:x=>lines.push(x),error:x=>lines.push(x)};
 const code=release44Cli({CI:"false",GITHUB_ACTIONS:"false",DATABASE_URL:"postgresql://x@y",
  RUNNER_TEMP:"/tmp"},io);
 assert.equal(code,2);
 assert.match(lines.join(" "),/HOLD/);
 const bad=release44Cli({CI:"true",GITHUB_ACTIONS:"true",
  DATABASE_URL:"postgresql://user:pw@production.example:5432/dineflow_ci",
  RUNNER_TEMP:"/tmp"},io);
 assert.equal(bad,2);
});
