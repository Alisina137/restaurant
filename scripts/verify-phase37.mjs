import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const waiter=read("apps/api/src/order-routes.ts");
const guest=read("apps/api/src/guest-orders.ts");
const p29=read("apps/api/src/phase29-ci.ts");
const schema=read("apps/api/src/schema.ts");
const p35=read("apps/api/src/phase35-operations.ts");
const p36=read("apps/api/src/phase36-performance.ts");
assert.match(waiter,/await tx\.insert\(orderLine\)\.values\(lines\.map\(\(line,i\)=>\(\{/,
 "Waiter cart must insert all priced lines in a single SQL statement");
assert.match(guest,/await tx\.insert\(orderLine\)\.values\(priced\.lines\.map\(\(line,i\)=>\(\{/,
 "Approved guest cart must insert all priced lines in one SQL statement");
const cards=waiter.split('orderRouter.get("/kitchen/cards"')[1].split('orderRouter.post("/kitchen/display-observed"')[0];
assert.match(cards,/const scope=await orderScope\(req\);kitchenScope\(scope\);/);
assert.match(cards,/await list\(req,"kitchen",scope\)/,
 "Kitchen cards should reuse the authorized tenant/location scope");
assert.ok(!cards.includes("const [lines,tickets]=await Promise.all"),
 "Do not independently re-fetch ticket rows already joined into page query");
assert.ok(!cards.includes(".from(kitchenTicket)"),
 "Second ticket SELECT must be gone");
assert.match(cards,/pickupAcknowledgedAt:row\.pickupAcknowledgedAt/,
 "Version/acknowledgement should come from the page snapshot");
assert.match(cards,/inArray\(orderLine\.roundId,roundIds\)/,
 "Batch item snapshot query still bounded by selected round IDs");
const list=waiter.split("async function list(")[1].split('orderRouter.get("/my"')[0];
assert.match(list,/resolvedScope\?:OrderScope/);
assert.match(list,/mode==="mine"\?\s*baseRows\.innerJoin\(diningVisit/,
 "Only waiter-specific /my should join visits to enforce assignment");
assert.match(list,/mode==="mine"\?\s*baseCount\.innerJoin\(diningVisit/,
 "Waiter count must preserve assignment filtering too");
assert.match(list,/mode==="mine"\?eq\(diningVisit\.waiterId,scope\.actorId\):undefined/,
 "Never drop waiter assignment enforcement");
assert.match(list,/eq\(orderRound\.tenantId,scope\.tenantId\)/);
assert.match(list,/eq\(orderRound\.locationId,scope\.locationId\)/);
assert.ok(!list.includes("leftJoin(diningVisit"),"Scope may not broaden to unmatched visits");
assert.match(p29,/length,5/,"Real multi-line integration regression required");
assert.match(p29,/assert\.equal\(replay\.created,false\)/,
 "Idempotent retry must not create a duplicate ticket");
assert.match(p29,/pickupAcknowledgedAt/,
 "P29 should check pickup acknowledgement on optimized cards");
assert.match(schema,/order_round_actor_idem_idx/,
 "Preserve unique checkout keys");
assert.match(p35,/pilotCertified:false/,"Pilot decisions remain separate from diagnostics");
assert.match(p36,/actualSlaCertified:false/,"Do not fabricate performance certification");
console.info("PASS P37: bulk transactional inserts, scope-safe paged kitchen reads, preserved waiter RBAC and receipt snapshots.");
