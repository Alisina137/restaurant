import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const paths=[
 "apps/mobile/app/visit/[id]/new-order.tsx","apps/mobile/src/mobile25-cart.ts",
 "apps/mobile/src/mobile25-copy.ts","apps/mobile/src/mobile25-ci.ts",
 "apps/mobile/src/order-drafts.ts","apps/mobile/src/order-ui.tsx",
 "apps/api/src/phase25-ci.ts"];
for(const p of paths)assert.ok(existsSync(new URL(p,root)),"Missing P25: "+p);
const read=p=>readFileSync(new URL(p,root),"utf8");
const [screen,cart,copy,tests,drafts,modal,http]=paths.map(read);
function has(source,markers,area){
 for(const marker of markers)assert.ok(source.includes(marker),"P25 "+area+" missing "+marker);
}
has(screen,["FlatList","MenuCard","ItemOptionsModal","useSafeAreaInsets",
 "useFocusEffect","AppState","RefreshControl","aria", "reviewCart",
 "cartPrice","readDraft","saveDraft","clearDraft","addCartLine",
 "setLineQuantity","removeLine","setOrderNote","item.soldOut",
 "category","search","onPress:()=>void submit()",
 "floorRequest<VisitResult>","/api/floor/visits/",
 "/api/floor/tables/","/api/menu/catalog",
 "/api/orders/visits/","/rounds","idempotencyKey:snapshot.idempotencyKey",
 "sendConfirmation","markSubmissionPending","readSubmissionPending","clearSubmissionPending",
 "uncertainRef.current","retrySame","setUncertain(true)",
 "setBlocked(true)","router.replace","Promise.all","keyExtractor",
 "lastUpdated","draftPending","invalidLines"],"real native order builder");
has(cart,["reviewCart","validOptions","toggleOption","setLineQuantity","removeLine",
 "setOrderNote","addCartLine","validateStoredDraft","MAX_LINES=40","MAX_QTY=99",
 "item.soldOut","item.version!==line.itemVersion","group.version!==choice.version",
 "new Set","group.minSelections","group.maxSelections","line.note.length>250",
 "draft.note.length>500","2_000_000_000","idempotencyKey:newKey()"],"pure cart constraints");
has(drafts,["SecureStore","head25","pending25","serial","queue.set","v25:",
 "previous","slot","setItemAsync(p+\"head25\"","readLegacy","readCommitted",
 "validateStoredDraft","readSubmissionPending","markSubmissionPending",
 "clearSubmissionPending","clearDraft","MAX_LINES"],"atomic encrypted on-device draft storage");
has(modal,["ItemOptionsModal","toggleOption","validOptions","group.maxSelections",
 "group.minSelections","useSafeAreaInsets","accessibilityRole=\"button\"",
 "group.selectionMode===\"single\"?\"radio\":\"checkbox\""],"modifier sheet");
has(copy,["const en=","const fa:","const ps:","uncertain:","markerFailed:",
 "retrySame:","confirmBody:","validationFailed:","outdated:"],"three-language UX");
has(tests,["assert.equal(ok.valid,true)","invalid","validOptions",
 "toggleOption","reviewCart","validateStoredDraft","fa-AF","ps-AF"],"native selector acceptance");
has(http,["NODE_ENV===\"production\"","dev-restaurant","/api/orders/visits/",
 "15","IDEMPOTENCY_CONFLICT","ITEM_UNAVAILABLE","/api/menu/items/",
 "/api/menu/catalog","/api/orders/rounds/","/serve",
 "kitchenTicket","orderRound","orderLine","rounds.length,1","subtotal","64500",
 "cashier-ci@example.test","new-owner-ci@example.test","finish",
 "nextStatus:\"ready\"","nextStatus:\"preparing\""],"PostgreSQL kitchen handoff");
assert.ok(!screen.includes("cartPrice(l,menu)??0"),
 "Invalid or missing dishes must never be priced as zero.");
assert.ok(!screen.includes("postOrder(fake"),
 "Do not simulate kitchen receipt.");
const workflow=read(".github/workflows/verify.yml");
assert.ok(workflow.includes("phase25-ci.ts")&&workflow.includes("mobile25:verify"),
 "P25 must be added to full CI alongside all prior tests.");
console.info("PASS P25 static contracts: five-tab native navigation retained, real menu/cart, strict validators, crash-safe encrypted drafts, immutable key reconciliation, kitchen integration and three locales.");
