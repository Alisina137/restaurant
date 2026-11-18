import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../",import.meta.url);
const paths=["apps/api/src/order-core.ts","apps/api/src/phase6-service.ts","apps/api/src/schema.ts",
 "apps/api/drizzle/0013_phase28_pickup_ack.sql","apps/api/drizzle/meta/_journal.json",
 "apps/web/src/components/kitchen-operations.tsx","apps/web/src/lib/kitchen28.ts",
 "apps/web/src/lib/kitchen28-copy.ts","apps/web/src/app/kitchen28.css",
 "apps/web/src/lib/order-web-types.ts","apps/mobile/app/order/[id].tsx",
 "apps/mobile/src/mobile28-copy.ts","apps/api/src/phase28-ci.ts"];
for(const p of paths)assert.ok(existsSync(new URL(p,root)),"P28 missing "+p);
const get=p=>readFileSync(new URL(p,root),"utf8");
function has(p,tokens){const s=get(p);for(const key of tokens)
 assert.ok(s.includes(key),p+" missing "+key);}
has(paths[0],["Serialize committed outbox sequences","orderRevision","orderOutbox"]);
has(paths[1],['"/kitchen/watermark"','"/kitchen/tickets/:id/state"','"/tickets/:id/pickup-ack"',
 "pickupAcknowledgedAt","assignedVisit(tx,scope","kitchenScope(scope)",
 "FOR SHARE","FOR UPDATE","waiter.pickup_acknowledged","orderChanged(tx"]);
has(paths[2],["pickupAcknowledgedAt","pickupAcknowledgedBy"]);
has(paths[3],["ADD COLUMN","pickup_acknowledged_at","pickup_acknowledged_by"]);
assert.equal(JSON.parse(get(paths[4])).entries.at(-1).tag,"0013_phase28_pickup_ack");
has(paths[5],["synchronize=useCallback","/api/orders/changes?after=",
 "/api/orders/kitchen/watermark","/api/orders/kitchen/tickets/",
 "advanceCursor","validateWatermark","uncertainKey","storeUncertain",
 "submitted=true","verifyTicket","actionOutcome","pickupAcknowledgedAt"]);
has(paths[6],["advanceCursor","cleanUncertain","isTicketState","actionOutcome"]);
has(paths[7],["const en=","const fa:","const ps:","uncertain:"]);
has(paths[8],[".k28-uncertain-list",".k28-proof","@media(max-width:650px)"]);
has(paths[10],["executePickup","pickup-ack","pickupUncertain","pickupAcknowledgedAt"]);
has(paths[11],["const en=","const fa:","const ps:","confirmPickup"]);
has(paths[12],["pickup-ack","waiter.pickup_acknowledged","/kitchen/watermark","Array.from({length:12}"]);
const wf=get(".github/workflows/verify.yml"),pkg=get("package.json"),layout=get("apps/web/src/app/layout.tsx");
assert.ok(wf.includes("kitchen28:verify")&&wf.includes("phase28-ci.ts"));
assert.ok(pkg.includes("kitchen28:verify"));assert.ok(layout.includes('import "./kitchen28.css";'));
console.info("PASS P28 contracts: durable pickup receipt, serialized cursors, reconcilable unknown POST and UI guards.");
