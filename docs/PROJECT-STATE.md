# Project state

Project: Restaurant Social (temporary)
Baseline: new project, no application repository supplied
Delivery revision: P01-R1
Current phase: 1 — Product and Design
Status: planning package complete; software not yet implemented

Confirmed: subscription restaurant pages, daily posts, menus, customer accounts, feed/search/filter/detail, ordering with HesabPay, restaurant-owned delivery, responsive web first and mobile later, one complete phase per delivery, Neon default.

Defaults: one restaurant per cart; one pilot city; owner-set area fees; monthly manual subscription renewal; free customer accounts; email/password auth proposal; photo/text posts; no live driver tracking; RTL-ready UI. Subscription price, brand, pilot location and services remain configurable/unconfirmed.

Proposed stack: Next.js, TypeScript, Tailwind, Drizzle, Neon; versions/runtime/auth/media selection finalized against actual capabilities in Phase 2. Public APIs and domain services support future mobile clients.

Completed: scope, role boundaries, screen map, static screen board, architecture, logical entities and state transitions, focused evidence review, risks, acceptance criteria and roadmap.

Verification: package integrity and document coverage checked; static board inspected. No installed project, build, migration, backend tests, device tests, merchant tests or deployment. See root VERIFICATION.md.

Next: Phase 2 — Foundation, Accounts and Restaurant Pages. Deliver source together. Read this state and actual available files, preserve V3 workflow, use live evidence rather than treating this document as proof of implementation.

Planning hierarchy record: Phase 1 → product scope (requirements/roles → confirm scope and defaults); UX (journeys/screens → define states and create board); architecture (data/API/payment → define boundaries and constraints); release planning (evidence/risks → record dependencies and acceptance). These are planning records, not requests for user task/part completion.
