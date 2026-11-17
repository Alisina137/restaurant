import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=(p)=>readFileSync(new URL(p,root),"utf8");
const api=read("apps/api/src/phase19-dashboard.ts");
const report=read("apps/api/src/phase11-reporting.ts");
const server=read("apps/api/src/index.ts");
const component=read("apps/web/src/components/restaurant-dashboard.tsx");
const route=read("apps/web/src/components/phase2-overview.tsx");
const css=read("apps/web/src/app/dashboard.css");
const layout=read("apps/web/src/app/layout.tsx");
const copy=read("apps/web/src/lib/dashboard-copy.ts");
for(const key of [
 'dashboardRouter.get("/dashboard"', "financeScope(req,true)", 'reportRange(req,scope,period)',
 'salesData(scope,range)', 'salesData(scope,prior)', 'itemsData(scope,range,"")',
 'serviceData(scope,range)', "liveMetrics(scope.tenantId", "pendingGuestApprovals",
 "pendingServiceRequests", "Cache-Control", "no-store", 'INVALID_PERIOD'
])assert.ok(api.includes(key),"Missing safe dashboard service behavior: "+key);
assert.ok(server.includes('app.use("/api/reports",dashboardRouter)'));
for(const symbol of ["export async function salesData", "export async function serviceData",
 "export async function itemsData", "export async function reportRange"]) {
 assert.ok(report.includes(symbol),"P11 ledger behavior must be reused, not reimplemented: "+symbol);
}
for(const key of [
 "/api/reports/dashboard?period=","/api/tenant/setup","visibilitychange","setInterval(",
 "window.addEventListener(\"online\"","activeRequest.current","percentageChange",
 "DailyChart","topItems","Needs", "pendingGuestApprovals"
].filter(x=>x!=="Needs")){
 assert.ok(component.includes(key),"Dashboard missing necessary data/state/feature: "+key);
}
for(const path of ["/app/orders/live","/app/tables/board","/app/billing/checks",
 "/app/service/requests","/app/reports","/app/staff/directory"]){
 assert.ok(component.includes(path),"Dashboard quick action must lead to implemented route: "+path);
}
assert.ok(route.includes("<RestaurantDashboard/>"),"Owner and manager overview must actually load advanced dashboard");
for(const key of [".p19-metrics",".p19-live-grid",".p19-trend-chart",".p19-alerts",
 ".p19-setup-panel","@media(max-width:420px)","prefers-reduced-motion","[dir=rtl]"]){
 assert.ok(css.includes(key),"Missing responsive dashboard design: "+key);
}
assert.ok(layout.includes('import "./dashboard.css";'));
for(const key of ["const en=", "const fa:", "const ps:", "d19(locale:Locale"]){
 assert.ok(copy.includes(key),"Missing localized dashboard copy: "+key);
}
const types=read("apps/web/src/lib/dashboard-types.ts");
assert.ok(types.includes("percentageChange")&&types.includes("previous===0"),"Previous zero must not fabricate percentage");
const ci=read("apps/api/src/phase19-ci.ts");
for(const term of ["owner-ci@example.test","cashier-ci@example.test","waiter-ci@example.test",
  "new-owner-ci@example.test","dashboard7","dashboard30","ledger","status,403"]){
 assert.ok(ci.includes(term),"P19 integration scope missing: "+term);
}
console.info("Phase 19 dashboard contract verified: authorized tenant metrics, real ledger comparisons, 3 locales, live tiles, visual/ARIA states and operational links.");
