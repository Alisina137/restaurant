# DineFlow Phase 23 — Waiter Mobile Workspace Redesign

**Implementation scope:** Real waiter-facing Expo app; 5 stable bottom tabs and shared responsive mobile primitives. This phase reuses existing protected API routes; it does not create fictitious mobile actions, reservation systems or new database schema.

## Delivered

### Bottom navigation and global ergonomics
- Home, Tables, Orders, Menu and More remain real navigable bottom tabs; safe-area-aware tab bar with selected state, native labels/icons, ready-food unread badge and keyboard avoidance.
- New shared native headers, focus-safe loading panels, actionable service shortcuts, exact count metrics, error/retry and last-successful-refresh feedback, empty states, filter pills and pagers.
- Explicit `SafeAreaProvider` and consistent RTL behavior in English, Dari and Pashto. Refined typography, breathing room, semantic state colors and accessible 44–49dp pressable controls.
- Persistent native tab layout avoids remounting the tab shell on ordinary inner page load; existing detailed table, order, profile, guest approval and service request routes continue to work.

### Real service Home
- Six actionable live metrics derived from backend endpoints (own occupied tables, kitchen-ready food, active orders, service requests, guest approvals and unread kitchen notifications).
- Restaurant identity and shift header, direct shortcuts to tables, orders, customer requests, guest approvals, catalog and recent ready-alert details.
- No invented dashboard figures, offline faux successes or resetting the user's selected app locale after polling.

### Real Floor and attention
- Virtualized `FlatList`, section-grouped tables, exact real occupancy counts, quick all/mine/attention tabs, status and section filters, case-folded table search, reset and proper no-results guidance.
- Attention queue includes real active service requests and real kitchen-ready order rounds, linked to the corresponding existing detail screens; further results require the actual Requests/Orders screens rather than implying all items were loaded.
- Only actual assigned, occupied visits are eligible to create new orders; this remains enforced by server APIs as well.

### Orders and food menu
- Virtualized active/ready/completed order rounds, pagination, quick filter/state transitions, clear status pills, real amount/date, and detail-screen navigation. Polls only when screen is focused and the app active; stale request responses are discarded.
- Virtualized, localized, read-only menu with real category/search filters, price, allergy and modifier details, sold-out safeguards, and explicit visit/table selection before entering the existing secured order builder. All data comes from the tenant catalog and floor APIs.

### More / Account
- Real signed-in account identity and restaurant, notifications/request/approval shortcuts, personal profile and language, password/device security, device-local ready vibration toggle and guarded signout.
- No language selector in headers; language remains editable in Profile.
- Preserves last confirmed data during transient network failures and clearly reports unable-to-refresh state.

### Data consistency and restrictions
- `useLiveScreen`: focus-based refresh, app-background pause, bounded poll intervals, active-request generation guard (old results never overwrite newer tab state), last successful refresh, recovery on return to foreground, 401 session redirect. Loading, refresh and error states are distinct. No external network reachability is claimed without an actual server response.
- `mobile23-data.ts`: pure helpers for real visit-based metrics, waiter-specific floor filters and safe route tab parsing, with executable tests.
- No schema changes, new third-party packages, expanded role grants, self-generated reservations, simulation UI or backend bypass.

## Automated checks
- `pnpm mobile23:verify`: first runs `scripts/verify-mobile23.mjs` for screen hierarchy, API/role contracts, navigation, consistent localized UI and safe state handling.
- Then runs `apps/mobile/src/mobile23-ci.ts` with real pure selector assertions for assigned and occupied visit filtering, cross-waiter exclusion, query/section/status interactions, route tab validation and English/Dari/Pashto copy.
- GitHub Actions also retains the project TypeScript check, Next web production build, API/DB tests and all earlier phase regression checks. Compile/build passing is not evidence of physical-device runtime acceptance.

## Required hands-on acceptance (not automated)
1. Launch Expo Go on a real Android handset (and an iOS handset if supported), verify home, tables, orders, menu and more tabs with keyboard opening/closing and bottom safe-area gestures.
2. Sign in as waiter with zero assignments, multiple active tables, kitchen-ready orders, customer calls and guest QR approvals; verify all displayed metrics match the server. Confirm a denied staff role is not silently authorized.
3. Open/close visits, initiate new rounds through the menu selector, choose modifications, confirm server-side checks, serve ready food, review customer requests and guest approvals, then navigate back.
4. Switch to Dari, Pashto and English from Profile and confirm all five tabs, cards, menus, dialogs and chevrons mirror correctly; language preference persists despite Home polling.
5. Put app in background and foreground, disconnect/reconnect mobile network, trigger 401 and expired restaurant membership, rapidly switch order status and scroll large floor catalogs; ensure no stale overwrite or crashes.
6. Inspect notification badge and vibration under real ready events, plus sign-out and restoration of auth session.
7. Independently complete pending supervised restaurant Phase 14 operator pilot.

## Next phase
**Phase 24 — Mobile table/visit detail and service actions redesign**, including forms, waiter workflows, food-delivery handoff and device-specific affordances.
