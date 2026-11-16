# DineFlow — Restaurant Ordering & Management SaaS

A Dari-first, tenant-scoped restaurant SaaS for Afghanistan. Product source of truth: [Product Specification v1.0](docs/PRODUCT-SPECIFICATION-v1.md) and [Development Workflow V5](docs/SOFTWARE-DEVELOPMENT-WORKFLOW-v5.md).

**Release status:** Phases 1–11 are merged to `main` (P11 via PR #11), with green full GitHub CI on the Phase 11 merge head. Next is P12 SaaS subscriptions and platform administration. Production certification still requires supervised restaurant, browser/mobile and receipt-printer QA.

## Phase 11 — Reporting and operational audit
Restaurant owners and managers can open `/app/reports` to view real Sales, Items, Service and Audit data. The restaurant Overview displays live operational KPIs. Reports enforce a 90-day restaurant-business-date window, use settled check totals for sales, posted tenders/refunds for net cash collected, and support audited CSV downloads. Cashier and waiter roles do not have permission to export these management reports. See `docs/PHASE-11-ACCEPTANCE.md`.

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

For a **real Android device**, `localhost` refers to the phone rather than your Windows laptop. In a separate terminal use `ngrok http 4000`, then put its **public HTTPS tunnel URL** in `apps/mobile/.env` as `EXPO_PUBLIC_API_URL`. Update auth origin configuration when necessary and restart Expo after changing public environment values. Do not mix port **4040** (ngrok inspector) with API port **4000**.

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
