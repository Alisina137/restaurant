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

## Current phase dependency note (P09)
- P07 guest QR/PIN verification and review flows have been merged into `main` (PR #7).
- P08 assistance/order-correction phase has not yet been implemented. P09 Payment Requested is deliberately empty without real request data.
- P09 implementation and PostgreSQL acceptance checks are in `phase-09-cashier-checks-ledger` based on merged P07. See `docs/PHASE-09-ACCEPTANCE.md` for scope, checkout/receipt verification, and known limitations.
- P09 is not production-certified; manual real-browser, mobile and receipt printer QA are outstanding even when CI succeeds.

## Next phase
P08 service requests and P10 refund/void approval after P07/P09 dependency integration.

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
