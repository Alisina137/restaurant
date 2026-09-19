# Project state

Project: Restaurant Social (temporary)
Repository: Alisina137/restaurant
Delivery revision: P02-R1
Current phase: 2 — Foundation, Accounts and Restaurant Pages
Status: implementation complete and locally verified; live-service verification pending

Confirmed: subscription restaurant pages, daily posts, menus, customer accounts, feed/search/filter/detail, ordering with HesabPay, restaurant-owned delivery, responsive web first and mobile later, one complete phase per delivery, Neon default.

Defaults: one restaurant per cart; one pilot city; owner-set area fees; monthly manual subscription renewal; free customer accounts; email/password auth proposal; photo/text posts; no live driver tracking; RTL-ready UI. Subscription price, brand, pilot location and services remain configurable/unconfirmed.

Implemented stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM, Neon serverless PostgreSQL, Better Auth, Sharp and a private S3-compatible media adapter. Dependencies are locked by npm. Versioned JSON routes and domain services preserve a path for later mobile clients.

Completed: Phase 1 planning; responsive application shell; email/password signup and sessions; verification and recovery email workflows; database-backed rate limits; restaurant creation/editing; opening hours; staff membership; private photo adapter; owner workspace; admin approval/change request/suspension; audit events; public approved profiles; public restaurant JSON APIs; locale/RTL foundation; migration, scripts and tests.

Verification: strict type check, lint and production build pass. Twelve integration/security tests pass against isolated PostgreSQL-compatible databases. Live Neon, SMTP and S3 tests, browser screenshot testing and deployment remain unperformed. See `docs/PHASE-2-VERIFICATION.md`.

Next: configure a development Neon database and email delivery to exercise the Phase 2 account workflow. Phase 3 — Feed and Discovery then adds restaurant posts, social actions, reporting, search and filters without introducing menus/orders early.

Phase record: Phase 2 → foundation (project/runtime/database → install and migrate); accounts (signup/verification/recovery/session → secure and test); restaurant access (membership/drafts/media → authorize and audit); review/public profiles (admin decisions/privacy → implement and test); verification (types/lint/tests/build → record evidence). These are internal delivery records, not user task/part instructions.
