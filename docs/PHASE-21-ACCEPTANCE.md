# Phase 21 — Floor and Table Operations Redesign

**Target:** Owner/manager restaurant administration, real-time floor board, waiter operation and permanent guest QR management.

## Features implemented

### Live floor board
- Redesigned `/app/tables/board` with **real** table occupancy, cleaning and disabled statuses derived from table configuration and open visits. Available is *not* equivalent to a reservation; there is no reservation state/booking backend in the floor tables API, so Phase 21 does **not** display fabricated reserved tables.
- Quick KPI cards for total/available/occupied/cleaning/attention tables and seated party totals. Live summaries include free seats (available-table capacity), unassigned active tables and active sections.
- Status chips, section, waiter, table label/section/waiter/notes searches, **my assigned tables**, and unique attention filter for cleaning or unassigned tables; single reset action. Results are grouped by section and retain stable colored table cards.
- Manager warning for unassigned active tables, actionable links to actual implemented manager pages, and role-aware waiter permissions. Empty sections, no tables and no-filter-matches states each provide appropriate guidance.
- Accessible table-details dialog with focus trap and return, party size, capacity, notes, assigned waiter, open visit and duration; role-appropriate seating, finishing and cleaning actions; links to implemented order/check pages without inventing a per-table billing shortcut.
- Occupancy is recalculated by the backend and the UI listens for floor revision SSE; uses periodic visible-tab refresh and refresh on reconnect/return to foreground. Request sequence guards ignore out-of-order responses. Last successful sync time and explicit offline state are displayed; stale information is retained on transient errors.

### Sections and table administration
- `/app/tables/manage`: redesigned searchable/paginated section and table directories with modern cards, filters (status, section, assigned waiter/unassigned, text) and archived-mode read-only viewing.
- **SQL-side filters before pagination:** `GET /api/floor/tables?q=&section=&status=&waiter=&page=` supports real available/occupied/cleaning/disabled status derived from open visits; label, section and notes search; waiter filtering; archive flag. Enforces active tenant+location+manager boundaries, no-store headers and error for unsupported status (including `reserved`). `GET /api/floor/sections?q=&archive=&page=` adds scoped search, retaining existing authorized waiter read access.
- Active-section prerequisite for creating tables, table-level waiter selection, form fields for label/capacity/order/notes, and occupied-table editor protections (cannot disable, move or unassign; manager can reassign). Existing server-side transaction locks and optimistic version check are retained. Occupied-table archive is disabled in the UI and rejected by the server, while sections containing tables cannot be archived.
- Clear over-capacity guidance: only a manager can open a party larger than configured seats; server remains the final authority. Visit finish remains limited to unbilled/unordered demonstration visits; real orders require cashier settlement.

### QR code operations
- `/app/tables/qr`: counts for all, issued and unissued active-table QR codes; improved search/filter, robust pagination, current-page selection, page-safe print eligibility and error/retry handling.
- QR rotation requires a shared accessible confirmation explicitly warning that existing printed QR codes and active guest sessions become invalid. Concurrent issue/rotate is protected by a single-flight mutation lock. Invalidated selection is cleared, current table data is refreshed, and inactive tables cannot issue/rotate QR codes.
- Permanent QR cards are printable/downloadable as SVG only when issued. **Never put a visit PIN on a permanent QR**. Public web origin must be externally reachable before printing.

### Styling and language
- Responsive premium UI with card hierarchy, state colors, clear action priority, mobile and tablet layouts, right-to-left mirroring, keyboard focus, reduced motion and print-friendly views.
- New Phase 21 localized copy across **Dari** (`fa-AF`), **Pashto** (`ps-AF`) and **English** (`en`). No extra package or schema migration.

## Verification

- `pnpm floor21:verify`: static contract checks for authorization, SQL filtering, accurate role-aware state, accessible dialogs, QR safeguards, responsive styles and localization.
- `pnpm --filter @dineflow/api exec tsx src/phase21-ci.ts`: seeded, nonproduction PostgreSQL acceptance test: owner/waiter/kitchen cross-role and cross-restaurant isolation, section and table search, combined section/waiter/status filters, nonexistent reserved status rejected, real occupied visit, occupied restrictions, visit finish→cleaning→available, archive history and cleanup.
- GitHub Actions retains the existing TypeScript, unit and integration, Next production build, DB migration/seed and all previous phase test gates.

## Important non-features / acceptance gates
- No invented **reservation** workflow, booking slots or waitlist: reservations require a separate product/data model, API, concurrency policy and UI to be implemented and tested in a future phase.
- Do **not** manually finish a billed/ordered visit: checkout settlement remains under cashier logic; server rejects it when orders exist.
- Tenant floor is capped at 1,000 tables by the current backend; capacity and entitlements remain enforced.
- **Manual restaurant pilot pending:** verify waiter assignment/reassignment during real live service, physical seating, QR printing/scanning/rotation with a mobile phone, cashier settlement with open checks, kitchen tickets and guest requests, active guest session invalidation, offline/reconnect, Dari/Pashto RTL visual QA, small screen interaction and field accessibility. Completion of automated tests is **not** a production release approval.

## Next phase
**Phase 22 — Staff Directory and Restaurant Settings**: polish staff invitation/assignment, roles, security and tenant settings with the same real-data and QA requirements.
