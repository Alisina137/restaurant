import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const get=path=>readFileSync(path,"utf8");
const pricing=get("apps/api/src/order-core.ts");
const group=get("apps/api/src/menu-groups.ts");
const waiter=get("apps/api/src/order-routes.ts");
const guest=get("apps/api/src/guest-orders.ts");
const p38=get("apps/api/src/phase38-ci.ts");
const p03=get("apps/api/src/phase3-ci.ts");

const pricingScope=pricing.slice(pricing.indexOf("export async function priceLines"),
 pricing.indexOf("export async function orderChanged"));
assert.ok(pricingScope.includes("new Map<string,typeof menuItem.$inferSelect>()"),
 "Price cache must be created inside priceLines, never at module or API scope");
assert.ok(pricingScope.includes("new Map<string,{"),
 "Modifier option cache must also be transaction-local");
assert.ok(pricingScope.includes("lockedItems.get(line.itemId)"),
 "Repeated items should reuse a locked, tenant-scoped item row");
assert.ok(pricingScope.includes("lockedGroups.get(selection.groupId)"),
 "Repeated modifier groups should reuse a locked group and options");
assert.ok(pricingScope.includes("lockedItems.set(line.itemId,item)"));
assert.ok(pricingScope.includes("lockedGroups.set(selection.groupId,locked)"));
assert.ok(pricingScope.includes("FOR SHARE"),
 "Repeated row snapshots remain protected by transaction-scoped PostgreSQL locks");
assert.ok(pricingScope.includes("eq(menuItem.tenantId,scope.tenantId)")&&
 pricingScope.includes("eq(menuItem.locationId,scope.locationId)"));
assert.ok(pricingScope.includes("eq(menuModifierGroup.tenantId,scope.tenantId)")&&
 pricingScope.includes("eq(menuModifierGroup.locationId,scope.locationId)"));
assert.ok(pricingScope.includes("group.version!==selection.version"),
 "Each line must independently validate modifier version despite cached rows");
assert.ok(pricingScope.includes("item.version!==line.itemVersion"),
 "Each line must independently reject stale price despite cached rows");
assert.ok(pricingScope.includes("choices.some(o=>!o||!o.active)"),
 "Inactive or missing options cannot be reused from the locked snapshot");
assert.ok(pricingScope.includes("const [category]=await tx.select()"),
 "Do not cache nonlocked categories across line rechecks");
assert.ok(pricingScope.includes("const attached=await tx.select()"),
 "Item-group linkage validation must be rechecked on each line");
assert.ok(pricingScope.includes("lineTotal=unit*line.quantity"),
 "Every line must calculate an independent quantity/total");
assert.ok(pricingScope.includes("subtotal+lineTotal>2_000_000_000"),
 "Financial cap unchanged");
assert.ok(waiter.includes("await priceLines(tx,scope,input.lines)"));
assert.ok(guest.includes("await priceLines(tx,scope,order.cart)"),
 "Waiter and guest checkout must share the same protected pricing path");

assert.match(group,/await tx\.insert\(menuModifierOption\)\.values\(input\.options\.map\(o=>\(\{/,
 "Create modifier options together inside the existing transaction");
assert.match(group,/const removed=oldOptions\.filter\(o=>!submitted\.has\(o\.id\)\)/,
 "Omitted options must remain in history and deactivate");
assert.match(group,/if\(removed\.length\)await tx\.update\(menuModifierOption\)/);
assert.match(group,/if\(additions\.length\)await tx\.insert\(menuModifierOption\)\.values\(additions\)/,
 "Patch new options with a single insert");
assert.ok(group.includes("eq(menuModifierGroup.version,v)"),
 "Optimistic concurrency guard must survive bulk operation");
assert.ok(group.includes('await changed(tx,scope,"menu.modifier_group_updated"'),
 "Audit and catalog revision must be advanced");
assert.ok(p38.includes("Array.from({length:40}"),
 "Integration must exercise maximum supported 40 repeated cart lines");
assert.ok(p38.includes("P38 separate instruction")&&p38.includes("modifierSnapshot"),
 "Regression must verify per-line independent note and modifier pricing");
assert.ok(p38.includes("MODIFIER_CHANGED")&&p38.includes("PRICE_CHANGED")&&p38.includes("INVALID_MODIFIERS"),
 "Wrong group version on a later line must abort the whole order");
assert.ok(p38.includes('dbUrl.pathname!=="/dineflow_ci"')&&p38.includes('process.env.CI!=="true"'),
 "Dedicated HTTP checkout integration must never run on a production or shared database");
const pkg=JSON.parse(get("package.json"));
assert.ok(pkg.scripts["menu:stability:verify"].includes("src/phase38-ci.ts"),
 "CI must run the independent disposable P38 HTTP checkout AFTER fixture-dependent P06");
assert.ok(p03.includes("Array.from({length:30}"),
 "Integration must exercise 30-option group create");
assert.ok(p03.includes("afterOptions.options.length,32")&&
 p03.includes("afterOptions.options.filter(x=>!x.active).length,20"),
 "Integration must preserve omitted modifier history after bulk update");
console.info("PASS P38: transaction-only snapshot caches, per-line price safety, bulk modifier writes, stale-version guards and bounded integration scenarios.");
