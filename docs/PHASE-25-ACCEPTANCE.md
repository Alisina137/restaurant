# DineFlow Phase 25 — Mobile Order Builder & Kitchen Handoff

**Scope:** Expo waiter app; current assigned open visit only. This phase changes the native order-builder, meal modifier selection, device-local draft persistence, and duplicate-proof order submission. It reuses existing authoritative restaurant order and kitchen endpoints; it does not add database schema, npm packages, fake checkout or payments.

## Implemented

### Premium and operationally complete order builder
- Rebuilt `/visit/[id]/new-order` as a responsive, safe-area-aware, two-tab **Menu / Cart** workspace with stable header, assigned table identity, encrypted draft status, live menu refresh and last confirmed refresh time.
- Virtualized catalog with real published restaurant items, category chips, multilingual case-insensitive search, item photos, price, preparation/allergen/modifier detail, sold-out blocking and accessible large controls.
- Cart has editable complete per-dish configuration, optional cooking instructions, quantity +/- (1–99), confirmation before removal, line amounts, item counts, order notes (up to 500 characters) and prominent price estimate. Invalid item/line is visibly marked; unavailable amounts appear as **unknown**, never as misleading 0 AFN.
- Native modifier sheet protects selection counts (required min, max, single and multiple), disables oversubscription, shows choice counts, per-option price and correct prefilled editing. Invalid choices cannot be added. Multiple distinct items/options/notes remain separate; identical lines merge without exceeding quantity 99, and the cart contains no more than 40 distinct lines.
- All UI instructions, review confirmations, error and recovery messages are localized in English, Dari and Pashto, with RTL-friendly directional layout.

### Secure drafts and crash-safe ordering
- Former P05 encrypted per-line draft store is migrated to a **two-slot journal** in Expo SecureStore. Each write puts all encrypted lines into the inactive slot and commits a new head **only after all writes succeed**. Old committed slot remains valid on interruption. Saved drafts remain scoped to the account, tenant and active visit. A queue serializes writes so slow saves cannot overwrite a newer snapshot.
- Legacy P05 drafts are read as fallback, without modifying the original records in place. Per-entry SecureStore size remains bounded. Corrupt/oversized payloads fail validation, never silently send.
- Auto-save on edits and explicit Save Draft show saved/failure feedback. Moving between views or refreshing the menu never resets the working cart. On a new session the user sees restored cart state.
- Order submission requires a visible **Review/Confirm**, an active *assigned* visit and the current published catalog. Local preflight checks every item/version, quantity, sold-out state, attached modifier group/version, min/max selections, duplicate options and amount ceiling.
- The exact **idempotency key is persisted to encrypted storage immediately before the first POST**. A network timeout/crash after POST causes **submission uncertain**: the cart is read-only until the user retries the **same payload and key**. The server can confirm a previously committed ticket even if the visit closed or menu changed in the meantime. HTTP definitive 4xx responses clear the marker; unknown 5xx/timeouts retain it.
- A second click or rapid tap cannot send concurrently. A successful server response routes directly to the **existing real order detail/kitchen ticket**. The server enforces immutable round snapshots, optimistic catalog/visit checks, transactional ticket+activity+outbox, and idempotency replay. There is no client-side pretend success state.
- Guest QR/PIN, kitchen staff authorization, cashier settlement and reimbursement workflows remain governed by existing protected routes.

### Regression tests
- `pnpm mobile25:verify` runs **static operational contracts** and pure TypeScript tests for cart pricing, item stock/price changes, group counts, optional modifier payload shape, note limits, exact idempotency-key changes after edits, line/quantity limits, invalid draft rejection and three-language copy.
- Seeded disposable PostgreSQL **`phase25-ci.ts`** creates an assigned table and real catalog item, opens a real visit and checks invalid carts, stale versions, cross-tenant/role authorization, one committed ticket under concurrent same-key POSTs, edited-content idempotency conflicts, immutable price snapshots even after menu sold-out updates, real kitchen New→Preparing→Ready transition, and waiter delivery. The suite also protects cashier-only closure.
- CI retains previous Phase 1–24 TypeScript, unit tests, production web build, migrations and seeded PostgreSQL tests.

## Required manual acceptance (not automated)
1. In Expo Go on real phones, open the same assigned visit, add 4+ dishes and modifier groups; navigate between Menu/Cart, search/filter, edit notes and quantities. Check soft keyboard, safe areas, scrolling and accessibility focus.
2. Switch Dari/Pashto/English and verify form labels, item/option names, confirmations, number/currency display and RTL alignment.
3. Simulate lost internet during *draft save*, app restart and catalog update. Confirm older committed journal stays recoverable, new changes do not overwrite a complete draft when interrupted, and invalid/sold-out items are highlighted after reconnect.
4. Simulate a server accepting POST but dropping its response, or force-stop immediately after POST. Reopen and verify the submission-pending state locks edits and **replaying the same key** returns exactly one kitchen ticket.
5. Let manager update menu options/price or change waiter/close visit during cart editing. Verify submission is blocked or requires review, and duplicate order is never created.
6. On kitchen web and waiter mobile, confirm received New ticket, food preparation, readiness notification, and actual delivery/serving; check posted totals and verify no fake payment is shown.
7. Complete the supervised restaurant pilot from Phase 14 and independently validate actual Android hardware, QR scanners, production email, cashier receipt, backup and accessibility gates.

## Next phase
**Phase 26 — Mobile Notifications, Profile & Offline Resilience:** complete push-vs-poll semantics, role-safe notices, user security/profile, safe retries and device acceptance.
