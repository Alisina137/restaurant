# DineFlow — Restaurant Ordering & Management SaaS

A Dari-first, tenant-scoped restaurant SaaS for Afghanistan. Product source of truth: [Product Specification v1.0](docs/PRODUCT-SPECIFICATION-v1.md) and [Development Workflow V5](docs/SOFTWARE-DEVELOPMENT-WORKFLOW-v5.md).

**Release status:** Phases 1–14 source code is merged into `main` (Phase 14 via PR #15). The Phase 14 acceptance suite passed in a disposable CI database. **The real restaurant pilot, device and cash testing, and final commercial release approval have NOT been performed.**

## Phase 12 — Restaurant subscriptions, manual payment verification and platform operations

Restaurant owner/manager: `/app/subscription` displays the plan, trial/renewal/grace information, invoice snapshots, and a printable invoice (browser **Print → Save as PDF**). Owners can submit an exact-amount cash/bank/mobile-money reference for independent **platform verification**; pending evidence **never** marks an invoice paid. Owners can open support tickets and grant temporary, revocable metadata-only access at `/app/support`; managers can read billing and support state.

Platform administrators: `/platform/overview`, `/platform/restaurants`, `/platform/subscriptions`, `/platform/support`, `/platform/audit`, and `/platform/settings` manage restaurant status, plan versions, invoice issuance, manual payment review, support and audited policy changes. Private customer orders and restaurant tender ledgers are **not** exposed to platform administrators through these workspaces.

Server enforcement blocks creating new visits when a subscription is suspended or its trial/grace window has expired, while preserving the ability to close an existing visit; table and staff capacity checks use tenant-scoped transaction guards. New plans create versions and do not rewrite issued invoice amounts. Multi-branch plans and automatic payment gateways are not released. **After pulling Phase 12, run `pnpm db:migrate`**. See [Phase 12 Acceptance](docs/PHASE-12-ACCEPTANCE.md) for the complete checklist and remaining on-device/cash-handling acceptance.

## Phase 11 — Reporting and operational audit
Restaurant owners and managers can open `/app/reports` to view real Sales, Items, Service and Audit data. The restaurant Overview displays live operational KPIs. Reports enforce a 90-day restaurant-business-date window, use settled check totals for sales, posted tenders/refunds for net cash collected, and support audited CSV downloads. Cashier and waiter roles do not have permission to export these management reports. See `docs/PHASE-11-ACCEPTANCE.md`.

## Development Interface Launcher (local-only)
Run `pnpm dev:api` and `pnpm dev:web` in separate PowerShell terminals, then open **http://localhost:3000/dev/interfaces**. A premium six-card developer page links to management, kitchen, cashier and platform web roles, gives the waiter Expo Go launch command, and safely opens a real customer QR entry when an issued table link is pasted. It checks the public API readiness endpoint, explains independent staff sign-ins and the guest PIN requirement, and is localized in English, Dari and Pashto. It has **no authentication bypass**, no synthetic orders and no demo passwords. Production builds return **404** at the launcher route. For instructions see `docs/DEV-INTERFACE-LAUNCHER.md`.

## Menu category stability (second Menu tab)

Menu → **Categories** saves through `POST /api/menu/categories`. The API now registers the Node PostgreSQL pool's idle-connection `error` event so transient Neon/PgBouncer disconnects cannot surface as an uncaught EventEmitter exception that terminates the Express server. Category duplicate-name conflicts return an actionable 409; missing menu tables/columns return a safe 503 with a **development-only** migration hint; transient DB failures remain retryable errors. The category editor keeps the form open and reports these errors in the selected UI language.

After pulling this fix, use your existing `apps/api/.env` and run `pnpm db:migrate` (safe with current migrations), then restart `pnpm dev:api` and `pnpm dev:web`. If the API still exits, **capture the last 30 lines of the API terminal** (remove any private connection string) to identify the exact remaining cause. No new database migration is added by this patch. GitHub CI runs `pnpm menu:stability:verify` against disposable PostgreSQL: concurrent category creation, duplicate conflict, role isolation, publish, modifiers and API readiness.

## Phase 41 — Pilot next actions and durable review evidence

The supervised restaurant pilot screen now explains **what the owner or platform reviewer must do next**, based on the 12 existing physical acceptance gates, unresolved critical incidents, P2 follow-ups and current signatures. It links directly to the real evidence/incident/signoff workflow and supports English, Dari and Pashto. A deep-history bug is fixed: the latest review for **each** gate and owner/platform stage is retained even after hundreds of retests or HOLD entries. Release approvals still require human evidence and cannot be auto-generated by telemetry or tests. No database migration or dependencies. Run `pnpm pilot41:verify`; see `docs/PHASE-41-ACCEPTANCE.md`.

## Phase 40 — Check an uncertain order before retrying

The waiter Expo app now checks the restaurant API for a **confirmed receipt of the original submission** before repeating any HTTP POST after an ambiguous response or app restart. A matched receipt opens the **existing** order with no second POST. Only a verified `404 NOT_FOUND` allows a **user-triggered** replay of the **unchanged cart and original idempotency key**; all other lookup failures preserve the encrypted pending marker. New read-only `GET /api/orders/visits/:id/submissions/:key` enforces tenant/location/visit/original-actor ownership and provides minimal no-store data. The busy-lock protections from Phase 39 remain. English/Dari/Pashto labels explain the check. No new dependencies or migration; restart API and Expo after pulling. Verification: `pnpm phase40:verify`; runbook: `docs/PHASE-40-ACCEPTANCE.md`. Physical tablet/Wi-Fi/finance verification and human GO/HOLD are still required.

## Phase 39 — Busy order recovery without duplicate tickets

Waiter and guest order creation now cap PostgreSQL row-lock waiting at eight seconds per transaction. On recognized transient failures, **only** these two idempotent endpoints return `503 ORDER_STATUS_UNCERTAIN` and `Retry-After: 3`, instructing the device to recheck/replay the **identical cart and submission key** rather than creating a new ticket. The Expo waiter UI retains its encrypted pending key and shows clear English/Dari/Pashto recovery guidance. No account/financial/menu endpoints receive automatic retries. Phase 39 adds a disposable CI simulation that holds a real table lock, verifies bounded failure, then confirms exactly one ticket/outbox on same-key recovery. **No dependency or new migration**; restart API and mobile after pulling. See `docs/PHASE-39-ACCEPTANCE.md`.

## Phase 38 — Repeated dish checkout and bulk modifier editor reliability

Shared waiter and approved guest checkout pricing now uses **transaction-local PostgreSQL-locked snapshots** for repeated meal and modifier group metadata, preserving per-line price/option/version/quantity/note checks, tenant isolation, idempotency and all financial/audit safeguards. Restaurant manager modifier group create/edit operations batch up to 30 new option inserts and omitted-option deactivation under existing version locks. Existing database schema and API/UI contracts are unchanged. Run `pnpm phase38:verify` for safety contracts; CI runs a standalone, disposable 40-line repeated-dish checkout after P05/P06 and P03 with 30-option create/update regression. **No new migration or package installation for Phase 38.** See `docs/PHASE-38-ACCEPTANCE.md` for source-level query savings vs unverified real-world performance.

## Phase 37 — Faster kitchen queues and multi-line orders

Waiter and approved guest orders now insert all validated line snapshots in one transaction statement instead of one database round trip per line. Kitchen cards reuse one authorized request scope and fetch ticket metadata directly from the queue row, avoiding a redundant ticket read; management/kitchen list/count queries no longer join visits unless checking waiter assignment for the **My Orders** route. The API response and role boundaries remain compatible. No new dependencies or migrations for Phase 37 (Phase 36 migration 0017 is still required if not previously applied). Verification: `pnpm phase37:verify`, `pnpm typecheck`; see `docs/PHASE-37-ACCEPTANCE.md`. Real latency differences should be measured against staging rather than assumed from passing CI.

## Phase 36 — API performance and availability evidence

The platform administrator's **Operational recovery** panel at `/platform/overview` now also displays observed last-five-minute API p50/p95 response times, request counts, 5xx and rate-limit trends, safe route-category hotspots and PostgreSQL connection pool pressure. Evidence is explicitly per-server, bounded to 1,024 samples, excludes liveness probes, is available only to platform administrators and never authorizes a real pilot. Phase 36 also includes a partial pending-outbox index and bounded HTTP header/body reception timeouts. **After pulling Phase 36, run `pnpm db:migrate`** once with your existing database configuration, then restart `pnpm dev:api` and `pnpm dev:web`. See `docs/PHASE-36-ACCEPTANCE.md`. Verification: `pnpm phase36:verify`, `pnpm test`.

## Phase 34 — Deployment preflight and operator HOLD gates

Before a *human-approved* HTTPS staging candidate is considered for release, run `pnpm ops:preflight --api-origin https://api.your-staging-domain.example --web-origin https://your-staging-domain.example` with real staging origins. The command reads only public liveness/readiness endpoints, verifies anonymous authorization boundaries, and checks the web sign-in and absence of the dev launcher. It cannot certify a restaurant pilot, production rollout, database backup, receipt printer, financial reconciliation or a human release decision. Automated source tests: `pnpm ops:preflight:verify`. See `docs/PHASE-34-ACCEPTANCE.md` for go/no-go and rollback responsibilities.

## Workspace
- `apps/api` — Express 4, Drizzle/PostgreSQL, Better Auth, roles, menu, floor and kitchen/notification APIs (port **4000**).
- `apps/web` — Next.js 16, owner/manager, kitchen, cashier and platform workspaces (port **3000**).
- `apps/mobile` — Expo SDK 57, waiter mobile application (Expo Go).
- `packages/shared` — localized roles, language and shared types.

## Windows PowerShell setup

From the existing cloned folder:

```powershell
cd C:\projects\restaurant
git pull --ff-only origin main
```

Do **not** rerun `pnpm install` on each pull unless a missing dependency or a changed package manifest requires it. For initial setup, run `pnpm install` once. Phase 9 adds no npm packages, but Phase 7 introduced the QR renderer `qrcode.react`; run `pnpm install` once after pulling updates to a working copy last installed before Phase 7.

If the local environment files do not exist, **create them from the committed examples**:

```powershell
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.local.example apps\web\.env.local
Copy-Item apps\mobile\.env.example apps\mobile\.env
```

Fill `apps/api/.env` with your PostgreSQL `DATABASE_URL` and a unique `BETTER_AUTH_SECRET` of at least 32 characters. The example's database string and secret are placeholders; do not use them as real credentials. API URL and trusted origin must match the actual hosts. Never commit secrets.

For a **real Android device**, `localhost` refers to the phone rather than your Windows laptop. **You no longer need to launch `ngrok http 4000` in a separate terminal.** Install and authenticate the ngrok CLI on your laptop once (for example `ngrok config add-authtoken <your-token>`, keeping the token private). Start the API with `pnpm dev:api`, then run `pnpm dev:mobile`. The mobile command automatically starts or reuses the local API ngrok tunnel to port **4000**, discovers its public HTTPS endpoint through the local ngrok inspector at **4040**, injects it as `EXPO_PUBLIC_API_URL` **for that Expo process only**, and launches Expo Go. It does not overwrite your existing `apps/mobile/.env` or other settings. Stopping Expo stops the ngrok tunnel it started (but not a preexisting tunnel). If Expo's own `--tunnel` conflicts with ngrok account limits, use `pnpm dev:mobile:lan` on the same Wi-Fi instead (the API tunnel still starts automatically). The API and web servers remain separate. See `docs/DEV-INTERFACE-LAUNCHER.md` for details.

Run the database migration from the repository root:

```powershell
pnpm db:migrate
```

For a **local pilot only**, optionally set `DEMO_PASSWORD` (12+ chars) and the `DEMO_*_EMAIL` values in `apps/api/.env`, then run `pnpm seed:dev`. This is never for production identities. Owner self-registration and staff invitations work through the actual onboarding flow.

Start the three services from `C:\projects\restaurant` in **separate PowerShell terminals**:

```powershell
pnpm dev:api
# separate terminal:
pnpm dev:web
# separate terminal:
pnpm dev:mobile
```

- Web: `http://localhost:3000`.
- API readiness: `http://localhost:4000/api/health/ready`.
- Owner/menu: `http://localhost:3000/app/menu/items`.
- Restaurant tables: `http://localhost:3000/app/tables/board`.
- Orders: `http://localhost:3000/app/orders/live`.
- Kitchen: `http://localhost:3000/kitchen/live`, `/kitchen/preparing`, `/kitchen/ready`, `/kitchen/history`.
- Waiter mobile: Home, Tables, Orders, Menu, More, with ready alerts and Serve actions.

## Phase 9 — cashier settlement

```powershell
cd C:\projects\restaurant
git fetch origin phase-09-cashier-checks-ledger
git switch -c phase-09-cashier-checks-ledger --track origin/phase-09-cashier-checks-ledger
pnpm install
pnpm db:migrate
```

The development cashier routes are `/cashier/checks`, `/cashier/transactions`, `/cashier/shifts`, `/cashier/receipts`. Owners/managers use `/app/billing/checks`, `/app/billing/transactions`, `/app/billing/receipts`, and `/app/settings/charges`. A verified guest can read the current visit bill at `/g/:visit/bill`.

Real cashier process: open shift → open check → optional split → record **cash** or **manually verified external transfer** → ensure all orders served and approvals resolved → settle → print immutable receipt → clean table. Payment Requested is not populated until Phase 8 service requests exist.

See [Phase 09 Acceptance](docs/PHASE-09-ACCEPTANCE.md) for security, test coverage and release dependencies.

## Phase 6 demo
1. Owner publishes a meal and modifiers, creates a table and assigns a verified waiter.
2. Waiter opens a visit on mobile and sends a valid order to kitchen; the server commits **one order/ticket** even on retries.
3. Kitchen marks New → Preparing, optionally individual items Ready; all items Ready gives one notification to the assigned waiter.
4. Kitchen optionally marks Handed Off; waiter **confirms Served** from the Ready tab or order details. Serving does not post a payment.
5. Kitchen History and order activity keep status timestamps, audit events and original line/price snapshots.
6. A visit with accepted orders **cannot be pilot-closed without settlement**; use the actual cashier/check/receipt workflow delivered in Phase 9.

## Verification
```powershell
pnpm typecheck
pnpm test
pnpm build:web
```

GitHub CI on the Phase 9 branch also runs PostgreSQL migrations, seed, P01–P06 and P09 live API integrations (10-ticket rush, 100× safe idempotent retry from P05, assignment isolation, ready/served, notification replay and state/version conflicts). Tests on a real Android device and browser are still necessary before a live restaurant pilot.

See [Project State](docs/PROJECT-STATE.md), [Phase 05 Acceptance](docs/PHASE-05-ACCEPTANCE.md), and [Phase 06 Acceptance](docs/PHASE-06-ACCEPTANCE.md) for scope, test cases and remaining boundaries.

## Phase 08 — Guest assistance and table service (development branch)

- Guest web `/g/:visit/help`: verified active-visit session, **Call waiter**, **Water**, **Cutlery**, **Request bill** (together/split preference), **Other** (note required); optional note ≤200 characters; live Pending → Acknowledged → Resolved status.
- Anti-spam: one unresolved request of each kind per visit, transaction-serialized and deduplicated; 60-second repeated-request cooldown. Closing a visit expires guest session; requests are tenant/location/visit scoped.
- Waiter Expo: **Customer requests** card on Home, active requests on **Tables → Needs Attention**, table detail summary, and `/requests` inbox with acknowledgement, resolution and history.
- Owner/manager web: `/app/service/requests` for all authorized restaurant tables and reconciliation. Cashier **Payment Requested** uses real unresolved bill requests, including zero-total visits; no fabricated data.
- Real-time experience: active screen polling and app-resume refresh. Backend uses durable Postgres rows, revision bumps and audit events; no push delivery guarantee.
- **Boundary:** P08 intake/handling of guest service requests and P05 additional immutable order rounds are functional. Destructive item changes, voids, refund approvals and financial corrections remain gated for P10; no mutation of accepted kitchen/financial snapshots is exposed.
- Validation: `pnpm --filter @dineflow/api exec tsx src/phase8-ci.ts` in a seeded disposable development database with API running.

Follow [Phase 08 Acceptance](docs/PHASE-08-ACCEPTANCE.md) before live use.

## Phase 10 — Reviewed financial corrections and refunds

- Cashier correction requests: `/cashier/adjustments`; manager approval/review: `/app/billing/adjustments`.
- Before a tender or split, a different manager can approve a fixed discount or void an unstarted kitchen round; no accepted source order is deleted.
- After settlement, approved cash or externally verified-transfer refunds become independent reversal entries. They do **not** modify original posted tenders or immutable receipts. Cash shift reconciliation subtracts cash refunds.
- Pending corrections block tender/split/settlement until reviewed. All changes are tenant-scoped and versioned, with audit, idempotency and capped sums.
- Automated API regression (disposable development DB) `pnpm --filter @dineflow/api exec tsx src/phase10-ci.ts` runs in GitHub CI after the earlier phases.
- See [Phase 10 Acceptance](docs/PHASE-10-ACCEPTANCE.md). Bank/card refund automation is not implemented; real-money reconciliation must be supervised during pilot.

## Phase 13 — Reliability safeguards and operator release checklist

- Production API config, secure request headers, sanitized operations logs, public traffic limits and outbox crash replay with platform health monitoring.
- Keyboard skip navigation and three-language disconnected-state feedback.
- Disposable PostgreSQL restore rehearsal via `pnpm ops:rehearsal` (requires explicit environment confirmation, separate target database and PostgreSQL client tools).
- Source and automated integration gates merged in [PR #14](https://github.com/Alisina137/restaurant/pull/14); browser, Android, printing, financial cash and real restore rehearsals require manual sign-off **before pilot**. See [Phase 13 Acceptance](docs/PHASE-13-ACCEPTANCE.md).

## Phase 14 — Supervised pilot control room and release sign-off
Restaurant owner/manager: `/app/pilot` shows 12 mandatory gates and current evidence; only the owner may record a PASS/FAIL or sign after all gates pass. Platform administrators use `/platform/pilots` for independent HOLD/APPROVE. Any changed gate invalidates both prior signatures; the record is not an automatic deployment switch. **No restaurant pilot has been conducted by this implementation.** See `docs/PILOT-RUNBOOK.md` and `docs/PHASE-14-ACCEPTANCE.md`. After pulling P14 run `pnpm db:migrate`.
