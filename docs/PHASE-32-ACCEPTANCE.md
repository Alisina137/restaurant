# DineFlow Phase 32 — Live Pilot Operations Readiness Cockpit

## Outcome
Make the existing restaurant-owner and manager **Supervised Pilot & Release Gates** page more useful *during a real supervised shift* by showing actual scoped operational state alongside the twelve manual gate attestations. Do **not** infer human pilot success, an SLA, sound delivery, drawer/receipt reconciliation, or production certification from automated counts.

## Delivered role → screen → action → data
| Actor | Route | Action | Source |
|---|---|---|---|
| Restaurant owner / manager | `/app/pilot` | Inspect independently updating **Live Operating Snapshot** cards and investigate overdue internal publication / unreported KDS first renders | Protected `GET /api/pilot/operations?minutes=60\|180\|360` |
| Owner | Existing pilot gate form | Record observed physical test evidence *manually*, separately from computed metrics | Existing append-only `POST /api/pilot/gates` with stale-signature invalidation |
| Platform operator | `/platform/pilots/:id` | Independently review manual evidence; **no access to restaurant operational metrics via this endpoint** | Existing audited platform sign-off model |
| Waiter / kitchen / cashier / unrelated restaurant | No new access | Can't access another restaurant's pilot operating pulse | Session + active membership + owner/manager validation |

### Database-backed operational indicators
- **Windowed, with 60/180/360-minute selector:** number of accepted kitchen tickets and those with an actual first foreground browser render report. Missing report does not prove food was unseen; denominator includes unreported tickets, so report coverage isn't exaggerated.
- **Current open:** active kitchen tickets (new/preparing/ready/picked-up), active without browser report, kitchen handoffs pending waiter confirmation, open visits, open checks and open cashier shifts.
- **Operational setup:** enabled dining tables and published, unarchived menu items.
- **Internal outbox:** rows awaiting internal revision publication, oldest pending timestamp and elapsed seconds. **Outbox `delivered_at` does not mean an Android phone or kitchen device received or saw the order.** Investigative attention can be highlighted for nonzero unreported tickets, pending pickup confirmations and internal outbox entries older than 60 seconds, but these do **not** automatically fail any pilot gate.
- Each response includes server checkedAt, interval start, precise evidence `tenant_scoped_database_snapshot`, and **`pilotCertified:false`**. Queries are scoped to the authenticated selected tenant and its single location. They do not expose names, guests, payments, raw cashier amounts, PINs or credentials.

### Premium owner/manager interface
Read-only responsive 4→3→2 card grid, clear verified timestamp, 1/3/6-hour selectable window, independent 30-second foreground polling, touch targets and accessible labels, loading/error/retry state that clears stale results, and dedicated *investigation* strips instead of invented "healthy" signoff. English, Dari RTL and Pashto RTL, stable main Pilot Review sidebar, no change to existing 12 operational checklist gates, evidence editing or signature logic. The platform review screen is intentionally unchanged.

### Verification
`pnpm pilot32:verify` runs source contracts and pure validation tests: no fabricated certification, bounded positive metrics, consistency between observed and accepted, 3-locale labels, and fallback/retry code.

`pnpm --filter @dineflow/api exec tsx src/phase32-ci.ts` runs against a disposable PostgreSQL database after seed and prior phases: role-denial, cross-restaurant isolation, malformed filter rejection, no-store responses, real table/menu/visit creation and one accepted ticket; accepted/observed and missing-report counters change only when the genuine kitchen observation endpoint receives a first-render receipt. The request never signs or alters the twelve pilot gates.

The full CI workflow also checks all previous phases, typechecks all packages, runs unit/integration tests, production web build, migrations and Phase 31 disposable rush test.

### Physical operator acceptance — NOT performed by CI
1. Restaurant owner/manager open `/app/pilot` on actual hardware and verify against service tickets, cashier screen, live tables and physical drawer; 320–1440px, keyboard, Dari/Pashto RTL and English.
2. Disconnect kitchen/restaurant Wi-Fi during a controlled test; confirm visible error and no false "healthy" state; compare internal outbox signals and browser-render telemetry with independent instrumented timestamps.
3. Run 20-table/10-actual-client/200-ticket **physical** device and packet-loss drill, collect independent network p95 with complete population coverage, not synthetic workers.
4. Validate fiscal receipt printout, settled money vs drawer and refunds with independent reviewer, QR/PIN and waiter/guest workflows on real devices.
5. Verify Postgres + media restore, response pager, staged migration/rollback, complete supervised shift, evidence and independent platform review. A green metric or CI never auto-PASSes a physical gate.

## Migration / compatibility
No schema migration in Phase 32. Existing API routes, kitchen reliability and financial ledger remain unchanged. Pull from main; use your existing `pnpm dev:api` and `pnpm dev:web` commands to run.

## Next
Phase 33 should prioritize observed physical restaurant defects and an externally operated release rehearsal, not fabricated production approval.
