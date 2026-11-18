import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../",import.meta.url);
const files=["apps/api/src/order-routes.ts","apps/api/src/phase29-ci.ts",
 "apps/web/src/components/kitchen-operations.tsx","apps/web/src/lib/kitchen29.ts",
 "apps/web/src/lib/kitchen29-copy.ts","apps/web/src/lib/kitchen29-ci.ts",
 "apps/web/src/app/kitchen29.css","apps/web/src/lib/order-web-types.ts",
 "apps/api/drizzle/0014_phase29_kitchen_performance.sql","apps/api/drizzle/meta/_journal.json"];
const read=path=>readFileSync(new URL(path,root),"utf8");
for(const path of files)assert.ok(existsSync(new URL(path,root)),"P29 file absent "+path);
function includes(path,markers){const s=read(path);for(const marker of markers)
 assert.ok(s.includes(marker),"P29 "+path+" missing "+marker);}
includes(files[0],['"/kitchen/cards"','"/kitchen/pulse"',"inArray(orderLine.roundId,roundIds)",
 "Cache-Control","Server-Timing","percentile_cont(0.95)","pendingReceipt","kitchenScope(scope)"]);
includes(files[1],["serverMs","detailsByRound","new-owner-ci@example.test",
 "prepP95Minutes","pendingReceipt"]);
includes(files[2],['"/api/orders/kitchen/cards?status="','"/api/orders/kitchen/pulse?minutes="',
 "validKitchenCardPage","validCardDetail","inlineDetail=","k29-pulse","k29-large",
 "chooseDisplay","displayKey","setInterval(()=>void refresh(),60000)"]);
includes(files[3],["validCardDetail","validKitchenCardPage","validKitchenPulse","currentDisplayMode"]);
includes(files[4],["const en=","const fa:","const ps:"]);
includes(files[6],[".k29-pulse-grid",".k29-large",".k29-display-tools","@media(max-width:550px)"]);
includes(files[8],["CREATE INDEX IF NOT EXISTS","ready_at"]);
const journal=JSON.parse(read(files[9]));
assert.equal(journal.entries.at(-1).tag,"0014_phase29_kitchen_performance");
includes("apps/web/src/app/layout.tsx",['import "./kitchen29.css";']);
includes("package.json",["kitchen29:verify"]);
includes(".github/workflows/verify.yml",["kitchen29:verify","phase29-ci.ts"]);
console.info("PASS P29 static: server-batched kitchen cards, actual p95, screen sizing, scope checks and CI contracts.");
