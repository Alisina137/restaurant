# DineFlow — Restaurant Ordering & Management SaaS

A Dari-first, tenant-scoped restaurant SaaS for Afghanistan. Product source of truth: [Product Specification v1.0](docs/PRODUCT-SPECIFICATION-v1.md) and [Development Workflow V5](docs/SOFTWARE-DEVELOPMENT-WORKFLOW-v5.md).

**Implemented through Phase 6:** verified owner/staff auth; restaurant onboarding and role-aware management; full published menu and modifiers; dining sections/tables/live visits; waiters' 5-tab Expo ordering app; server-priced immutable order rounds and kitchen tickets; complete kitchen New → Preparing → Ready → Handed Off lifecycle; waiter item/ticket Served confirmation; durable ready notifications and in-app attention; kitchen history/realtime reconciliation. No QR guest self-ordering or settlement is exposed before its own phase.

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

Do **not** rerun `pnpm install` on each pull unless a missing dependency or a changed package manifest requires it. For initial setup, run `pnpm install` once. The Phase 6 update adds **no npm dependency**.

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

## Phase 6 demo
1. Owner publishes a meal and modifiers, creates a table and assigns a verified waiter.
2. Waiter opens a visit on mobile and sends a valid order to kitchen; the server commits **one order/ticket** even on retries.
3. Kitchen marks New → Preparing, optionally individual items Ready; all items Ready gives one notification to the assigned waiter.
4. Kitchen optionally marks Handed Off; waiter **confirms Served** from the Ready tab or order details. Serving does not post a payment.
5. Kitchen History and order activity keep status timestamps, audit events and original line/price snapshots.
6. A visit with accepted orders **cannot be pilot-closed without settlement**; cashier/check/receipt workflows are scheduled for Phase 9.

## Verification
```powershell
pnpm typecheck
pnpm test
pnpm build:web
```

GitHub CI also runs PostgreSQL migrations, seed and P01–P06 live API integrations (10-ticket rush, 100× safe idempotent retry from P05, assignment isolation, ready/served, notification replay and state/version conflicts). Tests on a real Android device and browser are still necessary before a live restaurant pilot.

See [Project State](docs/PROJECT-STATE.md), [Phase 05 Acceptance](docs/PHASE-05-ACCEPTANCE.md), and [Phase 06 Acceptance](docs/PHASE-06-ACCEPTANCE.md) for scope, test cases and remaining boundaries.
