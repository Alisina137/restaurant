# DineFlow Phase 37 — Kitchen Query Efficiency and Atomic Multi-line Orders

## Goal

Reduce avoidable SQL round-trips in two verified hot workflows (accepted waiter/guest carts and kitchen queue card polling), without changing authorization, idempotency, menu price checks, customer/guest data protections, financial ledger semantics, or the server-side pagination contract. This is a **source-level, testable reduction in SQL statements**, not a claim of measured real-restaurant speedup or commercial SLA.

## Changed production workflows

| Workflow | Before | Phase 37 | Invariants |
| --- | --- | --- | --- |
| Waiter submits a cart (1–40 priced lines) | Sequential `INSERT INTO order_lines` for every line, inside acceptance transaction | **One batched INSERT** using ordered, fully priced line snapshots | The existing visit/table locks, authority checks, unique idempotency key, price/modifier validation, per-line notes, indexes, and accepted outbox event stay inside the same transaction. |
| Guest QR cart is approved | Sequential line inserts after staff acceptance | **One batched INSERT** for the approved guest cart | Same pending/approved transitions, PIN/session revalidation, tenant scope, total comparison, audit and outbox; no permission changes. |
| Kitchen `/api/orders/kitchen/cards` | Re-run expensive scope/session resolution after paginated queue lookup; query ticket metadata again even though the queue already joins tickets | **Reuse one verified scope**, project ticket version and pickup acknowledgement directly from the paginated queue; fetch only the selected 10-or-fewer rounds' immutable lines | Kitchen/owner/manager only; cross-tenant denial, no staff/guest/payment data in cards; stale write versions remain checked by the transition routes. |
| Kitchen/manager paginated queue and exact row count | Always join `dining_visits` though only waiters require a waiter-assignment predicate | **Join visits only for the waiter `/api/orders/my`** | `/my` still requires the active waiter assignment; management/kitchen remain constrained by authenticated tenant/location, ticket status, server-side filtering, exact count and 10-row pages. |

These changes leave the data model intact. No schema migration or extra dependency was added in Phase 37 (Phase 36 migration 0017 must already be applied).

### Why this was selected

Review of the existing request code identified two explicit round-trip multipliers:

- A 5-line order previously issued **five serial line-insertion statements**. Phase 37 issues **one**. The pricing logic still checks every line independently, and actual latency varies with database/network load.
- Kitchen card polling previously performed an independent scope lookup and a second ticket query in addition to the bounded line snapshots. Those duplicate reads have been removed. The remaining queries are still tenant-scoped and filter **before** pagination.

The previous Phase 36 rolling p50/p95 performance display should be used for real observed route timings; CI tests and this source audit cannot prove a numerical reduction in production latency.

## API, navigation, UI and role compatibility

No navigation, sidebar, mobile QR, kitchen card visual structure, response shape or copy was removed. The `/kitchen/cards` response still provides ticket ID/version, acknowledgement timestamp, order note, total, status, item quantities, allergen/modifier snapshots, cooking status and `Server-Timing: kitchen-db;dur=...`. The existing kitchen display, waiter acceptance, owner/manager oversight, and guest ordering clients remain compatible. The server continues to return an exact total, a 10-item page, tenant/location scope and no-cache/no-store policy.

A read-only kitchen card never changes a ticket's revision. Concurrent write actions remain protected by version checking, payment lockouts and durable outbox sequencing.

## Verification and test plan

Run from project root:

```powershell
pnpm phase37:verify
pnpm typecheck
pnpm test
pnpm build:web
```

The extended **real seeded PostgreSQL integration** `apps/api/src/phase29-ci.ts` now accepts a five-line waiter cart through the HTTP API and checks all five ordered quantities/notes, immutable kitchen card snapshots, total, idempotent POST replay without a duplicate ticket, unrelated-tenant denial, kitchen-only access, transitions, waiter pickup acknowledgement and updated card data. The existing P29 integration remains in GitHub CI, followed by P31's 20-table / 10 synthetic HTTP worker / 200-ticket rehearsal and all phase tests.

`pnpm phase37:verify` verifies by source contracts: line insert batching in **both** waiter and guest paths, exactly one authorized kitchen scope reuse, no redundant ticket follow-up query, bounded line IN lookup, conditional waiter join for **both** list and count, preserved tenant/location guards and price/receipt protection.

### Real-world performance evidence not yet collected

On staging, operators should compare authenticated **same-size** kitchen `Server-Timing`/route p50-p95 before and after, across varied table counts and realistic concurrent kitchen/waiter sessions, with time-series PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` using authorized non-sensitive data. Include order submit with 1/5/20/40 distinct lines, deduplicated repeated meals, guest approval, waiter assignment isolation, kitchen display refresh, genuine packet loss and device rendering. Record exact dataset sizes, connection counts, region, sample population and repeat trials; avoid interpreting CI synthetic HTTP workers as physical phones.

Do not claim actual sustained production throughput, guaranteed order-delivery latency, receipt/finance integrity from this optimization alone. Pending P0/P1 incident signoffs, restored backups, independent financial reconciliation and human GO/HOLD remain mandatory.

## Next

Phase 38 may address the next bottleneck **only after** collecting staging query plans and measured device/network traces; do not blindly raise connection pools or relax authorization/payment invariants.
