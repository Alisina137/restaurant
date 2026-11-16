# DineFlow — Project State

Product specification v1.0 · Software Development Workflow V5 · GitHub `Alisina137/restaurant`.

## Delivery progress

- **P01–P04**: Auth and role shells; restaurant onboarding and staff; menu management; sections, tables, live visits and waiter assignments. All previously merged to `main`, with their API/CI checks passing. Real-device review remains ongoing.
- **P05**: Real waiter ordering, immutable order snapshots and initial kitchen receiver, merged to main after CI.
- **P06**: Complete kitchen New/Preparing/Ready/History, optional handoff, per-line readiness, waiter Served + Completed, durable notifications, sound/vibration opt-ins, authorized event cursor and resync. Implemented in branch `phase-06-kitchen-service`; see `docs/PHASE-06-ACCEPTANCE.md`. Mobile/browser visual QA and production push delivery remain outstanding.

### P05 completed work
- **Waiter mobile: 5 active bottom tabs**: Home (real active tables/orders summary), Tables (active visit, current rounds), Orders (Active/Ready; Completed explains future serving), Menu (read-only catalog and choose an active table), More (existing profile/language/signout).
- **Order builder**: active visit-scoped Menu/Cart, search/category browsing, meal customization (mandatory option min/max), quantity 1–99, note, exact price estimate, encrypted device-local per-line draft, explicit Send, server acknowledged order, retry with same idempotency key, cart preserved if API fails. The server rejects obsolete item/version/options and expired visits.
- **Kitchen web**: high-contrast New, Preparing and Ready tabs; snapshot line cards, option/note details, Start Preparing / Mark Ready actions, server version checks and reconciling SSE/poll.
- **Restaurant manager web**: Orders Live and History tabs; no fake payment data.
- **DB/API**: order_rounds, order_lines with immutable prices/name/options/allergens, kitchen_tickets unique per round, order_activities, transactional order_outbox and order_revisions. Each submit locks the visit table, validates active membership and all menu choices in transaction, stores atomic order+ticket+activity+outbox and responds from committed state. Prices in AFN minor units, no fictional taxes or service charges.
- **Safety**: P04 pilot "finish visit" now blocks visits containing any accepted order until cashier settlement exists (P09); avoids silently closing unpaid work. Kitchen can only transition NEW→PREPARING→READY, not auto-mark served or paid.

### P05 boundaries
- Order rounds and lines are immutable: refunds, edits, void and price adjustments are **not yet exposed**, due in P08/P10.
- Only internal waiter orders in P05. Guest QR/PIN and approvals come in P07, kitchen serves/alerts/history advanced in P06, payment and check locking P09.
- A visit containing a real order cannot yet be closed via P04 pilot closure; this is intentional until billing is delivered. Do not demonstrate a pretend payment.
- Outbox rows are durable and transactionally committed. Initial realtime is revision-SSE plus periodic refetch; a dedicated multi-channel event consumer/notification worker remains a later phase.
- Local drafts use already-installed `expo-secure-store` split across per-line keys; no new npm packages are required. Large/invalid drafts produce an explicit Save error rather than silent loss.

## Automated verification
- `pnpm typecheck`, `pnpm test`, `pnpm build:web`, Postgres migrations, P01–P05 API regressions and P06 integration (100 safe replay requests, one ticket, mandatory modifiers, stale prices, kitchen state conflicts, tenant isolation and closure guard).
- Browser/mobile visual QA is not performed by GitHub Actions; check 320–1280px, Dari/Pashto/English, mobile Expo Go and network retries locally.

## Phase 08 status
- On branch `phase-08-service-requests`, guest verified assistance and bill requests with 60-second dedup, waiter mobile active request processing, owner/manager request workspace and genuine cashier Payment Requested state are implemented.
- Full P08 acceptance script `phase8-ci.ts` exercises live PostgreSQL and guest PIN scope.
- Accepted order rounds remain immutable. Monetary changes, refunds and void authorizations belong to P10. No unsafe silent edits.
- Manual check required: phone/tablet layout, three languages RTL/LTR, older/expired guest session and service workflow.

## Phase 10 status
- **Merged to `main` via PR #10:** cashier correction requests, separate management approval, approved unprepared-round voids, discounts applied to unpaid unsplit checks, cashier-executed cash/manual transfer refunds after settlement, separate reversal ledger, shift reconciliation, and tenant-scoped audit. Assigned waiter mobile can request an entire unprepared round cancellation; kitchen preparation race is guarded.
- P10 CI integrates with the seeded disposable PostgreSQL backend after P09/P08. See `docs/PHASE-10-ACCEPTANCE.md` for manual browser, role and money-handling checks.
- All receipt and accepted order monetary snapshots remain immutable; no automated payment-provider refunds.

## Phase 11 status
- **Merged to main via PR #11** after passing full GitHub typecheck, unit test, web build, database migrations and P01–P11 live PostgreSQL regression suite.
- Management Reports at `/app/reports`: Sales, Items, Service and Audit. Settled check totals and posted net collected tender are separate financial timelines. Owner/manager can export sanitized, auditable CSV with strict tenant scope.
- Owner dashboard now includes real active tables, accepted orders, unpaid checks and today's net collected payment/refund totals; no fake statistics or placeholders.
- See `docs/PHASE-11-ACCEPTANCE.md`. Physical-device, browser and cash-handling pilot acceptance remain outstanding.

## Phase 12 status
- **Merged to main via PR #13**, after full GitHub CI passed on the feature branch, including TypeScript, unit tests, Next.js build, migrations and P01–P12 live PostgreSQL integration.
- Restaurant subscription and invoice surfaces at `/app/subscription`: owner manual proof submission, read-only management access, versioned plans, invoice snapshots and browser print/PDF; no automatic payment provider.
- Restaurant support at `/app/support`: tenant-scoped ticket conversations and owner-approved expiring/revocable, metadata-only grants.
- Platform admin at `/platform/overview`, `/platform/restaurants`, `/platform/subscriptions`, `/platform/support`, `/platform/audit`, `/platform/settings`: restaurant oversight, invoices, manually verified payments, plan versions, role-guarded support, auditable policies.
- Tenant server checks enforce staff/table plan limits, subscription trial/period/grace and suspended new-visit gating without disrupting closure of existing visits. No unverified payment counts as paid.
- See `docs/PHASE-12-ACCEPTANCE.md`. Physical devices, printed invoice layout, actual payment references and pilot acceptance remain pending.

## Phase 13 status
- **Merged to main via PR #14.** Two full feature-head GitHub Actions runs passed TypeScript checks, unit tests, Next.js build, migration/seed and P01–P13 PostgreSQL integration.
- HTTP security, no-cache responses, safe request IDs/structured timing logs, per-instance public entry throttles and production environment/TLS validation are implemented. Existing durable PIN and auth attempt protection is preserved.
- A PostgreSQL SKIP LOCKED outbox reconciler recovers stranded accepted order/kitchen events and advances the durable location revision; this is in-app polling recovery, not mobile push delivery.
- Platform-only operations health counts and backlog age appear on `/platform/overview`; web role shell has a keyboard skip link and localized offline indicator.
- Added an isolated PostgreSQL backup/restore rehearsal script and operator runbook. No new schema migration or package installation required.
- See `docs/PHASE-13-ACCEPTANCE.md`. **Manual gates are NOT certified:** 3-language full visual QA, physical Android/receipt validation, peak-load, production backup/media recovery and measured RPO/RTO, accessibility, and cash reconciliation.

## Next phase
P14 — supervised restaurant pilot; begin only after mandatory manual P13 release gates are signed off.

## Local commands
```powershell
cd C:\projects\restaurant
git pull --ff-only origin main
pnpm db:migrate
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
```
Ensure `apps/api/.env`, `apps/web/.env.local`, `apps/mobile/.env` exist and contain the required values, as documented in the example files.
