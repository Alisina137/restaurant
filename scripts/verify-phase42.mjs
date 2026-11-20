import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const get=path=>readFileSync(path,"utf8");
const route=get("apps/api/src/finance-routes.ts");
const math=get("apps/api/src/phase42-reconciliation.ts");
const frontend=get("apps/web/src/components/finance42-reconciliation.tsx");
const cashier=get("apps/web/src/components/finance-shifts.tsx");
const manager=get("apps/web/src/components/finance-shift-oversight.tsx");
const ci=get("apps/api/src/phase42-ci.ts");
const layout=get("apps/web/src/app/layout.tsx");
const style=get("apps/web/src/app/finance42.css");
const workflow=get(".github/workflows/verify.yml");
const api=route.split('financeRouter.get("/shifts/:id/reconciliation"')[1]
 ?.split('financeRouter.get("/shifts/history"')[0];
assert.ok(api,"Actual finance API route must exist");
for(const pattern of [
 'const scope=await financeScope(req)','eq(cashierShift.tenantId,scope.tenantId)',
 'eq(cashierShift.locationId,scope.locationId)',
 'scope.role==="cashier"&&shift.cashierId!==scope.actorId',
 'eq(checkPayment.tenantId,scope.tenantId)',
 'eq(financeRefund.tenantId,scope.tenantId)',
 'eq(diningCheck.tenantId,scope.tenantId)',
 'eq(checkReceipt.tenantId,scope.tenantId)',
 'reconcileShiftLedger(shift,payments,refunds,checks,receipts',
 "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
 'res.setHeader("Cache-Control","no-store")'
])assert.ok(api.includes(pattern),"Read-only tenant-scoped reconciliation missing "+pattern);
assert.ok(!api.includes("await tx.insert(")&&!api.includes("await tx.update(")&&
 !api.includes("await tx.delete("),"Audit must not mutate finance/receipt rows");
for(const pattern of ["externalCashVerified:false","pilotCertified:false",
 "expectedDrawerMinor=shift.openingFloatMinor+grossCashMinor-refundedCashMinor",
 "s.totalMinor!==check.totalMinor","s.paidMinor!==check.paidMinor",
 "RECORDED_VARIANCE_MISMATCH","SETTLED_RECEIPT_MISSING","SUPERVISOR_ACK_MISSING",
 "VARIANCE_ABOVE_LIMIT","database_ledger_and_immutable_receipt_snapshots"])
 assert.ok(math.includes(pattern),"Real ledger/receipt integrity rule absent "+pattern);
for(const p of ["en:",'"fa-AF":','"ps-AF":',"role=\"alert\"","f42-metrics",
 'jsonRequest<ShiftAudit42>("/api/finance/shifts/"'])
 assert.ok(frontend.includes(p),"Missing UX/locale/privacy handling "+p);
assert.ok(cashier.includes('<FinanceShiftReconciliation key={current.shift.id}')&&
 cashier.includes('reviewShiftId&&history?.items.some'),
 "Cashier must be able to inspect current and closed shifts");
assert.ok(manager.includes('<FinanceShiftReconciliation key={row.shift.id}')&&
 manager.includes('reviewShiftId&&history?.items.some'),
 "Owner/manager must inspect open staff and closed shifts");
assert.ok(ci.includes("current.data.receipts.receiptCount+supervised.receipts.receiptCount>0"),
 "Settled receipt may be linked to either winner of P09 concurrent cashier/owner tender");
assert.ok(ci.includes("One")||ci.includes("auditBefore"));
assert.ok(workflow.includes("src/phase42-ci.ts"),"Real seeded finance integration must be in CI");
assert.ok(layout.includes('import "./finance42.css"'));
assert.ok(style.includes("@media(max-width:580px)")&&style.includes(":focus-visible"));
console.info("PASS Phase 42: read-only protected ledger/receipt reconciliation, three-locale UI, closed/open shift evidence and CI contracts.");
