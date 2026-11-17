import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../",import.meta.url);
const paths=["apps/mobile/app/table/[id].tsx","apps/mobile/app/requests.tsx",
 "apps/mobile/app/approvals.tsx","apps/mobile/app/order/[id].tsx",
 "apps/mobile/src/mobile24-copy.ts","apps/mobile/src/mobile24-ops.ts",
 "apps/mobile/src/mobile24-ci.ts","apps/api/src/phase24-ci.ts"];
const read=p=>readFileSync(new URL(p,root),"utf8");
for(const p of paths)assert.ok(existsSync(new URL(p,root)),"Missing P24 file "+p);
const [table,requests,approvals,order,copy,logic,pure,http]=paths.map(read);
function check(source,patterns,part){
 for(const p of patterns)assert.ok(source.includes(p),"P24 "+part+" missing "+p);
}
check(table,['useLiveScreen','useSafeAreaInsets','getDetails','canOpen',
 'tableOperations','seatingValidation','partyCheck','/api/floor/tables/',
 '/api/floor/visits/tables/','partySize:Number(party)','result.created',
 '/api/floor/tables/','/ready','version:table.version',
 'Promise.allSettled','/api/orders/visits/','/api/guest/staff/approvals?status=pending&tableId=',
 '/api/service/requests?status=active&tableId=','/api/guest/staff/visits/',
 'pin/rotate','data.pin.version','setShowPin(false)','20000',
 'pinHidden','GuestPin','visitOrderCount','orderEstimateHint',
 'serviceActionAllowed','/api/service/requests/','/transition',
 'confirmResolve','noAssigned','/approvals','/requests',
 '/order/[id]','/visit/[id]/new-order',
 'LiveNotice','RefreshControl','ActivityIndicator','accessibilityRole="button"'],
 "role-secured table, guest PIN, visits and request actions");
check(requests,['useLocalSearchParams','tableId','URLSearchParams','status:tab',
 '/api/service/requests?','useLiveScreen','Pager','FlatList',
 'serviceActionAllowed','version:item.version','action,note:notes[item.id]',
 'confirmResolve','onPress:()=>void execute','tab==="active"',
 'tab==="resolved"','router.replace("/sign-in")',
 'LiveNotice','RefreshControl','noteText'], "service queue");
check(approvals,['useLocalSearchParams','tableId','guest/staff/approvals?',
 'status:"pending"','page:String(page)','useLiveScreen','Pager',
 'router.push({pathname:"/approvals/[id]"','LiveNotice','FlatList'],
 "table-filtered guest approvals");
check(order,['useFocusEffect','AppState','requestRef','serveRef','cancelRef',
 'version:detail.ticket.version','readyToDeliver','order.taxMinor+order.serviceMinor',
 'visitIsOpen','/api/floor/visits/','void executeServe(lineId)'],
 "kitchen food delivery and visit state");
check(copy,['const en=','const fa:','const ps:','m24(locale:Locale',
 'pinRotateWarning','guestPinSafety','settlementHint','requestHandled','maxParty'],
 "localized Dari Pashto English");
check(logic,['seatingValidation','tableOperations','serviceActionAllowed',
 'readyToDeliver','visitOrderCount','role==="waiter"','readOnly:!table||!canOpen'],
 "pure mutation gates");
check(http,['NODE_ENV==="production"','dev-restaurant','waiter-ci@example.test',
 'owner-ci@example.test','new-owner-ci@example.test','/api/floor/tables/',
 '/api/floor/visits/tables/','CAPACITY_REVIEW','/api/service/requests?status=active',
 'status=resolved&tableId=','/api/guest/staff/visits/','pin/rotate',
 '/api/guest/staff/approvals?status=pending&tableId=',
 'VERSION_CONFLICT','nextTableStatus','cleaning','/finish','/archive'],
 "HTTP PostgreSQL acceptance");
check(pure,['seatingValidation','tableOperations','serviceActionAllowed',
 'readyToDeliver','visitOrderCount','"fa-AF"','"ps-AF"','"en"'],
 "native data tests");
assert.ok(!table.includes('finish",{method:"POST"'),
 "Waiter mobile must not simulate cashier or force-finish table visits.");
assert.ok(!table.includes("console.log(data.pin"),
 "Guest PIN must never be logged from the mobile screen.");
assert.ok(read(".github/workflows/verify.yml").includes("phase24-ci.ts"),
 "P24 must be tested in seeded PostgreSQL CI.");
console.info("PASS P24 mobile contract: scoped visit state machine, private PIN, real requests/orders, role guards, pager, locale, backend integration and cashier boundaries.");
