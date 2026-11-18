# DineFlow Phase 27 — Kitchen Display Redesign

**Scope:** Busy-service kitchen web UI: New / Preparing / Ready / History. Improves the already real P06 kitchen processing flow without inventing new ticket states or changing price, serving or payment rules. Phase 28 owns further event replay and high-volume workflow reliability.

## Delivered
- New tablet-ready, high-contrast kitchen workspace with large table IDs, ticket round references, preparation time and attention indications, clear status chips and dense but readable item quantities. A fifteen-minute visual highlight measures elapsed time only; it is **not** a configured kitchen SLA or a promise of delivery.
- Real server-wide New / Preparing / Ready counts, oldest ticket age, and a 15+ minute aggregate; summary counts the whole tenant/location queue including picked-up within Ready, not only the visible 10 tickets. Tab links target existing actual kitchen routes.
- Server-backed table-label search applies before pagination and total calculation. History keeps protected status/table-ID/business-time-zone date filters, now with explicit Clear; invalid date ranges are rejected before network requests.
- Ticket cards include actual immutable item names, modifier snapshots, cooking instructions, quantity, per-line preparation states, item-ready count/bar, accessible per-item Mark Ready buttons, and clearly separated Start / Mark Remaining Ready / Hand Off / Reminder actions. Pickup remains distinct from waiter Served, and no kitchen payment feature is invented.
- Every mutation remains explicit and confirmed, sends the exact optimistic ticket version, is protected by a single-flight guard, and refreshes the real server state; stale/invalid version responses show a recovery message. Missing ticket detail disables all kitchen transitions instead of allowing blind actions.
- SSE revision hints plus 12-second HTTP polling, visibility-aware pause/foreground refresh, out-of-order request suppression, stale data alerts and a separate stream-versus-server-sync indicator. Optional sound is scoped to the staff account/restaurant/device and requires browser audio permission; new tickets do not chime on initial load. UI remains usable in silence.
- Layout is accessible, responsive at 320px through tablet/desktop widths, keyboard-focusable and localized in Dari, Pashto and English, retaining shared account/navigation shell and existing receipt/privacy boundaries.
- No migrations or new npm packages.

## Automated verification
1. `pnpm kitchen27:verify`: static end-to-end UI/API contract and pure TypeScript tests of time/priority, line progress, new-ticket baseline and locale coverage.
2. `pnpm --filter @dineflow/api exec tsx src/phase27-ci.ts`: seeded disposable PostgreSQL HTTP verifies role guard, real full-queue totals, scoped table search before pagination, no-results and excessive input, plus no-store response policy.
3. Standard CI retains all prior phases, production web build, migrations, seed and live API regression.

## Manual acceptance outstanding
1. With separate kitchen accounts on two tablets/browsers, submit 10+ assigned waiter orders and verify no duplicate cards, real table IDs, modifiers/notes, large readable text and oldest-first queue across pages.
2. Run through Start Preparing → per-line ready → final ready → handoff → waiter served; verify status changes on both screens and server-captured timestamps. Repeated/stale actions must fail with visible recovery. Check that reminder throttle remains active.
3. Test a ready notification without sound; enable sound with click and open another new ticket. Initial hydration must never beep. Background tab, disconnect SSE, change network and resume. Verify fallback polling/sync labels and no fictitious success.
4. Check dashboard counts equal the current entire restaurant queue, including ready/picked-up. Search for full and partial table label, search for an absent table, navigate pagination, clear search and verify history date/business-time-zone filters and empty states.
5. Test 320, 375, 768, 1024 and 1440px, English/Dari/Pashto RTL, large text, keyboard-only action/confirm/detail, touch targets, screen readers and reduced-motion.
6. Complete independent Phase 14 supervised restaurant pilot with genuine cash, hardware and backup recovery verification before any production release claim.

## Next
Phase 28 — Kitchen Workflow Reliability: stale tickets, optimistic transitions, handoff/acknowledgment, reconnect and high-volume concurrency reconciliation.
