import {pathToFileURL} from "node:url";
import {readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {webRoutes,anonymousApi,roleChecks} from "./phase43-release-smoke.mjs";

/**
 * Phase 44: produce a *software-only* release-candidate evidence packet.
 * This module is intentionally read-only and does not authorize deployment,
 * update a tenant pilot, grant platform approval or claim physical evidence.
 */
export const requiredHumanGates=Object.freeze([
 {id:"release_provenance",owner:"release_engineer",task:"Match deployed web/API image digests to reviewed git SHA and migration set"},
 {id:"staging_https_preflight",owner:"release_engineer",task:"Run external staging HTTPS smoke and record approved evidence"},
 {id:"real_guest_qr_pin",owner:"restaurant_owner",task:"Scan issued table QR and enter PIN on a physical guest device"},
 {id:"waiter_android_offline",owner:"restaurant_owner",task:"Rehearse waiter Android submission, lost response, relaunch and same-key recovery"},
 {id:"kitchen_ticket_and_pickup",owner:"restaurant_owner",task:"Observe physical kitchen ticket, timing, status and pickup acknowledgment"},
 {id:"two_device_table_handoff",owner:"restaurant_owner",task:"Test two real tablets, staff reassignment and active-visit handoff"},
 {id:"cash_drawer_and_change",owner:"restaurant_cashier",task:"Count float, cash tender, change, end-of-shift drawer and variance"},
 {id:"bank_transfer_independent",owner:"financial_reviewer",task:"Independently verify actual transfer settlement against bank/provider"},
 {id:"refund_and_immutable_receipt",owner:"financial_reviewer",task:"Reconcile real refund, immutable receipt and actual printed output"},
 {id:"postgres_restore_and_rollback",owner:"release_engineer",task:"Demonstrate isolated encrypted backup restore and compatible app rollback"},
 {id:"monitoring_and_incident_response",owner:"platform_operator",task:"Check alerts, on-call ownership, P0/P1 drill and restoration health"},
 {id:"rtl_accessibility_and_bandwidth",owner:"restaurant_owner",task:"Complete Dari/Pashto RTL, keyboard/accessibility and weak-Wi-Fi device trials"},
 {id:"supervised_restaurant_shift",owner:"restaurant_owner",task:"Record a complete staffed real restaurant shift and observations"},
 {id:"zero_blocking_incidents",owner:"restaurant_owner",task:"Verify no unresolved P0/P1 and preserve append-only incident evidence"},
 {id:"owner_current_signature",owner:"restaurant_owner",task:"Sign all 12 current real pilot gates against current fingerprint"},
 {id:"independent_platform_decision",owner:"platform_operator",task:"Independently review current owner evidence and record explicit GO or HOLD"},
]);

const SHA=/^[0-9a-f]{40}$/i;
const expectedChecks=[
 ...webRoutes.map(([id,,expected])=>({id,expected})),
 ...anonymousApi.map(([id,,expected])=>({id,expected})),
 ...roleChecks.map(([id,,,expected])=>({id,expected}))
];
export const expectedProbeCounts=Object.freeze({
 web:webRoutes.length,anonymous:anonymousApi.length,role:roleChecks.length,
 total:expectedChecks.length
});
export function validatePhase43Candidate(candidate,commit){
 if(!SHA.test(commit))throw Error("Invalid immutable release SHA.");
 if(!candidate||typeof candidate!=="object"||
  candidate.commit!==commit||
  candidate.designation!=="CI RELEASE CANDIDATE SIMULATION — NOT PHYSICAL OR FINANCIAL GO"||
  candidate.physicalPilotCertified!==false||
  candidate.financiallyCertified!==false||
  candidate.humanGoAuthorized!==false)
  throw Error("P43 evidence must be for this SHA and cannot claim physical or human approval.");
 if(!Number.isFinite(Date.parse(candidate.checkedAt??""))||
  typeof candidate.checkedAt!=="string"||
  !Array.isArray(candidate.checks)||
  candidate.total!==expectedChecks.length||
  candidate.passed!==expectedChecks.length||
  !Array.isArray(candidate.failed)||candidate.failed.length!==0||
  candidate.checks.length!==expectedChecks.length)
  throw Error("P43 evidence is missing, incomplete or contains failures.");
 for(let i=0;i<expectedChecks.length;i++){
  const expected=expectedChecks[i],actual=candidate.checks[i];
  if(!actual||actual.id!==expected.id||actual.expected!==expected.expected||
   actual.status!==expected.expected||actual.ok!==true)
   throw Error("P43 probe did not match the pinned passing route matrix.");
 }
 return true;
}
export function buildPhase44Packet(candidate,{commit,runId,runAttempt,createdAt}){
 validatePhase43Candidate(candidate,commit);
 if(!/^[1-9]\d{0,17}$/.test(String(runId??""))||
  !/^[1-9]\d{0,7}$/.test(String(runAttempt??""))||
  typeof createdAt!=="string"||!Number.isFinite(Date.parse(createdAt)))
  throw Error("CI run provenance or creation date is missing.");
 return {
  schema:"dineflow.phase44.release-candidate.v1",
  status:"HOLD",automatedDecision:"CI_CHECKS_PASSED_ONLY",
  automaticDeploymentAuthorized:false,
  humanGoAuthorized:false,
  realRestaurantPilotCertified:false,
  physicalCashVerified:false,
  bankTransferVerified:false,
  physicalKitchenReceiptVerified:false,
  restoreVerifiedOnExternalStaging:false,
  provenance:{
   gitCommit:commit,githubRunId:String(runId),githubRunAttempt:Number(runAttempt),
   generatedAt:createdAt,
   phase43CheckedAt:candidate.checkedAt,
   source:"disposable_github_actions_ci"
  },
  automatedEvidence:{
   status:"passed",
   probes:{...expectedProbeCounts},
   // This list records only allowlisted, expected probe IDs and statuses.
   // No URLs, credentials, cookie values or response body can be copied.
   results:expectedChecks.map(x=>({id:x.id,httpStatus:x.expected}))
  },
  manualGates:requiredHumanGates.map(g=>({
   id:g.id,ownerRole:g.owner,requiredAction:g.task,
   status:"not_verified",evidenceRef:null,reviewer:null,observedAt:null
  })),
  decision:{
   current:"HOLD",
   reason:"Only disposable CI evidence exists; all real hardware, finance, restore, pilot and independent human GO/HOLD gates are pending.",
   mustBeRecordedSeparately:true,
   recommendedNextStep:"Complete manual gates with real evidence in the secure operator log and obtain independent signoff."
  }
 };
}
function json(packet){return JSON.stringify(packet,null,2)+"\n";}
export function markdownPacket(packet){
 const p=packet.provenance;
 const details=packet.manualGates.map(g=>
  "- [ ] **"+g.id+"** — "+g.requiredAction+" (owner: "+g.ownerRole+"; evidence: not verified).").join("\n");
 return [
  "# DineFlow Phase 44 — Release Candidate Operator Packet",
  "",
  "> **HOLD — NOT APPROVED FOR PRODUCTION.** This file reports disposable CI results only.",
  "",
  "Git commit: `"+p.gitCommit+"`  ",
  "GitHub Actions run: `"+p.githubRunId+"` (attempt "+p.githubRunAttempt+")  ",
  "CI checked at: `"+p.phase43CheckedAt+"`  ",
  "Packet generated: `"+p.generatedAt+"`",
  "",
  "## Automated evidence (not physical certification)",
  "",
  "Phase 43 checked **"+packet.automatedEvidence.probes.total+
   "** HTTP route/permission probes with passing statuses ("+
   packet.automatedEvidence.probes.web+" web, "+
   packet.automatedEvidence.probes.anonymous+" anonymous API, "+
   packet.automatedEvidence.probes.role+" role-specific API).",
  "",
  "## Mandatory manual gates — all unverified",
  "",
  details,
  "",
  "## Two-person independent GO/HOLD",
  "",
  "The owner and independently authorized platform operator must review current",
  "pilot fingerprint/signatures, actual P0/P1 incidents, real bank/cash, restore,",
  "device and printer proof. Record the signed final decision in a secure operator",
  "system **separate from this CI packet**. Do not enter sensitive customer data,",
  "PINs, bank details, credentials or actual approval signatures in CI artifacts.",
  "",
  "**Current release status: HOLD.** No production migration, backup restore,",
  "refund, financial mutation, pilot signing or deployment was performed.",
  ""
 ].join("\n");
}
export function release44Cli(env=process.env,output=console){
 const safe=(env.CI==="true"&&env.GITHUB_ACTIONS==="true"&&
  env.NODE_ENV!=="production"&&
  typeof env.RUNNER_TEMP==="string"&&env.RUNNER_TEMP.length>0&&
  typeof env.DATABASE_URL==="string"&&
  /@(?:localhost|127\.0\.0\.1):5432\/dineflow_ci(?:\?|$)/.test(env.DATABASE_URL));
 if(!safe){
  output.error("HOLD: release packet generation is restricted to disposable GitHub Actions.");
  return 2;
 }
 try{
  const commit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
  if(commit!==env.GITHUB_SHA)throw Error("Checked-out SHA does not match GitHub provenance.");
  const source=join(env.RUNNER_TEMP,"dineflow-phase43-rc.json");
  const evidence=JSON.parse(readFileSync(source,"utf8"));
  const packet=buildPhase44Packet(evidence,{
   commit,runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,
   createdAt:new Date().toISOString()
  });
  const jsonFile=join(env.RUNNER_TEMP,"dineflow-phase44-packet.json");
  const mdFile=join(env.RUNNER_TEMP,"dineflow-phase44-operator-checklist.md");
  writeFileSync(jsonFile,json(packet),{mode:0o600,flag:"w"});
  writeFileSync(mdFile,markdownPacket(packet),{mode:0o600,flag:"w"});
  output.log("P44 release packet recorded for SHA "+commit+
   ": "+expectedProbeCounts.total+" CI probes; "+packet.manualGates.length+
   " manual gates unverified; **HOLD**, no automatic GO.");
  return 0;
 }catch{
  output.error("HOLD: missing, mismatched, failed or unsafe release candidate evidence.");
  return 1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 process.exitCode=release44Cli();
