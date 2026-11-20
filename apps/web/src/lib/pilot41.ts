/**
 * Phase 41: derive a supervised pilot follow-up plan from existing, recorded
 * evidence. This is NOT a new pilot signature, external test, auto-attestation
 * or deployment authorization. Every action is read-only until a human
 * explicitly performs the existing owner / platform workflow.
 */
export type PilotActionState={
 gates:Array<{key:string;title:string;review:{result:"passed"|"failed"}|null}>;
 incidents:{total:number;open:number;blocking:number};
 fingerprint:string;
 complete:boolean;
 ownerSignoff:{fingerprint:string}|null;
 platformDecision:{fingerprint:string;decision:string}|null;
 status:"blocked"|"awaiting_owner"|"awaiting_platform"|"held"|"signed_off";
};
export type PilotNextAction={
 kind:"critical_incidents"|"failed_gate"|"untested_gate"|"owner_signoff"|
  "platform_review"|"platform_hold"|"p2_followup"|"external_verification";
 key?:string;
 count?:number;
};
export function pilot41NextActions(state:PilotActionState):PilotNextAction[]{
 const actions:PilotNextAction[]=[];
 const blocking=Math.max(0,state.incidents.blocking);
 if(blocking>0)actions.push({kind:"critical_incidents",count:blocking});
 for(const gate of state.gates)
  if(gate.review?.result==="failed")actions.push({kind:"failed_gate",key:gate.key});
 for(const gate of state.gates)
  if(!gate.review)actions.push({kind:"untested_gate",key:gate.key});
 const p2=Math.max(0,state.incidents.open-blocking);
 if(p2>0)actions.push({kind:"p2_followup",count:p2});
 // Never offer an approval step when any gate is missing/failed or a P0/P1
 // blocker is open. Owner signatures are only current for this fingerprint.
 const allPassed=state.gates.length===12&&
  state.gates.every(g=>g.review?.result==="passed");
 const ownerCurrent=state.ownerSignoff?.fingerprint===state.fingerprint;
 if(allPassed&&blocking===0){
  if(!ownerCurrent)actions.push({kind:"owner_signoff"});
  else if(state.status==="held")actions.push({kind:"platform_hold"});
  else if(state.status!=="signed_off")actions.push({kind:"platform_review"});
  else actions.push({kind:"external_verification"});
 }
 return actions;
}
