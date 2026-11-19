# DineFlow Phase 39 — Ambiguous Order Commit Recovery and Busy-Table Resilience

**Purpose:** An accepted waiter/guest order must not turn into two tickets when the request times out, the database is busy, or the network loses the response. Phase 39 makes the original-key recovery contract explicit and bounds transaction lock waiting.

## What changes

| Surface | Behavior |
| --- | --- |
| Waiter order POST `/api/orders/visits/:id/rounds` | Holds the original tenant/table lock, but sets PostgreSQL **transaction-local** `lock_timeout=8000ms` before attempting to acquire it. Lock contention does not hold an HTTP request indefinitely. |
| Guest order POST `/api/guest/orders` | Uses the same bounded local lock wait for the direct-to-kitchen or waiter-reviewed guest submission transaction. The existing `GET /api/guest/orders/by-key/:key` remains the guest recovery lookup. |
| Known transient database/transport failures | On the two **idempotency-keyed order creation routes only**, returns HTTP **503**, `Retry-After: 3`, `Cache-Control: no-store`, and a safe body: `{code:"ORDER_STATUS_UNCERTAIN",statusUncertain:true,retrySameKey:true,message:"..."}`. Never exposes SQL, credentials, checkout contents, a key or an identifier. |
| Waiter mobile Expo app | Preserves the encrypted draft and pending marker, leaves the uncertain cart locked for editing, and shows localized English/Dari/Pashto guidance: **Check/retry this same order using the original key; do not create a new order.** |
| Existing other routes | Authorization errors, validation failures, stale versions, payment operations, kitchen transitions, PIN attempts and menu writes do **not** gain an automatic retry hint. The service never automatically repeats a business mutation. |

### Why the response is conservative

A driver error on a locked row normally rolls back the transaction, but a dropped connection can also occur **after the database committed** and before the device learned the result. Clients must not assume 503 means "the order did not happen." The same submitted `idempotencyKey`, exact lines, note, quantities and options are used to recheck/replay the original request. DineFlow first searches for a previously committed order by authorized tenant/actor and key and returns the existing ticket if found; if none was committed, the original key may safely create that one order when the lock is available. A changed cart with the same key remains a conflict (409).

For guest submissions, use the existing guest-by-key status lookup after a lost response. Do not create a fresh guest session or key to "unstick" an uncertain submission.

**Important:** The 8-second limit is **only on lock waiting within the two order-creation transactions**, not a blanket transaction timeout or a promise that any HTTP request finishes within eight seconds. PostgreSQL request CPU, network delays, socket writes and post-commit readback can take longer. DineFlow deliberately does not bypass row locks or downgrade consistency.

### Operational diagnosis and incident policy

The Phase 35–36 platform monitor may show elevated p95/503 counts, but its samples are process-local and never prove hardware delivery, restaurant-wide SLA, or a passed pilot. Investigate persistent contention with authorized PostgreSQL lock diagnostics (e.g., `pg_stat_activity` on staging), correlate sanitized `kind:"order_commit_uncertain"` logs and per-request IDs, review connection pool waiting and live kitchen cards, and record any P0/P1 incident. Logs do not include raw exceptions, order IDs or tenant secrets.

Operators must not delete an accepted order, force-write outbox acknowledgements, change a payment ledger, or restart a tablet into a new sale to get a green metric. The correct recovery is to verify the original ticket, reconcile kitchen receipt and cashier totals, and escalate unresolved ambiguity.

### Automated acceptance

- `pnpm phase39:verify`: server route scoping, PostgreSQL timeout, no logging of SQL/credentials, safe response headers, encrypted mobile same-key behavior and three localized messages.
- `pnpm test`: nested `cause` and cyclic exception classification; rejects arbitrary failures, GET requests and finance/menu/kitchen routes; ensures only authorized idempotent order POSTs receive retry advice.
- `pnpm --filter @dineflow/api exec tsx src/phase39-ci.ts`: dedicated real PostgreSQL + Express HTTP lock contention test. **Runs only when `CI=true` on localhost and the disposable `dineflow_ci` database**, after previous dependent phases in the existing CI workflow. It creates a separate table/visit/menu meal, starts a transaction holding `FOR UPDATE` on that table, triggers an actual 8-second waiter lock timeout, checks HTTP 503/Retry-After/uncertain body/no secret leak, releases the lock and replays the **exact** payload/key. Asserts exactly one accepted round, one ticket, one outbox event, unchanged cart conflict handling, and tenant isolation. It rolls back its held test lock.
- Existing CI still runs typecheck, unit tests, production web build, Phase 34 operational smoke, previous P01–P38 seeded integration suites, and the P31 20-table/200-ticket synthetic rehearsal. No real device/network/cash is simulated.

No new dependency, API migration, or database schema change. A previously applied Phase 36 index migration remains necessary.

### Human pilot evidence still required

Physical Wi-Fi loss/reconnect during waiter POST, guest scanning/order reuse after a network loss, Android app relaunch while an order is pending, kitchen screen observation, actual payment/receipt reconciliation, multiple simultaneous real tablets and staff behavior, and supervised recovery drills remain unverified. Real p95/99, actual production load and independent GO/HOLD cannot be certified by the CI lock experiment.

**Next phase:** Phase 40 — close measured device/network error paths and recovery gaps identified during actual supervised rehearsal, without weakening idempotency, tenant boundaries, or financial/audit controls.
