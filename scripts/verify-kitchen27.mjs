import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const files=["apps/web/src/components/kitchen-operations.tsx",
 "apps/web/src/lib/kitchen27.ts","apps/web/src/lib/kitchen27-copy.ts",
 "apps/web/src/app/kitchen27.css","apps/web/src/app/layout.tsx",
 "apps/api/src/order-routes.ts","apps/api/src/phase27-ci.ts",
 "apps/web/src/lib/kitchen27-ci.ts"];
for(const path of files)assert.ok(existsSync(new URL(path,root)),"Missing Phase 27 file "+path);
const [screen,pure,copy,css,layout,server,http,unit]=files.map(path=>readFileSync(new URL(path,root),"utf8"));
function check(source,markers,what){for(const marker of markers)
 assert.ok(source.includes(marker),"P27 "+what+": missing "+marker);}
check(screen,["KitchenOperations","TicketCard","DetailModal","useDialogFocus",
 "k27-summary-grid","k27-attention","k27-ticket-grid","preparedSummary",
 "k27-progress","k27-cook-note","k27-line-action","lineId",
 "/api/orders/kitchen/overview","&table=","tab","aria-current",
 "PageControls","InlineFeedback","LoadingSkeleton","useInteraction",
 "confirm({","actionLock","actionOutcome","onLine","handoff",
 "EventSource","visibilitychange","setInterval","newTicketIds",
 "soundKey","audio.state","aria-pressed","k27-warning","oldest"],
 "kitchen workflow");
check(pure,["elapsedMinutes","priority","newTicketIds","preparedSummary","validSummary"],"selectors");
check(copy,["const fa:","const ps:","const en=","board:","confirmReady:"],"localization");
check(css,[".k27-hero",".k27-summary-card",".k27-ticket-grid",
 ".k27-cook-note","@media(max-width:650px)","prefers-reduced-motion"],"responsive design");
check(layout,['import "./kitchen27.css";'],"style registration");
check(server,['"/kitchen/overview"',"kitchenScope(scope)","groupBy(kitchenTicket.status)",
 "table?ilike(kitchenTicket.tableLabel","limit(10)","Cache-Control"],"protected API");
check(http,["count()","page=1&table=","new-owner-ci@example.test",
 "encodeURIComponent(target)","no-store"],"integration test");
check(unit,["fa-AF","ps-AF","elapsedMinutes","priority","preparedSummary"],"selectors test");
const workflow=readFileSync(new URL(".github/workflows/verify.yml",root),"utf8");
assert.ok(workflow.includes("kitchen27:verify")&&workflow.includes("phase27-ci.ts"),"P27 absent from CI");
assert.ok(!screen.includes("guest approvals arrive in Phase 7"),"Do not render outdated development promises");
console.info("PASS P27 static: focused kitchen board, verified counters/search, large controls, sound consent and 3 locales.");
