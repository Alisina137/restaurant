import assert from "node:assert/strict";
import {pilotReadinessPlan,type PilotReviewSnapshot} from "./pilot41-readiness";
const keys=["roles","qr","orders","cash","billing","languages","devices","accessibility",
 "reliability","backups","rollback","shift"];
function fixture():PilotReviewSnapshot{
 return {gates:keys.map((key,i)=>({key,title:key,help:"",
  review:{id:i+1,result:"passed" as const,createdAt:"2026-11-20T00:00:00Z"}})),
  fingerprint:"fingerprint-1",incidents:{open:0,blocking:0},
  ownerSignoff:null,platformDecision:null,status:"awaiting_owner"};
}
function main(){
 const now="2026-11-20T01:00:00Z";
 const initial=pilotReadinessPlan(fixture(),now);
 assert.equal(initial.gatePassed,12);
 assert.equal(initial.pendingGates,0);
 assert.equal(initial.failedGates,0);
 assert.equal(initial.ownerCurrent,false);
 assert.equal(initial.platformCurrent,false);
 assert.deepEqual(initial.steps.map(s=>s.kind),["owner_signature","externally_unverified"]);
 assert.equal(initial.externallyCertified,false);
 assert.equal(initial.checkedAt,now);
 const unresolved=fixture();
 unresolved.gates[0]!.review=null;
 unresolved.gates[3]!.review={id:20,result:"failed",createdAt:now};
 unresolved.incidents.blocking=2;
 unresolved.incidents.open=2;
 unresolved.status="blocked";
 const blocked=pilotReadinessPlan(unresolved,now);
 assert.deepEqual(blocked.steps.slice(0,3),[
  {kind:"incident",count:2},
  {kind:"gate",key:"roles",gateState:"missing"},
  {kind:"gate",key:"cash",gateState:"failed"}
 ]);
 assert.equal(blocked.gatePassed,10);
 assert.equal(blocked.pendingGates,1);
 assert.equal(blocked.failedGates,1);
 assert.equal(blocked.ownerCurrent,false);
 assert.equal(blocked.platformCurrent,false);
 const signed=fixture();
 signed.ownerSignoff={id:5,fingerprint:signed.fingerprint};
 signed.status="awaiting_platform";
 const needsReview=pilotReadinessPlan(signed);
 assert.equal(needsReview.ownerCurrent,true);
 assert.deepEqual(needsReview.steps.map(s=>s.kind),["platform_review","externally_unverified"]);
 signed.status="held";
 signed.platformDecision={decision:"hold",fingerprint:signed.fingerprint,ownerSignoffId:5};
 assert.equal(pilotReadinessPlan(signed).steps[0]?.kind,"platform_hold");
 signed.status="signed_off";
 signed.platformDecision={decision:"approved",fingerprint:signed.fingerprint,ownerSignoffId:5};
 const approved=pilotReadinessPlan(signed);
 assert.equal(approved.ownerCurrent,true);
 assert.equal(approved.platformCurrent,true);
 assert.equal(approved.status,"signed_off");
 assert.deepEqual(approved.steps,[{kind:"externally_unverified"}],
  "Even signed-off evidence never automatically certifies a real launch");
 assert.equal(approved.externallyCertified,false);
 const stale=fixture();
 stale.ownerSignoff={id:5,fingerprint:"stale"};
 assert.deepEqual(pilotReadinessPlan(stale).steps[0],
  {kind:"owner_signature",stale:true});
 stale.ownerSignoff.fingerprint=stale.fingerprint;
 stale.platformDecision={decision:"approved",fingerprint:stale.fingerprint,ownerSignoffId:4};
 assert.equal(pilotReadinessPlan(stale).platformCurrent,false,
  "A platform signature on an outdated owner signoff is not current");
 stale.platformDecision.ownerSignoffId=5;
 stale.incidents.blocking=1;
 assert.equal(pilotReadinessPlan(stale).ownerCurrent,false,
  "Any new P0/P1 blocker invalidates both owner and platform signoff");
 console.info("PASS P41: deterministic missing/failed gates, incident prioritization, signature freshness, hold, and no automatic external GO.");
}
main();
