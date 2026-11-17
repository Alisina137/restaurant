# Phase 24 — Mobile Table, Visit and Waiter Service Redesign

**Scope:** Expo waiter-facing table detail, seating and cleaning, active visits, order and cashier handoff, customer service requests, guest verification PIN and guest-order reviews. No new dependencies or database migrations.

## Delivered

### Table and visit details
- `/table/[id]` is redesigned with a status-led table header, section/capacity/waiter/guest information, active visit time, informative notes and separate, actionable sections.
- Single secured table lookup is authoritative. Details for the **current, assigned, open visit** load from four independent real APIs (order rounds, table-scoped service requests, table-scoped pending guest approvals, private visit PIN). `Promise.allSettled` preserves available sections if another fails; unavailable is never shown as a fabricated zero.
- Focus-aware refresh from Phase 23 retains the last confirmed table snapshot if the network drops, rejects outdated responses, automatically pauses background polling and redirects expired 401 sessions.
- User-selectable party size with plus/minus, numerical validation (integers 1–30), capacity guidance, explicit confirmation and real `POST /api/floor/visits/tables/:id/open`. Role eligibility remains controlled by the server, including oversized-party manager approval. The backend serializes concurrent seating attempts and returns an existing visit for repeat requests.
- Cleaning action only on a cleaning table, with confirmation and versioned `POST /api/floor/tables/:id/ready`; cannot clean a table with an open visit or bypass owner/cashier settlement.
- Occupied visits show server order-round totals (not payment receipts), actual round cards and navigation into the existing protected order builder. Waiters cannot manually finish orders or take cashier settlement actions from this page.

### Guest PIN and review
- Guest PIN is fetched only for eligible, assigned open visits; masked by default and automatically re-hidden after 20 seconds or when leaving the page. No PIN is logged, cached on disk, embedded in QR, copied automatically or shared with another tenant.
- PIN rotation is protected by a warning that it invalidates current verified guest sessions and pending guest submissions, a version check, and explicit server confirmation. The UI refreshes afterward and re-masks the PIN.
- Guest-approval list is now virtualized, page-scoped, network-resilient, and respects `tableId` navigation from table details. It retains actual server-filtered total counts.

### Customer request lifecycle
- Table details surface the actual active request count and up to three most recent active service cards; further results link to the full request queue. Staff can acknowledge pending and resolve pending/acknowledged requests after serving; each mutation sends the current `version` and uses the existing tenant- and waiter-checked API.
- Rebuilt `/requests` as a virtualized, paginated, accessible, status-filtered queue (active/resolved). Deep links from a table preserve a server-side `tableId` filter and can be cleared. Optional resolution note has a 200-character limit. Resolve requires human confirmation. Mutation locks and backend optimistic guards prevent duplicate/stale changes.
- Exact server counts, real customer notes, bill-preference data, localized responses, safe retry and empty/offline states. No simulated bill settlement or fabricated guest requests.

### Food delivery and order detail
- Strengthened `/order/[id]` refresh to ignore stale responses, poll only when foregrounded, and respond to 401.
- Protected kitchen ready-to-served handoff and order cancellation against duplicate submissions using single-flight locks. The **Mark served** action appears only for genuinely ready/picked-up lines. The order detail now shows actual tax + service fees, rather than incorrectly claiming that there are none.
- **Add another round** is only shown when the server confirms the original visit is still open. Server-side permissions and version checks remain authoritative.

### UX and accessibility
- New three-language strings in Dari, Pashto and English with RTL-friendly rows, cards, confirmations and labels.
- Native safe-area header, grouped operational states, large press targets, contrast-coded status cards, concise guidance and actionable error/retry prompts.
- No fabricated reservation tab or forced "finish visit" button, no weakening of cashier guards or printed QR security, no migration/package changes.

## Verification
- `pnpm mobile24:verify`: runs the static acceptance contract and pure native data tests for seating/capacity limits, open/clean/occupied/read-only eligibility, request transitions, ready-food criteria, real unavailable counts and translations.
- `pnpm --filter @dineflow/api exec tsx src/phase24-ci.ts`: seeded, disposable PostgreSQL HTTP test creates a temporary assigned table, verifies unauthenticated/cross-tenant boundaries, server-rejected oversized seating, idempotent open, real occupied and round state, guest PIN/rotation, table-specific requests and guest approvals, service request version conflict/resolve, waiter-denied finish, owner zero-order finish → cleaning → versioned ready, and cleanup via archive.
- GitHub Actions retains TypeScript checks, web production build, unit tests, all earlier phase API integration tests and Phase 24 tests.

## Pilot acceptance still pending
1. On Android Expo Go, seat a party, refresh from a second device, verify an open visit and that another waiter cannot act on the table.
2. Check high-capacity seating rejection and manager approval workflow; mark a settled table clean only after cashier finishing and physical cleaning.
3. Scan physical permanent QR, view then mask the live PIN, verify an invited guest, rotate PIN and confirm previously verified sessions and pending submissions become invalid. Never print the visit PIN on permanent QR.
4. Submit kitchen tickets from an assigned visit, mark food ready in the kitchen and confirm physical delivery/serving by the waiter. Confirm displayed tax/service amount matches the immutable server snapshot and cashier receipt.
5. Create customer water, cutlery, bill, and call requests through guest QR; acknowledge and resolve with version conflict from a second device; inspect table-filtered and resolved history.
6. Review guest QR order from an individual table and test proper manager policy and waiter scope. Check large queues, pagination, network reconnect, session expiry, background/foreground and locale switch (Dari/Pashto/English, RTL) on compact devices.
7. Complete the separate Phase 14 supervised restaurant pilot before any production release approval.

## Next phase
**Phase 25 — Mobile Order Builder and Ticket Flow Redesign:** robust cart, modifier forms, server validation, drafts, checkout submission, kitchen handoff and device ergonomics.
