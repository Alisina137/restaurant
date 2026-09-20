# Project state

Project: Restaurant Social (temporary)
Repository: Alisina137/restaurant
Delivery revision: P03-R1
Current phase: 3 — Feed and Discovery
Status: implementation complete and locally verified; live-service and physical-device verification pending

Confirmed: subscription restaurant pages, daily posts, menus, customer accounts, feed/search/filter/detail, ordering with HesabPay, restaurant-owned delivery, responsive web first and mobile later, one complete phase per delivery, Neon default.

Defaults: one restaurant per cart; one pilot city; owner-set area fees; monthly manual subscription renewal; free customer accounts; email/password auth; photo/text posts; no live driver tracking; RTL-ready UI. Subscription price, brand, pilot location and services remain configurable/unconfirmed.

Implemented stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM, Neon serverless PostgreSQL, Better Auth, Sharp and a private S3-compatible media adapter. Dependencies are locked by npm. Versioned JSON routes and domain services preserve a path for later mobile clients.

Completed through Phase 3: Phase 1 planning; responsive application shell; secure account, verification and recovery workflows; restaurant onboarding, ownership/staff access, approval and public profiles; daily post drafts and up-to-four-photo publishing; stable cursor Discover and Following feeds; follows, likes and saves; saved-post collection; content reports and administrator moderation; restaurant search by text/city/area/cuisine plus open/delivery/pickup filters; refreshed mobile-first visual system across public, account, owner and admin surfaces; migrations, audit events and tests.

Verification: strict type check, lint and production build pass. Seventeen integration/security tests pass across four suites. No high or critical dependency advisory remains; four moderate advisories are inherited by development-only Drizzle migration tooling. Live Neon, SMTP and S3 checks, browser screenshot testing and deployment remain unperformed. See `docs/PHASE-3-VERIFICATION.md`.

Next: pull Phase 3, run the database migration, restart the development server and exercise one approved restaurant’s publish-to-feed workflow. Phase 4 then adds menus, meal variants/extras, meal search and post links, server-priced carts, restaurant delivery settings, orders and fulfillment states. No paid checkout will be claimed before Phase 5.

Phase record: Phase 3 → data/contracts (posts and social records); restaurant publishing (drafts/media/status); customer discovery (feeds/search/filters/actions); trust (reports/moderation/audit); visual refresh (responsive public/owner/account/admin surfaces); verification (migration/types/lint/tests/build/security review). These are internal delivery records, not user task/part instructions.
