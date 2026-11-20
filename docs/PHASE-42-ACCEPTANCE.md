# DineFlow Phase 42 — Cashier Settlement, Receipt Integrity & Financial Audit

**Purpose:** Make previously posted cashier financial evidence independently reviewable by the restaurant owner/manager and the cashier who operated the shift, without changing or fabricating payment, refund, physical cash or receipt events.

## Delivered

A **read-only shift reconciliation** is available on cashier **Shifts** and restaurant manager **Shift Oversight**, including both active shifts and selected closed shifts. It compares the database's durable payment rows, cash refunds, immutable settled receipts and the shift's saved closing amounts. The panel uses a real authenticated API; it is not a demo of synthetic finance numbers.

### Endpoint and authority

`GET /api/finance/shifts/:id/reconciliation` is limited to the existing finance roles. Restaurant owner/manager can inspect their own tenant's shifts; a cashier may inspect **only their own shift**. A foreign tenant, unauthenticated visitor, kitchen staff, waiter or platform administrator cannot inspect private drawer contents. The response is `Cache-Control: no-store`, has no mutating counterpart and returns only aggregate numbers and named mismatch signals, **not** raw financial records, guest details, transfer references or payment identifiers.

A repeatable-read **read-only PostgreSQL transaction** takes the actual shift, all posted payments/refunds and linked settled checks and receipts from one consistent snapshot, scoped to tenant and location. Reading these summaries creates **no financial or pilot audit write**.

### Checks

| Check | Actionable evidence |
| --- | --- |
| Cash credited | Sum of `posted` cash payments, not physically tendered amount before change; verify `received − change = amount credited`. |
| Transfer credited | Sum of verified *manually recorded* transfer entries, **not** provider/bank evidence. |
| Refunds | Separately subtract cash and manual-transfer refunds. Immutable original receipt snapshots remain unchanged after later refunds. |
| Expected cash drawer | `opening float + posted cash credits − cash refunds`. The external transfer balance is excluded from the cash drawer. |
| Closed shift expected/variance | Detect if recomputed expected cash differs from saved expected or if saved variance differs from counted cash minus recalculated expected. |
| Manager variance | Above-threshold discrepancy requires supervisor acknowledgment. **Even when acknowledged**, the discrepancy remains a manual investigation item; this panel never certifies physical cash. |
| Receipt integrity | For settled checks linked to this shift's transactions/refunds, ensure the original receipt exists and its immutable total/paid snapshot agrees with the settled check and the receipt's recorded payment lines. **Unsettled checks are not incorrectly flagged as missing receipts.** |
| Payment status | Signal if a shift contains non-posted payment entries or inconsistent received/change arithmetic. |

Open shifts are explicitly **not yet physically counted**; they never show a fake zero variance. Closed shifts show the saved count and independent ledger reconstruction. Errors clear prior results instead of displaying a stale green status.

### UI & language

The cashier's **Current Shift** shows a collapsed `Review settlement evidence` section. Both cashier and restaurant manager **Shift History** provide per-shift `Reconcile` buttons. Management **Open Staff Shifts** shows a collapsible panel on each active cashier shift. Each audit shows expected drawer, credits, refunds, transfer separation, count/variance, posted payment count, receipts, missing receipts, suspicious snapshots, named warnings and an explicit physical evidence disclaimer. Full English, Dari RTL and Pashto RTL; responsive mobile card layout, visible focus and manual refresh.

### Automated verification

- `pnpm phase42:verify`: source, authorization, read-only SQL, formula, UI/translation, safe loading/error, CSS and GitHub CI wiring contracts.
- `pnpm test`: deterministic tests for cash/change/refunds, later refunds retaining original receipt, true missing receipt, mismatched snapshot, non-posted tender, missing supervisor acknowledgment, above-threshold variance, saved-expected drift and open-shift evidence.
- `pnpm --filter @dineflow/api exec tsx src/phase42-ci.ts`: **real disposable seeded PostgreSQL** integration after Phase 9's settled receipts / closed cashier and manager shifts and Phase 10's refund. Checks caller/tenant isolation, no-store, independent ledger arithmetic, immutable receipt availability, acknowledged-but-still-suspicious manager variance, current refund shift and absence of any audit write.
- CI still runs all existing phase integrations, TypeScript checks, production web build, prior P33/P34 security gates and synthetic P31 rush rehearsal.

**No new npm dependency, database table, migration or external payment service.** Pull the code, restart API and web. This is a read-only evidence view; no shift, cashier policy, receipt format or refund posting semantics are changed.

### Actual restaurant release remains on HOLD until human evidence

A real cashier must independently count the physical drawer and verify cash returned as change and refunds. A supervisor must reconcile recorded transfer references *outside* DineFlow, check actual bank confirmations and inspect printed receipts. For any discrepancy, record an accountable P0/P1 pilot incident, preserve original immutable records, and do not waive closure procedures to make the dashboard green. Test actual Android, kitchen/printer receipt behavior, multi-tenant separation, restore and supervised end-to-end restaurant shift; obtain independent human GO/HOLD per Phases 33–34 and 41.

**Next proposed Phase 43:** end-to-end pilot defect remediation and release-candidate verification based on observed device and finance evidence, without fabricating real payments or hardware trials.
