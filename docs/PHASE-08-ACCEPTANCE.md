# Phase 08 — Guest Assistance & Service Recovery

**Specification:** `docs/PRODUCT-SPECIFICATION-v1.md`, P08, F09–F10, PG-03/05/08/20/28, BR-009/013/018/021/028/035, AT-009/010.

## Working vertical slices

- **Guest /g/:visit/help**: two functional cards *Call Waiter* and *Request Bill*. Assistance reasons Need help / Water / Cutlery / Other; optional note ≤200. Bill preference Together / Split. Each request is scoped to an active PIN-authenticated visit; status and history load directly from PostgreSQL. Guest sees Pending → Acknowledged → Resolved. A network retry reuses its key. Database and transaction prevent duplicate outstanding reasons; 60-second retry throttle after resolution. No fictitious push notification or payment button.
- **Waiter Expo**: Home *Needs Attention* counter, table details Requests section, functional /requests inbox with status and table filtering, ACK / Resolve, assigned-visit authorization, active/resolved history, polling/resume. Kitchen does not see staff service requests.
- **Owner/manager web /app/service**: responsive guest request queue and order-correction inbox with true counts, filters, pagination, reason text, ACK/Resolve and version-aware decisions. Service SSE revision events/poll fallback retain stable nav.
- **Cashier /cashier/checks**: real bill requests appear in *Payment Requested* (also for tables with zero check amount); bills do not lock ordering. Resolving request clears the cashier attention filter. Cashier can read bill requests but cannot ACK/Resolve.
- **Waiter order correction**: explicit Request Item Cancellation on unready line; reason required (8–250 chars); safe retry ID; manager reviews, approves/rejects with reason. Server serializes table and kitchen ticket locks, rejects ready/served/locked checks, preserves accepted order round/line money snapshots, marks cancelled item separately, creates immutable negative adjustment, updates event cursor and bill/guest totals only after approval. Kitchen never treats cancelled food as served and settlement ignores cancelled tickets.
- **Late round**: additional waiter or guest order remains on *same active visit* and changes pre-lock bill amount. A bill request alone never freezes orders.
- **Settlement guard**: pending guest approvals **and** charge-affecting correction requests require resolution before checkout; corrections forbidden once payment split/lock begins.

## Data/API

- Additive migration `0009_phase8_service_recovery.sql` with `service_requests`, `service_revisions`, `order_change_requests` and database uniqueness/ownership indices.
- `GET/POST /api/guest/service`, `GET /api/service/requests`, `GET /api/service/requests/count`, `POST /api/service/requests/:id/ack|resolve`, `GET /api/service/events`, `GET/POST /api/service/changes`, `POST /api/service/changes/:id/decision`.
- Server tenant/location/visit and role checks on reads and mutations, no client-supplied tenant scopes, stale-version conflicts, no destructive deletion, audit trail and dedup/retry controls.

## Verification

CI: `pnpm typecheck`, `pnpm test`, `pnpm build:web`, disposable PostgreSQL migration/seed and all previous phases' live integrations. P08's `apps/api/src/phase8-ci.ts` checks live guest PIN verification, dedup/retry/rate-limits, caller identity and cross-tenant isolation, waiter ACK/resolve, cashier Bill Requested, late round, manager-only cancellation, ticket status and financial deltas, unsafe prepped food rejection, immutable history and guest totals.

**Manual QA remaining before production:** Guest phone (320px, 390px), waiter physical Expo Go, owner/manager responsive desktop, all three locale/RTL flows, spotty network and foreground/reconnect, large request queues and paper receipt under a correction.

## Deliberately not in P08

- Not an online payment processor, staff SMS/FCM push, guest private profile/history, advanced discount/refund/reversal operations (P10).
- A correction only cancels a *complete unready line*, not an already-prepared line or partial quantity. This avoids silently repricing a partly served kitchen item.
- Authorized manager can deny a request with mandatory reason; no unauthorized waiter-cancel shortcut.

## Local deployment

```powershell
cd C:\projects\restaurant
git switch main
git pull --ff-only origin main
pnpm db:migrate
# Start dev:api, dev:web and dev:mobile in separate terminals.
```
