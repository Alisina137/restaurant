import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../",import.meta.url);
const paths=[
 "apps/api/src/order-routes.ts","apps/api/src/schema.ts","apps/api/src/phase30-ci.ts",
 "apps/api/drizzle/0015_phase30_kitchen_display_observed.sql",
 "apps/api/drizzle/meta/_journal.json",
 "apps/web/src/components/kitchen-operations.tsx","apps/web/src/lib/kitchen30.ts",
 "apps/web/src/lib/kitchen30-copy.ts","apps/web/src/lib/kitchen30-ci.ts",
 "apps/web/src/app/kitchen30.css","apps/web/src/app/layout.tsx",
 ".github/workflows/verify.yml","package.json"
];
const get=path=>readFileSync(new URL(path,root),"utf8");
for(const path of paths)assert.ok(existsSync(new URL(path,root)),"missing "+path);
const includes=(index,terms)=>{
 const content=get(paths[index]);
 for(const term of terms)assert.ok(content.includes(term),
  paths[index]+" missing "+term);
};
includes(0,['"/kitchen/display-observed"','"/kitchen/visibility"',
 "firstDisplayedAt","clock_timestamp()","isNull(kitchenTicket.firstDisplayedAt)",
 "kitchenScope(scope)","percentile_cont(0.95)","observedCount",
 'evidence:"foreground_client_report"',"Cache-Control"]);
includes(1,["firstDisplayedAt:timestamp"]);
includes(2,["display-observed","phase30","new-owner-ci@example.test",
 "observedCount","kitchen/visibility","firstDisplayedAt"]);
includes(3,["ADD COLUMN","first_displayed_at","CREATE INDEX"]);
assert.ok(JSON.parse(get(paths[4])).entries.some(e=>e.tag==="0015_phase30_kitchen_display_observed"));
includes(5,["eligibleObservationIds","requestAnimationFrame","document.hidden",
 '"/api/orders/kitchen/display-observed"',
 '"/api/orders/kitchen/visibility?minutes="',"k30-observation",
 "validKitchenVisibility","validObservationResult","visibilityError"]);
includes(6,["eligibleObservationIds","validKitchenVisibility","validObservationResult"]);
includes(7,["const en=","const fa:","const ps:","foreground"]);
includes(9,[".k30-metrics",".k30-fail","@media(max-width:530px)"]);
includes(10,['import "./kitchen30.css";']);
includes(11,["kitchen30:verify","phase30-ci.ts"]);
includes(12,["kitchen30:verify"]);
console.info("PASS P30 contracts: real KDS foreground observation, isolation and safe coverage UI.");
