# DineFlow Phase 26 — Mobile Notifications, Profile & Offline Resilience

## Scope
Expo waiter app on SDK 57. Reuses actual ticket/notification backend, Better Auth accounts, protected profile/security APIs and Phase 25 immutable order-key recovery. No new native dependencies or push credentials. **There is no background OS push delivery**: the app polls real notifications while foregrounded. Financial/order writes are never queued or silently retried while offline.

## Delivered
- Native notifications: All / Unread with durable server-side notice read state, table and ticket references, order deep links, count, time, page controls, explicit bulk Mark All Read with confirmation, and pull/manual/12s foreground refresh. Role- and assignment-checked API; no local fake notification source.
- Server bulk-read endpoint updates only notices belonging to the authorized waiter and still assigned visits, and is idempotent. Server never leaks another tenant's alerts. Existing reminder throttles and real kitchen ready generation are retained.
- In-app badge refresh is account + restaurant scoped; switching accounts clears the previous badge and vibration baseline. Vibration must be opted into per account/restaurant/device, checks only new foreground arrivals/reminders, and is rate limited. No initial notification storm after startup.
- A global transport status strip distinguishes network failures and HTTP 5xx server issues, with a safe GET-only connection probe. Read-only stale data stays labeled and user can refresh. Orders, payments, account updates and notification mutations never auto-retry in the background; Phase 25 idempotent reconciliation remains the only safe order replay workflow.
- Notifications and More display accurate guidance: no background push, foreground polling, local vibration opt-in, connection-recovery guidance. Existing Better Auth password change, sessions, revoke and profile/language paths remain available.

## Automated checks
- `pnpm mobile26:verify`: static native contract + pure typed notification/locale tests.
- `pnpm --filter @dineflow/api exec tsx src/phase26-ci.ts`: seeded PostgreSQL HTTP checks for auth/role bulk-read restrictions, persisted read/unread state and idempotency.
- Full GitHub Actions executes earlier phases, TypeScript checks, unit tests, production Next.js build, migration/seed and Phase 1–26 live PostgreSQL integration.

## Manual mobile acceptance still required
1. Run Expo Go with waiter account on actual Android phone. Confirm notifications appear only after a kitchen ticket is actually ready, sorted by most recent; All/Unread, Mark Read, Mark All, count and correct ticket route work.
2. Switch tenant/account and sign out/in. Confirm badge and vibration consent never leak between accounts. Fresh install or first open does not vibrate for the hydrated backlog. Enable vibration then generate a newly ready order and check foreground vibrations.
3. Background/force-close the app, then create an alert. Verify that **no background push is promised or displayed**, and returning foreground loads persisted inbox. Test reminder throttling (90s server) and local vibration throttle (20s).
4. Enable airplane mode during list refresh, profile update and a pending order POST; expect stale read-only UI/error and no fake success or duplicate order. Restore network, explicitly retry same Phase 25 key; verify exactly one kitchen ticket and no automatic replay of other writes.
5. Try cashier/owner/kitchen sessions and an unassigned waiter visit; verify they cannot read/mark another waiter's notice, and read-all never crosses recipient/tenant boundaries.
6. Test Dari, Pashto, English, RTL, small screen, keyboard, text scaling, focus/screen reader, foreground/background recovery, no connectivity, and server 503. Verify sign-out, account name and language changes and password/session management.
7. Complete the separate Phase 14 real restaurant pilot and hardware/production assurance gates. No production certification claimed.

## Next phase
Phase 27 — continue the approved mobile roadmap after actual device findings are reviewed.
