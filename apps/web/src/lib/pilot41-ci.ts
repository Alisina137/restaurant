import assert from "node:assert/strict";
import {pilot41NextActions,type PilotActionState} from "./pilot41";

const keys=["roles","qr","orders","cash","billing","languages","devices",
 "accessibility","reliability","backups","rollback","shift"];
const passed=keys.map(key=>({key,title:key,review:{result:"passed" as const}}));
const base: PilotActionState={
 gates:passed,incidents:{total:0,open:0,blocking:0},fingerprint:"current",
 complete:true,ownerSignoff:null,platformDecision:null,status:"awaiting_owner"
};
function kinds(state:PilotActionState){return pilot41NextActions(state).map(x=>x.kind);}
assert.deepEqual(kinds(base),["owner_signoff"]);
const owner={...base,ownerSignoff:{fingerprint:"current"},
 status:"awaiting_platform" as const};
assert.deepEqual(kinds(owner),["platform_review"]);
assert.deepEqual(kinds({...owner,status:"held"}),["platform_hold"]);
assert.deepEqual(kinds({...owner,status:"signed_off"}),["external_verification"]);
assert.deepEqual(kinds({...owner,status:"signed_off",fingerprint:"next"}),
 ["owner_signoff"],"Changed evidence invalidates earlier owner and platform signatures");
assert.deepEqual(kinds({...owner,incidents:{total:1,open:1,blocking:1}}),
 ["critical_incidents"],"Open P0/P1 blocks signature recommendations");
assert.deepEqual(kinds({...owner,incidents:{total:2,open:2,blocking:1}}),
 ["critical_incidents","p2_followup"]);
assert.deepEqual(kinds({...owner,incidents:{total:1,open:1,blocking:0}}),
 ["p2_followup","platform_review"],"Open P2 is visible but not auto-blocking");
const gaps={
 ...base,complete:false,
 gates:passed.map((g,i)=>({...g,review:i===0?{result:"failed" as const}:
   i===1?null:g.review})),
 incidents:{total:1,open:1,blocking:1}
};
assert.deepEqual(pilot41NextActions(gaps).map(x=>[x.kind,x.key??""]),[
 ["critical_incidents",""],["failed_gate","roles"],["untested_gate","qr"]
]);
assert.deepEqual(kinds({...base,gates:[]}),[],
 "No empty dataset may produce a signoff recommendation");
assert.deepEqual(kinds({...base,gates:passed.slice(1)}),[],
 "Even eleven passing reviews cannot enable signoff");
console.info("PASS P41: triage prioritizes P0/P1 and failed/missing physical tests, prevents stale signoff, preserves P2 visibility and external GO boundary.");
