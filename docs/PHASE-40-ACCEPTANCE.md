# DineFlow Phase 40 — Device Receipt Reconciliation and Lost-Response Recovery

**Goal:** A waiter who loses the API response after tapping **Send to kitchen** can determine whether the restaurant already accepted the ticket **without automatically sending a second POST**. This is a safe, manually initiated recovery improvement, not evidence that a physical phone or restaurant's network has passed a pilot.

## Delivered behavior

| Surface | What Phase 40 adds |
| --- | --- |
| Waiter/mobile Expo | When the encrypted local draft is marked uncertain, tapping **Check / retry this order** first performs a **read-only receipt check** using the *original* visit and idempotency key. If the server confirms an accepted round, the app clears the pending draft and opens that existing order **without any new POST**. |
| Confirmed absence | Only an authenticated **404 `NOT_FOUND` from that exact receipt route** permits the user's same action to POST the **original** unedited cart, note and key once. A concurrent original POST may still commit, but the server's unique-key and payload-hash invariants ensure replay doesn't create another ticket. |
| Server still uncertain | Network error, 401/403, 503, malformed response, or other unexpected errors leave the original encrypted draft and pending key intact. The mobile screen does not automatically create a replacement order. |
| Restaurant API | New authenticated, read-only `GET /api/orders/visits/:id/submissions/:key`, matching **tenant, location, original submitting actor, visit ID and idempotency key**. Returns only `{status:"accepted",roundId}`, with `Cache-Control: no-store`, or 404 `NOT_FOUND`. It doesn't check whether that table is *still* open or assigned to the same person: a previously accepted ticket must remain recoverable after a shift/table reassignment. |
| Mobile localization | Adds visible **Checking original order before any retry…** state in English, Dari and Pashto. Existing confirmations, exact-key idempotency and protected local draft remain unchanged. |

The waiter receipt endpoint does **not** let a kitchen account, unauthenticated guest, another restaurant, or another waiter/owner query someone else's ticket by guessing a key. A successful lookup only confirms server acceptance; it does not certify kitchen screen display, printer receipt, payment or delivery.

## Explicit recovery state transitions

1. **Normal submission:** Encrypted draft is saved and the original idempotency marker is committed **before** the first mutation. The existing API POST still validates visit assignment, available menu, options, prices and business rules and issues one durable order/ticket/outbox event.
2. **Lost API response:** Draft remains uncertain/locked. Do not edit quantities, notes, modifiers or the submission key.
3. **User taps check/retry:** Client performs the new read-only, scoped receipt lookup. A confirmed server order opens directly—**zero repeated POSTs**.
4. **Only real 404:** With the original key and unchanged payload, one POST is attempted. The server returns an existing accepted round or accepts it once if absent. The app only clears the pending draft once an actual server receipt is confirmed.
5. **Any other failure:** Keep pending, show a safe message and offer the same check again. A session that needs re-login should not delete pending order evidence. A malformed 200 is treated as uncertain, not proof of acceptance.
6. **After a table handoff:** The submission lookup still confirms the original submitter's accepted round, but the independent order detail screen may correctly deny current table access. A supervisor should verify any handoff and ensure that no physical kitchen/financial records were lost.

The lookup itself is not a durable reservation of absence; it is a snapshot. A first POST can finish concurrently after a 404. The existing unique idempotency constraint and transaction/table lock on the subsequent **same-key POST** remain the required at-most-once safeguards.

## Automated acceptance

- `pnpm phase40:verify` executes source safety contracts and **pure device reconciliation tests**: confirmed receipt never POSTs; verified 404 POSTs once; 401/403/503/network error or malformed receipt never submits; a failed replay does not silently retry.
- The full GitHub CI includes `pnpm typecheck`, `pnpm test`, the production web build, mobile integration suites, and all existing server suites.
- The existing **disposable localhost PostgreSQL** `apps/api/src/phase39-ci.ts` now checks the new HTTP route **before and after** a real held-row-lock / safe-replay scenario. It verifies anonymous 401, kitchen 403, foreign-restaurant 404, another restaurant employee 404, invalid key 400, initial absence 404, accepted receipt 200 with no-store and no key echo, and one accepted ticket/outbox despite replay. No production database is touched.

**No new npm dependencies or database migrations.** Restart API and Expo after pulling to apply the route and device changes.

## Manual restaurant acceptance remains required

Verify on real Android hardware with a real authenticated waiter, including a physical network drop just **after the API accepts** an order, a drop before acceptance, Wi-Fi switch/reconnect, Expo force-close and relaunch, late response with table reassignment, and a kitchen display actively observing first receipt. Collect recorded test timestamps, original ticket IDs (privately), outbox state, physical print/receipt results and cash settlement reconciliation. Two real tablets sharing a table must be tested before claiming multi-device readiness.

This phase does not supply automatic server push, background retries, external paging, multi-replica availability certification or the independent P33/P34 human GO/HOLD signoff. Avoid fabricating production measurements or interpreting a successful lookup as cashier/guest/device delivery.

**Next:** Phase 41 — reconcile real-world pilot observations against role navigation, financial operations and incident acceptance gates; remediate confirmed failures without removing audit or safety checks.
