import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const routes=read("apps/api/src/order-routes.ts");
const ui=read("apps/mobile/app/visit/[id]/new-order.tsx");
const helper=read("apps/mobile/src/mobile40-recovery.ts");
const translation=read("apps/mobile/src/mobile25-copy.ts");
const integration=read("apps/api/src/phase39-ci.ts");
const pkg=JSON.parse(read("package.json"));

const receiptStart=routes.indexOf('orderRouter.get("/visits/:id/submissions/:key"');
const receiptEnd=routes.indexOf('orderRouter.post("/visits/:id/rounds"',receiptStart);
assert.ok(receiptStart>0&&receiptEnd>receiptStart,"Read-only endpoint mounted before checkout");
const lookup=routes.slice(receiptStart,receiptEnd);
for(const rule of [
 "await orderScope(req,false)","writeScope(scope)",
 "eq(orderRound.tenantId,scope.tenantId)",
 "eq(orderRound.locationId,scope.locationId)",
 "eq(orderRound.visitId,visitId)",
 "eq(orderRound.submittedBy,scope.actorId)",
 "eq(orderRound.idempotencyKey,key)",
 'res.setHeader("Cache-Control","no-store")',
 'fail(404,"NOT_FOUND"','res.json({status:"accepted",roundId:submitted.roundId})'
])assert.ok(lookup.includes(rule),"Own-submission lookup missing rule: "+rule);
assert.ok(!lookup.includes("tx.insert(")&&!lookup.includes("db.insert("),
 "Lookup must never create an order or write ticket data");
assert.ok(!lookup.includes("readOrder(scope"),"Receipt must work after a table handoff");
assert.ok(!lookup.includes("requestHash"),"No private cart hash returned");
assert.ok(helper.includes("const receipt=await lookup()"),"Check read-only receipt first");
assert.ok(helper.includes("if(!verifiedNotFound(error))throw error"),
 "Only explicit NOT_FOUND can trigger same-key retry");
assert.ok(helper.includes('source:"receipt"')&&helper.includes('source:"original_key_replay"'));
assert.ok(ui.includes("await reconcilePendingOrder("));
assert.ok(ui.includes('originalPath+"/submissions/"+encodeURIComponent(snapshot.idempotencyKey)'));
assert.ok(ui.includes("error instanceof FloorRequestError&&error.status===404&&error.code==="));
assert.ok(ui.includes("postOriginal"),"Only the original payload/key can POST");
assert.ok(ui.includes("if(prepared&&postAttempted&&definite)"),
 "Read-only lookup 403 cannot clear encrypted original key");
assert.ok(ui.includes("await markSubmissionPending(userId,tenantId,id,snapshot.idempotencyKey)"),
 "Store pending marker before first POST");
for(const phrase of [
 'checkingOrder:"Checking original order before any retry',
 'checkingOrder:"در حال بررسی سفارش پیشین',
 'checkingOrder:"تر بیا لېږلو مخکې'
])assert.ok(translation.includes(phrase),"Missing localized device state: "+phrase);
assert.ok(integration.includes("const receiptPath=")&&
 integration.includes("assert.deepEqual(receipt,"),
 "Require real seeded HTTP receipt tests");
assert.ok(pkg.scripts["phase40:verify"].includes("mobile40-ci.ts"),
 "CI must execute pure device reconciliation tests");
console.info("PASS Phase 40: private read-only order receipt, status-before-POST, no duplicate and unchanged encrypted pending marker.");
