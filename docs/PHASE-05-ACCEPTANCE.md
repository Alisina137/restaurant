# Phase 05 — Waiter Ordering and Minimum Kitchen Receiver

**Governing requirements:** Product Specification P05, PG-03/05/06/07/08/09/11/28, F07/F08 baseline, BR-007–012, BR-014/015/021/022/029–032, AT-007 and AT-008 first ticket.

## Demo path (all actions real)
1. Owner creates/publishes a **Burger** category, **Burger** at AFN 380.00, and required **Size** choice (Small +0 / Large +25) in Menu. Kitchen user and waiter accounts both active. Owner creates tables, assigns a waiter; waiter seats guests at Table A2.
2. Waiter opens Tables → A2 → **Add Order**. Browse/search menu, tap Burger, choose required Size: Large, quantity 2, optional kitchen note, Add to Cart. Confirm estimate AFN 810.00 and zero unconfigured extra charges. The same cart/visit persists on device via Save Draft.
3. Press **Send to Kitchen** once. A real committed ACK displays order details; a timeout and safe duplicate retry with **same idempotency key** yields the same order/ticket. Changed request with reused key returns conflict.
4. Kitchen logs in and opens New: one ticket with table label, two burgers, Large choices and cooking note. Press **Start Preparing**, then Preparing → **Mark Ready**. Ready displays ticket; waiter Orders Ready reflects it on refresh. Second kitchen tablet with stale version receives 409 and refresh.
5. Waiter can add another round to the same visit; checkout snapshots remain immutable if a manager changes future menu price. Publishing/availability changes cause stale cart to be rejected. Attempt to finish a visit with orders returns **UNSETTLED_CHECK** until actual cashier settlement (P09).
6. Manager Orders Live/History lists real accepted rounds with details and kitchen state, no imaginary paid/served data.
7. Verify no cross-tenant access to orders/visit/tickets; kitchen cannot submit orders; waiter cannot set ticket statuses; waiter cannot order for an unassigned table.
8. Test phone at 320–420px, English LTR / Dari/Pashto RTL, background/foreground and network loss. Check draft retention and disabled submit during request.

## Automated acceptance
- Real PostgreSQL 16 migration, seed and API integration in GitHub Actions with earlier phase tests. P05 asserts 100 simultaneous idempotent retries, one DB round and one ticket; group minima and stale item versions; immutable line and price snapshot; valid kitchen ticket state transitions; waiter Ready queue; foreign-tenant denial; unsettled visit closure.
- Production and physical-device QA remain outside CI until performed.

## Not implemented
Guest QR/PIN and self-orders (P07), comprehensive kitchen operational history/notifications and mark-served (P06), cashier settlement and receipts (P09), order void/refund (P10). Do not expose actions that pretend those exist.
