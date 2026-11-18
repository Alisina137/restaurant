# DineFlow Phase 31 — Kitchen Visibility Diagnostics & Disposable Rush Rehearsal

## Scope
Give kitchen operators a concrete way to investigate the **absence of a first foreground render report** rather than seeing only an aggregated count, and automate a controlled **20-table / 10 concurrent HTTP worker / 200 accepted-ticket** service rehearsal in an isolated test database. Do not claim a human saw a ticket, production SLA success, physical-device testing, or a real restaurant pilot.

## Role → screen → API → acceptance
| Role | Screen or tool | Actual behavior | Acceptance |
| --- | --- | --- | --- |
| Restaurant owner / manager / kitchen | Existing Kitchen Live / Preparing / Ready / History → Service Pulse → Display Receipt Gaps | Expand a read-only investigation panel, search by table, select minimum age 0/30/60/180/300 seconds, browse oldest-first pages, inspect real ticket details | Protected GET, scope + before-pagination filters, 10 maximum, safe empty/offline/role-denied states |
| Waiter / cashier / anonymous / unrelated restaurant | No access | Never receives another tenant's candidate ticket IDs or any customer/financial information | 401/403/empty isolated response |
| Development/staging operator on disposable DB only | Explicit `pnpm pilot31:rehearse` | Simulate 20 new tables, 10 concurrent HTTP workers and 200 real accepted rounds, validate pagination/replay/render-report reconciliation | Exactly 200 unique orders and tickets, no missing event or duplicate round numbers, 20 bounded queue pages, 200 idempotent display receipts |

## Delivered
1. **Protected gap triage**: `GET /api/orders/kitchen/unobserved?page=1&minAgeSeconds=30&table=`. Only active `new/preparing/ready/picked_up` tickets with NULL `first_displayed_at`. The exact server side age/table filter applies to both count and rows BEFORE pagination; sort by creation time and ticket ID; 10 rows per page; page bounds 1–1000, age allowlist 0,30,60,180,300; length-limit table filter with escaped wildcard characters. Returns only UUIDs, table label, order sequence, kitchen status/version, creation time, total, oldest matching timestamp and checkedAt. Reuses the Phase 30 tenant/location/status/createdAt partial index, **no new database migration**.
2. **Premium native kitchen operator panel**: expandable "Display Receipt Gaps" inside the existing Kitchen Performance card, with current aggregate count, age and table search, bounded pagination, elapsed duration, stage pill, "view ticket" (full authenticated existing detail), independently controlled 30-second refresh and foreground recheck. Read-only: opening a detail is not a confirmation of foreground queue render, kitchen acceptance, waiter pickup, or service. No generated green "healthy" indicator.
3. **Safety**: role- and tenant-scoped read endpoints. Stale/unverified GETs do not leave old "success" data; auth expiry redirects to sign-in, retry never sends workflow mutations, and changing a staff/restaurant scope resets state. Existing version checks and uncertain-write review remain unchanged. English, Dari (RTL) and Pashto (RTL), 48-pixel controls, keyboard labels and responsive sizes.
4. **Disposable end-to-end API rush rehearsal**: `apps/api/src/phase31-load.ts` refuses to run unless explicitly opted in, on localhost API and localhost PostgreSQL database named **`dineflow_ci`**, with `DEMO_PASSWORD` and no production NODE_ENV. Uses exactly 10 concurrent HTTP workers sharing a seeded demo waiter identity (NOT ten independent physical client devices). Creates 20 tables/visits and 200 immutable orders through normal API, verifies per-visit round numbering, 20 pages of 10 kitchen tickets, 200 accepted outbox events using replay cursor, 200 "missing report" diagnostic candidates and eventual 200 first-render receipt updates (in explicit 10-ticket batches). Reports observed HTTP wall-clock median/p95 and total duration without setting fake production SLAs. A temporary maxTables fixture accommodation is restored in a `finally` block on this guarded disposable DB.
5. **Automated checks**: `pnpm kitchen31:verify`, `src/phase31-ci.ts` live role/filter/age/concurrency checks, and gated `pnpm pilot31:rehearse` as the final GitHub CI step. CI build, all prior phase tests and migrations continue to run.

## Demo path
1. Sign in as kitchen/owner/manager, open `/kitchen/live`. Under the Kitchen Service Pulse, choose **Review missing reports**. Select minimum age and search table label; verify query count, oldest-first ordering, status and accessible next/previous buttons.
2. Select **View ticket** from a candidate row. The existing full ticket detail loads for an authorized kitchen role without altering the observation timestamp; don't let a KDS detail view count as a live queue render.
3. Simulate a missing observation in test/staging (keep a kitchen board closed while a waiter accepts an order). Observe the ticket in the list, open a genuine active kitchen board to produce the P30 foreground render receipt, refresh the list; it disappears from missing receipt candidates. If the dashboard fails, show a visible error instead of success.
4. Perform the P31 CI / guarded rehearsal on a **disposable** database and record counts and API request statistics. Never run these seeds on a real tenant or production DB.

## Explicitly NOT achieved
- No human confirmation, measured real-world Wi-Fi/Android tablet/network p95, OS push, sound-alarm guarantee, or proof of a ticket *not actually being seen*. Missing receipt may mean hidden browser, legacy data or telemetry loss.
- The ten HTTP workers share one demo user, unlike ten real devices. HTTP response latency is not end-to-end order-to-foreground-paint latency, and its observed p95 does not certify the specification's 3-second healthy network visibility target.
- The physical **Phase 14 restaurant shift**, printed QR/receipt/printer checks, real cash reconciliation, disaster restore, 320–1440px actual device inspection and independent pilot sign-off remain pending.

## Next
Phase 32 should be selected based on actual hardware, service/financial pilot observations and open defects rather than a fabricated launch claim.
