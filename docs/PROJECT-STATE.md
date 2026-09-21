# Project state

Project: Restaurant Social (temporary)
Repository: Alisina137/restaurant
Delivery revision: SIDE-R1
Current phase: Side Phase — Adaptive Roles & Local Advantage
Status: implementation complete and locally verified; live-service and physical-device verification pending

Confirmed: subscription restaurant pages, daily posts, menus, customer accounts, feed/search/filter/detail, ordering with HesabPay, restaurant-owned delivery, responsive web first and mobile later, one complete phase per delivery, Neon default.

Defaults: one restaurant per cart; one pilot city; owner-set area fees; monthly manual subscription renewal; free customer accounts; email/password auth; photo/text posts; no live driver tracking; RTL-ready UI. Subscription price, brand, pilot location and services remain configurable/unconfirmed.

Implemented stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM, Neon serverless PostgreSQL, Better Auth, Sharp and a private S3-compatible media adapter. Dependencies are locked by npm. Versioned JSON routes and domain services preserve a path for later mobile clients.

Completed through the Side Phase: all Phase 1–4 capabilities plus non-disruptive restaurant profile revisions; role-aware personal, restaurant and admin workspaces; multi-restaurant switching; server-enforced contributor permission presets and custom permissions; permission-specific owner tools; real badge counts; responsive guest/customer/contributor/owner/admin navigation; Fresh Today offers with limited windows, special prices, atomic stock and one-time inventory restoration; open/busy/paused kitchen state; independent delivery/pickup switches; preparation estimates and meal sold-out controls; restaurant favorites; saved meals; private saved addresses; recent orders; and explicit Order Again repricing before confirmation. Low-data mode, AFN formatting, English/Dari/Pashto message catalogs and RTL shell behavior are included.

Verification: strict type check, lint and production build pass. Twenty-one integration/security tests pass across six suites, including permission isolation, Fresh Today stock races/restoration, admin separation and private customer data. Live Neon, SMTP and S3 checks, browser/device testing and deployment remain unperformed. See `docs/SIDE-PHASE-VERIFICATION.md`.

Next: merge the Side Phase pull request, pull `main`, run the migration command so `0003_fixed_wind_dancer.sql` is applied, restart the application and complete the role/ordering checklist in `docs/SIDE-PHASE-VERIFICATION.md`. Phase 5 adds HesabPay only after sandbox credentials and the intended merchant/settlement model are confirmed; it also adds subscriptions, verified callbacks, refunds and reconciliation.

Phase record: Side Phase → adaptive workspaces and navigation; contributor permissions; Fresh Today; kitchen/meal availability; favorites/saved meals/addresses; safe repriced reordering; admin views; low-data/i18n/RTL responsive polish; migration/tests/build/security verification. These are internal delivery records, not user task/part instructions.
