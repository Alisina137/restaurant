# Project state

Project: Restaurant Social (temporary)
Repository: Alisina137/restaurant
Delivery revision: P04-R1
Current phase: 4 — Menus and Ordering
Status: implementation complete and locally verified; live-service and physical-device verification pending

Confirmed: subscription restaurant pages, daily posts, menus, customer accounts, feed/search/filter/detail, ordering with HesabPay, restaurant-owned delivery, responsive web first and mobile later, one complete phase per delivery, Neon default.

Defaults: one restaurant per cart; one pilot city; owner-set area fees; monthly manual subscription renewal; free customer accounts; email/password auth; photo/text posts; no live driver tracking; RTL-ready UI. Subscription price, brand, pilot location and services remain configurable/unconfirmed.

Implemented stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM, Neon serverless PostgreSQL, Better Auth, Sharp and a private S3-compatible media adapter. Dependencies are locked by npm. Versioned JSON routes and domain services preserve a path for later mobile clients.

Completed through Phase 4: all Phase 1–3 capabilities plus non-disruptive restaurant profile revisions; published details/photos remain live until a proposed revision is approved; category, meal, variant and extra management; meal images, search and post links; restaurant delivery zones/fees/minimums/ETAs; ordering availability control; one-restaurant carts; expiring server-priced quotes; immutable item/address/price order snapshots; idempotent order creation; customer order history and pre-acceptance cancellation; owner order queue; delivery and pickup state machines; responsive menu, cart, checkout and kitchen interfaces; versioned migration and integration tests.

Verification: strict type check, lint and production build pass. Eighteen integration/security tests pass across five suites. No high or critical dependency advisory remains; four moderate advisories are inherited by development-only Drizzle migration tooling. Live Neon, SMTP and S3 checks, browser/device testing and deployment remain unperformed. See `docs/PHASE-4-VERIFICATION.md`.

Next: pull Phase 4, run migration `0002_eager_scarecrow.sql`, restart the application and complete the owner-to-customer acceptance checklist in `docs/PHASE-4-VERIFICATION.md`. Phase 5 adds HesabPay only after sandbox credentials and the intended merchant/settlement model are confirmed; it also adds subscriptions, verified callbacks, refunds and reconciliation.

Phase record: Phase 4 → safe profile revisions; catalog and meal media; delivery configuration; pricing/quote/order services; customer cart/checkout/history; owner fulfillment; meal discovery/post links; responsive styling; migration/tests/build/security verification. These are internal delivery records, not user task/part instructions.
