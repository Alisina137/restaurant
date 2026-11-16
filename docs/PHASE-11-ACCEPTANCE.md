# DineFlow P11 — Reporting, exports and operational audit

Product spec: `docs/PRODUCT-SPECIFICATION-v1.md` P11, PG-24/27/32/33, F13, AT-013, BR-023/026/027.

## Delivered

- Restaurant management Reports workspace: **Sales / Items / Service / Activity Audit** with independent data states, loading, failures, date presets, up-to-90-day custom ranges, RTL/LTR Dari/Pashto/English, responsive cards/table/chart and CSV downloads.
- Home Overview live KPI pulse (active tables, today's non-void orders, unpaid persisted checks, today's net collected cash/transfer after refunds) with business-date/timezone labels; failed API requests are not shown as zero.
- Sales API computes **settled check sales** using the check's `settled_at` business date, and **posted tenders/refunds** using their own posting business dates. It separates gross subtotal, approved discount, tax, service, settled total, cash/transfer tenders and refunds, and net cash collected (posted payments minus posted refunds). These are **different ledgers/timelines** and must not be added to one another.
- Items API uses immutable accepted line snapshots on settled, non-voided rounds. It allocates the check's discount exactly (integer minor AFN units), with deterministic largest-remainder rounding per check and line. Output includes quantity, gross, discount and net sales by historical name; category filter uses **current** menu classification (not historical snapshot).
- Service API measures actual ticket and guest approval durations using timestamps: preparation median/p95, ready-to-served median, guest approval median/p95, item cancellation quantity rate and ticket throughput. Null/insufficient observations are **not fabricated as zero** (timings require three samples).
- Read-only management audit feed with time, actor ID, action and optionally check reference; no sensitive raw audit details or external customer information. Owner/manager only, tenant scoped.
- Owner/manager downloadable, BOM-prefixed, spreadsheet-injection-safe CSV for Sales, Items, Service, Transactions (payment and negative refund rows), and Audit. Date range max 90 business dates; exports are **audited** by `report.exported`, 5,000-row caps for raw transaction/audit/product outputs (reject instead of silently truncate). Restricted exports are not offered to waiters or cashiers.
- No new database migrations or npm dependencies were introduced.

## API routes

- `GET /api/reports/overview`
- `GET /api/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/reports/items?from=...&to=...&category=<id>`
- `GET /api/reports/categories`
- `GET /api/reports/service?from=...&to=...`
- `GET /api/reports/audit?from=...&to=...&action=<text>&page=1`
- `GET /api/reports/export?kind=sales|items|service|transactions|audit&from=...&to=...`

Financial queries use parameterized PostgreSQL and the restaurant IANA timezone. All money calculations preserve AFN integer minor units. The server validates date syntax, actual Gregorian dates, reversed/future ranges, and a 90-day inclusive window.

## Automated acceptance

`pnpm --filter @dineflow/api exec tsx src/phase11-ci.ts` runs after P10's acceptance test in `.github/workflows/verify.yml`. It checks:

1. Settled-sales and payment/refund sums reconcile directly with the database, independently of the UI.
2. Snapshot line gross and deterministically allocated discounts reconcile with settled check subtotals and discounts.
3. An actual P10 refund produces a separately exported negative ledger entry and reduces net collection.
4. Current-day home KPI net collection matches the current business-day financial series.
5. Waiter/cashier/unauthenticated users cannot access restricted financial reports and exports; another tenant does not see demo revenue.
6. Invalid dates, future dates, oversized ranges, invalid categories, and invalid export types are rejected.
7. CSV bytes include UTF-8 BOM, separate payment and refund entries, and export activity is visible in tenant audit events.

## Manual pilot QA still required

- On desktop and narrow browser widths, inspect chart scrolling, filters, empty/error/retry states, invoice links, and keyboard access; verify Dari/Pashto RTL and English LTR.
- Verify restaurant timezone edges (especially across local midnight), multiple split-payment checks, tax-inclusive policies, 30/90-day ranges, archived menu categories, and a refund posted in a different business day from its settlement.
- Compare item category results against current catalog, and verify that canceled rounds never contribute paid item sales.
- Try exported CSV in Excel and LibreOffice with multilingual names and formula-like malicious input; verify cells do not execute formulas.
- Supervise actual cashier shift reconciliation and physical receipts in the restaurant; GitHub CI cannot establish production money-handling readiness.

### Known exclusions

Inventory costs, net margin/profit forecasting, multi-location rollups, automated bank transfer confirmation, hardware/printer acceptance, and years-long unbounded reports are not part of P11. Reports are read-only and cannot edit original tickets, tenders or receipts.
