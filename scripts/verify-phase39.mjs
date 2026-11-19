import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const handler=read("apps/api/src/menu-helpers.ts");
const safety=read("apps/api/src/phase39-order-recovery.ts");
const waiter=read("apps/api/src/order-routes.ts");
const guest=read("apps/api/src/guest-orders.ts");
const ui=read("apps/mobile/app/visit/[id]/new-order.tsx");
const copy=read("apps/mobile/src/mobile25-copy.ts");
const ci=read("apps/api/src/phase39-ci.ts");
const pkg=JSON.parse(read("package.json"));
assert.match(safety,/CHECKOUT_LOCK_TIMEOUT_MS=8000/);
assert.match(safety,/ORDER_RETRY_AFTER_SECONDS=3/);
assert.match(safety,/req\.baseUrl==="\/api\/orders"/);
assert.match(safety,/req\.baseUrl==="\/api\/guest"&&req\.path==="\/orders"/);
assert.match(safety,/isTransientOrderDatabaseFailure/);
assert.match(safety,/code:"ORDER_STATUS_UNCERTAIN"/);
assert.match(safety,/retrySameKey:true/);
assert.match(safety,/statusUncertain:true/);
assert.ok(!safety.includes("console.error("),"No raw driver data in result classifier");
assert.ok(handler.includes("isIdempotentOrderSubmission(req)&&isTransientOrderDatabaseFailure(error)"));
assert.ok(handler.includes('res.setHeader("Retry-After",String(ORDER_RETRY_AFTER_SECONDS))'));
assert.ok(handler.includes('res.setHeader("Cache-Control","no-store")'));
assert.ok(handler.includes("res.status(503).json(uncertainOrderResponse)"));
assert.ok(!handler.includes('console.error("Menu response failed after headers", error)'),
 "Do not log raw PG driver messages or credentials after headers");
for(const [name,c] of [["waiter",waiter],["guest",guest]]){
 assert.ok(c.includes("SELECT set_config('lock_timeout',"),name+" must set a transaction-local lock timeout");
 assert.ok(c.includes('String(CHECKOUT_LOCK_TIMEOUT_MS)+"ms"'),name+" uses centralized timeout");
 assert.ok(c.includes("const created=await db.transaction(async tx=>{"),
  name+" must preserve atomic transaction");
 assert.ok(c.includes("priceLines(tx,scope,"),name+" preserves authoritative pricing");
 assert.ok(c.includes("orderChanged(tx,scope,"),name+" preserves durable order events");
}
assert.ok(ui.includes('code==="ORDER_STATUS_UNCERTAIN"'),"Explicit uncertain mobile state");
assert.ok(ui.includes('markSubmissionPending(userId,tenantId,id,snapshot.idempotencyKey)'),
 "Persist key before uncertain network POST");
assert.ok(ui.includes("uncertainRef.current=true"),"Never discard uncertain cart");
assert.ok(ui.includes("uncertainRef.current?"),"Lock cart until original key recovered");
assert.ok(copy.includes("Do not start a new order"),"English advice");
assert.ok(copy.includes("سفارش تازه نسازید"),"Dari advice");
assert.ok(copy.includes("نوی فرمایش مه جوړوئ"),"Pashto advice");
assert.ok(ci.includes('process.env.CI!=="true"')&&ci.includes('pgUrl.pathname!=="/dineflow_ci"'),
 "Simulate lock only on disposable localhost CI");
assert.ok(ci.includes("FOR UPDATE")&&ci.includes("ROLLBACK"),"Real lock contention");
assert.ok(ci.includes('body.code,"ORDER_STATUS_UNCERTAIN"'),"Actionable 503");
assert.ok(ci.includes('locked.headers.get("retry-after"),"3"'),"Retry-After contract");
assert.ok(ci.includes('replay.created,false'),"Original key exactly-once");
assert.ok(ci.includes("Only one kitchen ticket"),"No duplicate ticket");
assert.ok(pkg.scripts["menu:stability:verify"].includes("src/phase39-ci.ts"),
 "Run P39 after earlier phase fixtures");
console.info("PASS P39: bounded checkout lock, safe 503, private mobile key recovery, disposable DB regression.");
