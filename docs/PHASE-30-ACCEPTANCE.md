# DineFlow Phase 30 — Kitchen Display Visibility & Pilot Measurement

## Outcome
Collect **real client-reported evidence** of when an accepted order first reaches a foreground kitchen display, distinguish it from kitchen preparation time, and expose sample coverage/measurement gaps before a supervised physical restaurant pilot. No customer identity, payment information, invented device test, or SLA certification is involved.

## Role → screen → data → acceptance
| Role | Existing route | Feature | Source of truth |
| --- | --- | --- | --- |
| Owner/manager/kitchen | Kitchen Live / Preparing / Ready | First-render observation, automatic when the board successfully paints a 10-ticket (max) page and the browser is foreground | Protected POST `/api/orders/kitchen/display-observed` and DB `kitchen_tickets.first_displayed_at` |
| Owner/manager/kitchen | Kitchen service pulse on the same tabs | Accepted vs first-render-observed count, median/p95 seconds for observed tickets, active with no recorded render, manual refresh, 1/3/6-hour windows | Protected GET `/api/orders/kitchen/visibility?minutes=60|180|360` |
| Waiter/cashier/anonymous/other restaurant | No new route | Denied/isolated | Server tenant/location/role guards |

## Implementation details
1. **Receipt semantics:** A client sends up to 10 validated ticket UUIDs only **after** a successful, immutable-detail-validated kitchen page render. The code waits for two animation frames, does not send when the document is hidden or the page is stale/loading/history, and does not include guest, payer, kitchen operator, or device identifiers. Acknowledgment is a *technical observation*, **not evidence a human saw the food**, and does not replace separate kitchen/waiver/serving acknowledgments. Some cards below the viewport may be in the DOM without being looked at.
2. **Safe retry:** `POST /api/orders/kitchen/display-observed` is scoped to the caller's restaurant, location and owner/manager/kitchen role. Only active ticket states can record `first_displayed_at`; a database-atomic `UPDATE ... WHERE first_displayed_at IS NULL` and database clock make concurrent/repeated reports harmless. No kitchen ticket version, event outbox, financial totals, or waiter assignment changes. Unknown/cross-tenant ids are ignored without disclosing identity. Input cap and UUID validation reject malformed/oversized requests. Unlike an ambiguous food status mutation, technical telemetry can be retried; web UI shows an error if reporting fails.
3. **Visibility analytics:** Counts accepted tickets created within the chosen 60/180/360-minute window, how many have an actual first KDS render report, median/p95 **seconds from acceptance to first report** only for measured tickets, and current active tickets without a report across all ages. There is never an interpolated/assumed receipt for missing samples. Zero samples yield `null`, not 0 seconds; API timestamps and measurements are DB-backed, with `Cache-Control:no-store`. The initial migration leaves preexisting tickets unreported: missing can mean **legacy data, no display, network error, hidden tab, or rendering failure**, not proof staff ignored an order.
4. **UI:** The existing kitchen Service Pulse now has a clearly separate, premium responsive **Kitchen Display Visibility** panel. It uses the same 1/3/6-hour selector and has 3 quantitative cards, explicit methodology, localized English/Dari/Pashto labels, safe empty/error/retry state and account/location-specific data. The UI distinguishes preparation minutes from render seconds, and gives no green production-service certification. P27–29 kitchen actions and role-based web navigation remain unchanged.
5. **Persistence:** Additive `0015_phase30_kitchen_display_observed.sql`, NULL-by-default timestamp and partial scoped indexes for observed historical samples and active missing reports. Existing tickets deliberately stay NULL.
6. **No alerting claim:** The observed render p95 is a diagnostic metric from in-app KDS clients; it does not yet validate the spec's 3-second healthy-network order-to-visible-in-kitchen target. KDS is not monitoring any closed background tab, power-off tablet, browser not running, printing hardware, or human reaction. It does not create real mobile push notifications.

## Automated acceptance
- `pnpm kitchen30:verify`: P30 source/API/UI contract, payload validation and filters, legitimate queue item selection, no invented null sample, locale coverage.
- `pnpm --filter @dineflow/api exec tsx src/phase30-ci.ts` on disposable PostgreSQL: real table/menu/visit/order, no fake receipt from GET, 6 concurrent observation requests with exactly one persisted first receipt, duplicate and malformed/over-limit rejection, denial to waiter/cashier/anonymous, other-tenant no-op, 10-ticket page batching, actual median/p95 sample and active-unobserved counts, no ticket status/version/outbox/revision mutation.
- Full prior CI, TypeScript, unit tests, Next.js production build, additive migrations, and all live database test suites must pass before merging.

## Remaining physical pilot checklist (must NOT be called passed by CI)
1. Attach network/devtools timing and a KDS page screenshot on a real target tablet for each of 3 languages at 320–1440px, orientations and standard/large mode. Confirm no receipt is sent for a hidden tab, failed cards/authorization, or stale data.
2. Record three independent timestamps with real test equipment: submitted order server acceptance, foreground browser render report, human confirmation food was noticed. Compare the healthy-network visibility **p95 ≤ 3 seconds** target only for the actual tested population and record sample coverage/dropouts. Do not extrapolate the in-app observed-only percentile to missing reports or to production performance.
3. Test 20 tables/10 clients/200 tickets using approved disposable test fixtures in staging, not live tables or real money; inspect missing observations, outbox health, API/read p95 and latency under 4G/high packet loss.
4. Verify two unrelated restaurants cannot read/insert one another's receipts, and refresh/reconnect does not duplicate kitchen workflow actions, waiter pickup, or payments.
5. Complete the outstanding supervised P14 full service shift, receipt/QR/printer hardware check, backup restore and independent owner/platform release sign-off. This phase is **not** evidence that any physical test occurred.

## Next
Use these actual operational visibility findings and supervised pilot observations to prioritize Phase 31; do not fabricate end-to-end SLA certification or a restaurant sign-off.
