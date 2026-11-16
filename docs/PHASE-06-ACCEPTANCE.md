# Phase 06 — Full Kitchen Workflow and Waiter Ready Handoff

**Specification:** DineFlow v1.0 P06, PG-03/04/07/08/10/11/12/13/14, AT-008; BR-011/012/022/028/029/030.

## Delivered

- Kitchen web: functional **New / Preparing / Ready / History** tabs, role-restricted by authenticated restaurant membership, high-contrast dense responsive cards (>=47px primary buttons), live elapsed timers, server-based status, per-item preparation notes and modifier snapshots, ready-item controls, default oldest-first queues, filtered history (status, table and restaurant-configured business-date range, 20/page). New tab explains that guest approvals arrive in P07 (not a pretend approval inbox).
- **Per-item state**: `new → preparing → ready → picked_up → served`. Kitchen may mark individual items Ready; the ticket becomes Ready and the waiter is notified when all items are Ready. Existing P05 whole-ticket Ready is still supported and updates all its lines atomically.
- **Pickup is not service**: Kitchen can mark ticket **Handed off** and optionally resend a **throttled** ready alert (90s server cooldown, maximum 30). Waiter mobile has Ready orders and the actual **Mark Served** workflow, both per-line and all remaining lines, with confirmation. A ticket becomes Served only after all lines are served. All mutations use ticket row locks plus optimistic versions; invalid skips and double taps return 409 and are auditable.
- **Durable waiter alerts**: `staff_notifications` stores one notification per recipient/round/type, read/unread, visit/table/round navigation, last-notified and reminder count. Assigned waiter receives a notification on final ticket readiness; alert deep-links to order detail. Notification count and list are scoped to the **currently assigned** waiter in the tenant, so reassignment/revocation cannot expose another waiter’s order. Ready alerts are auto-marked read once served.
- Waiter Expo: **Home** ready counter and actionable newest alerts, **Tables → Needs Attention** reads actual Ready tickets, **Orders → Ready** marks Served and **Completed** displays actual served rounds, order detail shows line states and actions, **More** links to Notifications and an **opt-in** device vibration setting. Notifications support All/Unread, mark read, deep-link, and refresh/resume reconciliation.
- Kitchen browser sound is **opt-in** and throttled, played only for newly observed tickets after initial screen load; status/notifications never depend on audio. Realtime order revision SSE plus 12s polling handles reconnect and refresh; new cursor-based `GET /api/orders/changes?after=...` enables durable replay of location-scoped events, filtered to assigned visits for waiters.
- Schema migration `0005_phase6_kitchen_handoff.sql` is additive: kitchen ticket handoff/serve timestamps and versioning, line statuses/timestamps, unique ready-alert inbox, and monotonic outbox sequence. Old P05 ready tickets are preserved and their line statuses backfilled; ready alerts are backfilled for existing ready tickets.
- Accepted order money, item and modifier snapshots **remain immutable**; no actual payment ledger until P09.

## Validation and acceptance
1. Open the kitchen on two web browsers; create and submit 10 waiter rounds on a live table. New tickets appear without duplicate cards. Both screens refresh after SSE/poll reconnection, with correct table, notes and modifier snapshots.
2. Start Preparing, mark one meal ready, verify no premature *whole-ticket ready* until all meal lines are ready; mark the remaining line ready. The waiter receives one Ready notification with a link to the correct order.
3. Kitchen marks Handed Off; waiter confirms Served on mobile. Verify pickup and service timestamps differ, Served appears in Completed, and the notification is read. Do **not** represent this as paid or close the visit automatically.
4. Repeat a versioned mutation simultaneously in two kitchen sessions. One succeeds, stale request receives 409. Repeat a reminder immediately: it is throttled, not duplicated.
5. Confirm kitchen and waiter cannot access another tenant's tickets or notifications; waiter deactivation immediately blocks API and alert stream access. Verify statuses, RTL/LTR, off/on Wi-Fi, background/foreground resync on physical devices.
6. Validate kitchen History filters by restaurant-local business day, table, status, and correct duration ordering; optional sound is disabled until user explicitly enables it.

## Automated coverage
GitHub Actions verifies P01–P05 regressions and new `apps/api/src/phase6-ci.ts`: 10-ticket rush; unique notifications and cooldown, collision-safe handoff/line-ready, state and version guards, line vs round Served, durable cursors, cross-tenant denial, revocation, and kitchen history filters. TypeScript, unit tests, web production build and PostgreSQL migration run in the same workflow.

## Boundaries
- No web push / APNs / FCM background-delivered notifications; the Expo in-app inbox and optional vibration update on foreground/focus (polling fallback). Production push opt-in and gateway are later hardening work.
- No guest orders/pending guest approval count before P07, no cashier/checkout before P09, no discount/void workflow before P10. Visit settlement guard remains in place.
- No per-item *preparing staff assignment*, complex kitchen stations or adaptive course routing; pilot uses one unified kitchen queue.
- Responsive browser and real-device manual testing remain necessary, even when CI passes.

## Local launch
```powershell
cd C:\projects\restaurant
git pull --ff-only origin main
pnpm db:migrate
# separate terminal per command
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
```
No new npm dependency is required in P06. Set `DATABASE_URL` / `BETTER_AUTH_SECRET` in `apps/api/.env`, plus public API URLs in web/mobile env for remote device testing.
