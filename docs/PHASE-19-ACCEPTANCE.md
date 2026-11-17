# Phase 19 — Advanced restaurant command center

## Implemented
- The actual owner/manager **`/app/overview`** screen now renders a complete operational dashboard, not the previous onboarding-oriented hero with four summary numbers. The platform administrator dashboard remains unchanged and separately role-restricted.
- New tenant-scoped **`GET /api/reports/dashboard?period=7|30`** powered by the existing Phase 11 finance reporting functions and Phase 9–11 ledger. It returns a single coherent data contract: current and immediately preceding equal-length restaurant business-date windows, daily collections and settled sales, actual refunds, top settled menu items, service timing/cancellation metrics, and live kitchen/guest/service/floor counters.
- **Finance correctness:** posted tenders minus posted refunds equals net collections; settled check sales are separately presented and **never added to collections**. Figures follow the configured restaurant business timezone; negative collection days and totals remain visible. Period change compares equal-duration windows, and previous zero produces “not comparable” rather than a fictitious percent.
- **Real-time operations:** eight scoped live counters, a prioritized action-required panel for pending approvals, guest requests, kitchen new/ready tickets and unpaid checks, direct links to implemented owner/manager pages, and a clearly labeled last-updated timestamp.
- **Trend and product data:** accessible daily chart with visible zero baseline and support for negative values, top five settled items ranked by net value, service throughput, median/p95 prep times and documented missing sample conditions.
- **Interaction reliability:** 7/30-day selector, visible refresh with 30-second polling only while the page is visible, refresh on reconnect/visibility return, stale-response guards and in-place error/retry states without removing the global workspace navigation.
- **Setup still accessible:** expandable profile/staff/trial summary and shortcuts to tenant settings, invitations, menu publication and table setup. The full menu and floor modules remain unchanged.
- All new labels in English, Dari and Pashto, fully RTL-aware card/charts and small-screen styling, reduced-motion and print handling. No new dependencies or schema migrations.

## Server controls and data interpretation
- Endpoint requires a **verified owner or manager** in the active tenant through `financeScope(req,true)`; unauthenticated, cashier, waiter and foreign tenants cannot read it. Queries always constrain both tenant and location.
- Period is strictly `7` or `30` (default 7); arbitrary from/to are rejected. Neither client clock nor browser timezone affects the backend's reporting boundaries.
- All financial totals and item discount allocation reuse `phase11-reporting.ts` implementations instead of being recreated as inferred application-level sums.
- The dashboard is an **operational snapshot**, not continuous live streaming. It refreshes every 30 seconds on visible tabs, and the timestamp reflects the last successful API response. Queue counts are not SLA overdue alerts; counts of pending items are labeled accordingly.
- Income and cash figures are distinct: collected is not “profit,” settled sales are not additive to collected, and a zero baseline is not turned into a fabricated percentage growth rate.

## Automated verification
- `pnpm dashboard:verify` runs a source/route, language, security and accessibility contract test in GitHub CI.
- `pnpm --filter @dineflow/api exec tsx src/phase19-ci.ts` tests scoped 7/30-day ranges, prior-period alignment, seeded PostgreSQL transaction/ledger reconciliation, nonnegative queue values, empty-safe rankings, role/tenant isolation and invalid-range rejection.
- Full existing `pnpm typecheck`, `pnpm test`, `pnpm build:web`, migrations, seeded Phase 1–14 integration, design/navigation/auth/interaction contracts run unchanged.

## Manual acceptance — not certified by CI
1. Owner and manager login: verify real queue counts match floor, orders, kitchen, guest approvals, service requests and unpaid checks. Cashier and waiter cannot open analytics routes.
2. Compare 7 vs 30 days, a no-sale day, negative net-collection refund day, zero previous period and quarter-crossing/time-zone edge case; reconcile against reports, receipts and a real cash drawer. Confirm **no** revenue/collection double-counting.
3. Update service statuses on waiter/kitchen device, check dashboard within 30 seconds. Put laptop offline, restore network, change periods rapidly and verify stale requests cannot replace newer dates.
4. Verify chart labels, accessible description, queue action links, RTL/LTR alignment, mobile widths 320/375/768 and reduced motion with real browser tests.
5. Ensure the setup panel and staff/menu/table links remain functional; verify location-specific data and that cross-tenant switching updates dashboard data without leaking previous tenant history.
6. Retain Phase 14 operator sign-off, receipt printer/Android, restore drill and audited cash reconciliation gates before production approval.

## Next phase
Phase 20 — Menu Management redesign and end-to-end publishing/availability polish. Physical pilot validation remains outstanding.
