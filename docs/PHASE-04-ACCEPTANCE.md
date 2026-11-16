# Phase 04 — dining sections, tables, and collision-safe seating

**Product source:** DineFlow Product Specification v1.0, P04 / PG-04, PG-05, PG-29 (Board, Sections & Tables) / AT-004 / BR-002, BR-003, BR-015.

## Delivered
- **Owner/manager web**: `/app/tables/board`, `/app/tables/manage`. Stable sidebar, status overview, group-by-section cards, search/status/section filters, table details, seat-party form, manager-only demo visit completion, cleaning/ready action, section and table create/edit/disable/archive, active waiter assignment and reassignment, server pagination and archived records.
- **Waiter Expo app**: a real Tables tab (All, Mine, Needs Attention empty explanatory state until service workflow), search/status, live table board, table detail, assigned-waiter-only seat opening and cleaning-to-available action; Home displays actual assigned active tables. Refetch on screen focus/foreground plus polling.
- **Backend**: additive Postgres tables `dining_sections`, `dining_tables`, `dining_visits`, `floor_revisions`. Unique active label per location; unique **open** visit per table via partial database index. Transactional table locks serialize double opens, changes and cleaning; second opener receives same visit. Audit changes; versioned records and stale-write errors.
- **Roles**: all identifiers derived from active authenticated tenant/location; only owner/manager may create/change/archive records and finish a pilot visit; a waiter can open/mark-ready only their assigned table. Staff assignment verified as active waiter in same tenant; reassigning an occupied table changes its current visit waiter.
- **Realtime**: authenticated floor revision SSE and 20s web / 15s waiter mobile reconciling refresh, reauthorization during stream, no simulated orders or payment statuses.
- **History**: soft archive, no physical deletion of tables and visits; archived populated sections blocked. Occupied tables cannot be disabled/unassigned/moved/archived.

## Known boundaries
- No QR codes before P07, no order placement before P05, and no actual payment flows before P09.
- A **manager-only pilot visit finish** requires a reason and sets table to cleaning. This temporary P04 workflow must be integrated with strict unpaid-check guard in P09; never represent it as payment or bill closure.
- No "Needs Attention" guest requests until P06/P08. The corresponding tab explicitly shows a future-state explanation, not fabricated request counts.
- API imposes a 1000 active-table per location board cap (pilot limit), 10/page management list, 300 sections. Enterprise pagination can be added later.
- Browser visual QA and real Android Expo Go QA not performed through GitHub CI. Test RTL/LTR, touch controls, cards, and session transitions locally.
- Auth/API development requires `apps/api/.env` with `DATABASE_URL` and `BETTER_AUTH_SECRET`; use `apps/web/.env.local`, `apps/mobile/.env` and ngrok for phone access.

## CI
`pnpm typecheck`, `pnpm test`, `pnpm build:web`, Postgres migration+dev seed, P01/P02/P03 regressions, and `pnpm --filter @dineflow/api exec tsx src/phase4-ci.ts`.
AT-004 covers 10 seats, unique label, section constraints, service states, waiter assignment/capacity, duplicate concurrent open, one-open-visit DB invariant, archive guards, tenant isolation and versioned state transitions.

## Next
P05: waiter ordering and minimal kitchen acceptance flow. Keep visit status transition and table assignment constraints when building orders.
