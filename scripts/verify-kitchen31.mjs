import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../",import.meta.url);
const paths=[
 "apps/api/src/order-routes.ts","apps/api/src/phase31-ci.ts","apps/api/src/phase31-load.ts",
 "apps/web/src/lib/kitchen31.ts","apps/web/src/lib/kitchen31-ci.ts",
 "apps/web/src/lib/kitchen31-copy.ts","apps/web/src/components/kitchen-visibility-triage.tsx",
 "apps/web/src/components/kitchen-operations.tsx","apps/web/src/app/kitchen31.css",
 "apps/web/src/app/layout.tsx",".github/workflows/verify.yml","package.json",
 "docs/PHASE-31-ACCEPTANCE.md"
];
const get=i=>readFileSync(new URL(paths[i],root),"utf8");
for(const path of paths)assert.ok(existsSync(new URL(path,root)),"P31 missing "+path);
function has(i,markers){const s=get(i);for(const m of markers)
 assert.ok(s.includes(m),"P31 "+paths[i]+" must include "+m);}
has(0,['"/kitchen/unobserved"','kitchenScope(scope)','isNull(kitchenTicket.firstDisplayedAt)',
 'minAgeSeconds','ilike(kitchenTicket.tableLabel','asc(kitchenTicket.createdAt)',
 'limit(10)','Cache-Control','missing_foreground_render_report']);
has(1,["P31","new-owner-ci@example.test","page=1001","age","display-observed"]);
has(2,["ALLOW_DISPOSABLE_LOAD_REHEARSAL","dineflow_ci",
 'Array.from({length:10}','table<20','200',"load rehearsal","physicalDevices:0",
 "finally","maxTables"]);
has(3,["validGapPage","missing_foreground_render_report","AGE_FILTERS"]);
has(5,["const en=","const fa:","const ps:"]);
has(6,['"/api/orders/kitchen/unobserved?page="',"visibilitychange",
 "setInterval(()=>void refresh(),30000)","validGapPage",
 "onInspect(row.roundId)","k31-row","role=\"search\""]);
has(7,["KitchenVisibilityTriage","onInspect={setSelected}"]);
has(8,[".k31-row",".k31-triage",".k31-table-search","@media(max-width:510px)"]);
has(9,['import "./kitchen31.css";']);
has(10,["kitchen31:verify","phase31-ci.ts","pilot31:rehearse","ALLOW_DISPOSABLE_LOAD_REHEARSAL"]);
has(11,["kitchen31:verify","pilot31:rehearse"]);
console.info("PASS P31 source contracts: bounded tenant-scoped read-only triage, RTL table search and guarded 20/10/200 load harness.");
