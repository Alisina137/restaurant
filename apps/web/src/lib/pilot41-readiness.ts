/** Phase 41: pure, read-only pilot triage derived from the *current* signed snapshot.
 * Never treats CI, telemetry or the gate checkboxes as external certification.
 */
export type PilotReviewGate={
 key:string;title:string;help:string;
 review:{id:number;result:"passed"|"failed";createdAt:string}|null
};
export type PilotReviewSnapshot={
 gates:PilotReviewGate[];fingerprint:string;
 incidents:{open:number;blocking:number};
 ownerSignoff:{id:number;fingerprint:string}|null;
 platformDecision:{decision:string;fingerprint:string;ownerSignoffId:number|null}|null;
 status:"blocked"|"awaiting_owner"|"awaiting_platform"|"held"|"signed_off";
};
export type PilotAction=
 {kind:"incident";count:number}|
 {kind:"gate";key:string;gateState:"missing"|"failed"}|
 {kind:"owner_signature";stale:boolean}|
 {kind:"platform_hold"}|
 {kind:"platform_review"}|
 {kind:"externally_unverified"};
export type PilotReadinessPlan={
 checkedAt:string;gatePassed:number;gateTotal:number;
 pendingGates:number;failedGates:number;blockingIncidents:number;
 ownerCurrent:boolean;platformCurrent:boolean;
 status:PilotReviewSnapshot["status"];
 steps:PilotAction[];externallyCertified:false;
};
export function pilotReadinessPlan(
 input:PilotReviewSnapshot,checkedAt=new Date().toISOString()
):PilotReadinessPlan{
 const steps:PilotAction[]=[];
 if(input.incidents.blocking>0)steps.push({kind:"incident",count:input.incidents.blocking});
 let gatePassed=0,pendingGates=0,failedGates=0;
 for(const gate of input.gates){
  if(gate.review?.result==="passed"){gatePassed++;continue;}
  if(gate.review?.result==="failed"){failedGates++;steps.push({kind:"gate",key:gate.key,gateState:"failed"});}
  else {pendingGates++;steps.push({kind:"gate",key:gate.key,gateState:"missing"});}
 }
 const complete=gatePassed===input.gates.length;
 const ownerCurrent=!!input.ownerSignoff&&input.ownerSignoff.fingerprint===input.fingerprint&&
  complete&&input.incidents.blocking===0;
 const platformCurrent=!!(ownerCurrent&&input.platformDecision?.decision==="approved"&&
  input.platformDecision.fingerprint===input.fingerprint&&
  input.platformDecision.ownerSignoffId===input.ownerSignoff?.id);
 if(complete&&input.incidents.blocking===0&&!ownerCurrent)
  steps.push({kind:"owner_signature",stale:!!input.ownerSignoff});
 else if(ownerCurrent&&!platformCurrent)
  steps.push(input.status==="held"?{kind:"platform_hold"}:{kind:"platform_review"});
 // The GO decision always requires separate physical device/money/shift
 // evidence and independent operator authorization, including after signoff.
 steps.push({kind:"externally_unverified"});
 return {checkedAt,gatePassed,gateTotal:input.gates.length,
  pendingGates,failedGates,blockingIncidents:input.incidents.blocking,
  ownerCurrent,platformCurrent,status:input.status,steps,externallyCertified:false};
}
