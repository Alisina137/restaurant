import assert from "node:assert/strict";
import {isWrongRoleRoute} from "./phase43-route-gates";

for(const route of [
 "/cashier/reports","/platform/reports","/kitchen/reports",
 "/platform/pilot","/cashier/pilot",
 "/platform/billing/shifts","/kitchen/billing/checks",
 "/app/ready","/platform/ready","/app/preparing",
 "/app/history","/cashier/history","/app/pilots",
 "/platform/checks","/app/shifts","/kitchen/transactions"
])assert.equal(isWrongRoleRoute(route),true,"Must return real 404: "+route);

for(const route of [
 "/","/login","/register","/dev/interfaces","/g/guest-visit/menu",
 "/app/overview","/app/reports","/app/reports/","/app/pilot",
 "/app/billing/shifts","/app/billing/receipts/receipt-1",
 "/cashier/checks","/cashier/checks/id-1",
 "/cashier/shifts","/cashier/receipts","/cashier/transactions",
 "/kitchen/live","/kitchen/ready","/kitchen/preparing","/kitchen/history",
 "/platform/overview","/platform/pilots","/platform/pilots/id",
 "/platform/settings","/app/settings","/cashier/account",
 "/kitchen/account","/platform/account"
])assert.equal(isWrongRoleRoute(route),false,"Never block legitimate route: "+route);
console.info("PASS P43 upstream area guard: real HTTP 404 for wrong role route, no false block for valid/guest/platform screens.");
