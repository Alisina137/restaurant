# DineFlow Phase 38 — Repeated-Meal Checkout, Modifier Editor and Transactional Reliability

**Scope:** Improve actual restaurant checkout and menu-administration hot paths by reducing avoidable database calls while preserving the durable order/financial guarantees developed in Phases 1–37. This is a source-level, CI-tested improvement, **not** a claimed production speedup, customer service-level certification or supervised pilot GO.

## What shipped

| Real workflow | Previously | Phase 38 | Preserved guarantees |
| --- | --- | --- | --- |
| Waiter cart, guest QR cart with repeated dishes | For each of up to 40 lines, repeat the PostgreSQL meal row lock, meal SELECT, modifier-group lock, group SELECT and option SELECT, even when 20 lines reference the same meal/group | **Transaction-local locked snapshots**: each distinct meal and modifier group is locked/read once per checkout, then reused for other lines in that same transaction. Every line still independently checks the submitted item and group versions, selected option IDs, active flags, quantity, note and total. | Existing per-visit/table serialization, tenant/location checks, lock lifetime, availability, meal category visibility, item-to-group linkage checks, modifiers, immutable line snapshots, amount limits, idempotency, outbox and financial ledger. |
| Restaurant manager creates a modifier group | Group INSERT plus **one sequential INSERT per option** (1–30) | Group INSERT plus **one multi-row option INSERT** in the same DB transaction. | Published revision, validation of selection limits, option names/prices and transactional rollback. |
| Restaurant manager edits a modifier group | Sequential inactive-option updates and new-option INSERTs | **One scoped UPDATE to deactivate omitted historical options** and one bounded INSERT for new options. Existing option field edits retain version-checked individual UPDATEs. | Optimistic version check, historical option retention, no cross-group edit, per-option active flag, catalog audit/revision and rollback. |

### Reliability boundaries

The optimization **does not create a global cache**. Cache entries are created inside `priceLines()` for one transaction and discarded before returning. **PostgreSQL `FOR SHARE` row locks are still acquired before an item or modifier group enters that cache**. Writers changing menu items or modifier groups must obtain conflicting row locks; they cannot commit changes to those locked rows until the checkout ends. Every line is revalidated against its own submitted item/group version and option selection, even when metadata is reused. Unlocked category availability and attached item-group links are deliberately re-read per line so those checks do not silently become stale.

Restaurant-scoped lookup includes both `tenantId` and `locationId`. Modifiers are cached by group UUID only **within the same authorized tenant/location transaction**; option IDs not in the group's authorized list or options marked inactive remain invalid.

A 40-line cart made entirely of a shared dish/group now avoids **39 repeated item locks, 39 item SELECTs, 39 group locks, 39 group SELECTs and 39 option SELECTs** (relative to the old per-line code). These are source-level query counts for this specific shape; they **do not** represent a measured production p95, throughput, or low-network benefit. The existing per-line category and group attachment checks remain intact.

### Security, financial invariants and compatibility

No role, feature flag, schema, endpoint, response JSON, UI navigation, session, payment, guest PIN or kitchen status interface changes. Both waiter orders and approved guest QR orders still pass through shared server-side authoritative `priceLines()`. Order amounts are computed per line from *the selected current options*; caching never copies the first line's quantity/note/options into the second. Server-side order idempotency keys, table locks, transaction commits and outbox writes remain unchanged.

Menu changes remain within one transaction with an optimistic group version check. Omitted modifier options stay in the database as inactive for historical order snapshots, rather than being deleted.

### Automated acceptance

- `pnpm phase38:verify`: verifies transaction-scoped locked cache construction; both waiter and guest flows use the same pricing path; per-line validation remains; modifier creations/edits are batched without dropping optimistic version/audit protection.
- `pnpm --filter @dineflow/api exec tsx src/phase38-ci.ts`: **separate disposable CI-only PostgreSQL integration** (executed after fixture-dependent P05/P06 tests via `pnpm menu:stability:verify`) creates its own restaurant table and visit, submits **40 repeated-item lines** through the actual waiter HTTP API, alternates selected modifiers/quantities/notes, validates totals and kitchen cards, checks one accepted ticket/outbox event, retries idempotently, and rejects an invalid final line without a partial commit.
- `pnpm --filter @dineflow/api exec tsx src/phase3-ci.ts`: extended actual seeded integration creates **30 modifier options at once** and edits the group retaining ten, adding two and deactivating 20 while preserving all 32 historical database records; stale group version rejected.
- CI runs the standalone P38 checkout **after** P05/P06 to preserve their two-round fixture, in addition to P03, every earlier regression, TypeScript, production Next build, Phase 34 smoke and disposable Phase 31 simulated 20-table/200-order rehearsal.

**Database migration:** None for Phase 38. Existing Phase 36 migration `0017` must have been applied already. **Dependencies:** None. Re-pull then restart the API and web servers to use the new code.

### Manual staging evidence still needed

Rehearse long repeated-dish carts (1/10/20/40 lines), multiple modifier groups, unavailable meals and stale versions on the first/last line, simultaneous manager price updates and checkout attempts, and guest reviewed orders. Capture wall-clock round trips, DB statement counts and real p95/p99 against the same staging dataset. Test physical waiter Android, customer QR and kitchen receipt devices under real Wi-Fi loss. Independently reconcile cash, receipts, refunds, P0/P1 incident closures, backup restoration and pilot GO/HOLD authorization. Passing CI does not waive these controls.

**Next:** Phase 39 — prioritize remaining bottlenecks and real-world failure handling identified by measured staging/device traces without relaxing security, financial or tenant invariants.
