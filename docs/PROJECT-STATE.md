# DineFlow — Project State

Product specification v1.0 · Software Development Workflow V5 · GitHub `Alisina137/restaurant`.

## Delivery progress

- **P01–P04**: Auth and role shells; restaurant onboarding and staff; menu management; sections, tables, live visits and waiter assignments. All previously merged to `main`, with their API/CI checks passing. Real-device review remains ongoing.
- **P05**: Real waiter ordering, immutable order snapshots and initial kitchen receiver, merged to main after CI.
- **P06**: Complete kitchen New/Preparing/Ready/History, optional handoff, per-line readiness, waiter Served + Completed, durable notifications, sound/vibration opt-ins, authorized event cursor and resync. Implemented in branch `phase-06-kitchen-service`; see `docs/PHASE-06-ACCEPTANCE.md`. Mobile/browser visual QA and production push delivery remain outstanding.

### P05 completed work
- **Waiter mobile: 5 active bottom tabs**: Home (real active tables/orders summary), Tables (active visit, current rounds), Orders (Active/Ready; Completed explains future serving), Menu (read-only catalog and choose an active table), More (existing profile/language/signout).
- **Order builder**: active visit-scoped Menu/Cart, search/category browsing, meal customization (mandatory option min/max), quantity 1–99, note, exact price estimate, encrypted device-local per-line draft, explicit Send, server acknowledged order, retry with same idempotency key, cart preserved if API fails. The server rejects obsolete item/version/options and expired visits.
- **Kitchen web**: high-contrast New, Preparing and Ready tabs; snapshot line cards, option/note details, Start Preparing / Mark Ready actions, server version checks and reconciling SSE/poll.
- **Restaurant manager web**: Orders Live and History tabs; no fake payment data.
- **DB/API**: order_rounds, order_lines with immutable prices/name/options/allergens, kitchen_tickets unique per round, order_activities, transactional order_outbox and order_revisions. Each submit locks the visit table, validates active membership and all menu choices in transaction, stores atomic order+ticket+activity+outbox and responds from committed state. Prices in AFN minor units, no fictional taxes or service charges.
- **Safety**: P04 pilot "finish visit" now blocks visits containing any accepted order until cashier settlement exists (P09); avoids silently closing unpaid work. Kitchen can only transition NEW→PREPARING→READY, not auto-mark served or paid.

### P05 boundaries
- Order rounds and lines are immutable: refunds, edits, void and price adjustments are **not yet exposed**, due in P08/P10.
- Only internal waiter orders in P05. Guest QR/PIN and approvals come in P07, kitchen serves/alerts/history advanced in P06, payment and check locking P09.
- A visit containing a real order cannot yet be closed via P04 pilot closure; this is intentional until billing is delivered. Do not demonstrate a pretend payment.
- Outbox rows are durable and transactionally committed. Initial realtime is revision-SSE plus periodic refetch; a dedicated multi-channel event consumer/notification worker remains a later phase.
- Local drafts use already-installed `expo-secure-store` split across per-line keys; no new npm packages are required. Large/invalid drafts produce an explicit Save error rather than silent loss.

## Automated verification
- `pnpm typecheck`, `pnpm test`, `pnpm build:web`, Postgres migrations, P01–P05 API regressions and P06 integration (100 safe replay requests, one ticket, mandatory modifiers, stale prices, kitchen state conflicts, tenant isolation and closure guard).
- Browser/mobile visual QA is not performed by GitHub Actions; check 320–1280px, Dari/Pashto/English, mobile Expo Go and network retries locally.

## Phase 08 status
- On branch `phase-08-service-requests`, guest verified assistance and bill requests with 60-second dedup, waiter mobile active request processing, owner/manager request workspace and genuine cashier Payment Requested state are implemented.
- Full P08 acceptance script `phase8-ci.ts` exercises live PostgreSQL and guest PIN scope.
- Accepted order rounds remain immutable. Monetary changes, refunds and void authorizations belong to P10. No unsafe silent edits.
- Manual check required: phone/tablet layout, three languages RTL/LTR, older/expired guest session and service workflow.

## Phase 10 status
- **Merged to `main` via PR #10:** cashier correction requests, separate management approval, approved unprepared-round voids, discounts applied to unpaid unsplit checks, cashier-executed cash/manual transfer refunds after settlement, separate reversal ledger, shift reconciliation, and tenant-scoped audit. Assigned waiter mobile can request an entire unprepared round cancellation; kitchen preparation race is guarded.
- P10 CI integrates with the seeded disposable PostgreSQL backend after P09/P08. See `docs/PHASE-10-ACCEPTANCE.md` for manual browser, role and money-handling checks.
- All receipt and accepted order monetary snapshots remain immutable; no automated payment-provider refunds.

## Phase 11 status
- **Merged to main via PR #11** after passing full GitHub typecheck, unit test, web build, database migrations and P01–P11 live PostgreSQL regression suite.
- Management Reports at `/app/reports`: Sales, Items, Service and Audit. Settled check totals and posted net collected tender are separate financial timelines. Owner/manager can export sanitized, auditable CSV with strict tenant scope.
- Owner dashboard now includes real active tables, accepted orders, unpaid checks and today's net collected payment/refund totals; no fake statistics or placeholders.
- See `docs/PHASE-11-ACCEPTANCE.md`. Physical-device, browser and cash-handling pilot acceptance remain outstanding.

## Phase 12 status
- **Merged to main via PR #13**, after full GitHub CI passed on the feature branch, including TypeScript, unit tests, Next.js build, migrations and P01–P12 live PostgreSQL integration.
- Restaurant subscription and invoice surfaces at `/app/subscription`: owner manual proof submission, read-only management access, versioned plans, invoice snapshots and browser print/PDF; no automatic payment provider.
- Restaurant support at `/app/support`: tenant-scoped ticket conversations and owner-approved expiring/revocable, metadata-only grants.
- Platform admin at `/platform/overview`, `/platform/restaurants`, `/platform/subscriptions`, `/platform/support`, `/platform/audit`, `/platform/settings`: restaurant oversight, invoices, manually verified payments, plan versions, role-guarded support, auditable policies.
- Tenant server checks enforce staff/table plan limits, subscription trial/period/grace and suspended new-visit gating without disrupting closure of existing visits. No unverified payment counts as paid.
- See `docs/PHASE-12-ACCEPTANCE.md`. Physical devices, printed invoice layout, actual payment references and pilot acceptance remain pending.

## Phase 13 status
- **Merged to main via PR #14.** Two full feature-head GitHub Actions runs passed TypeScript checks, unit tests, Next.js build, migration/seed and P01–P13 PostgreSQL integration.
- HTTP security, no-cache responses, safe request IDs/structured timing logs, per-instance public entry throttles and production environment/TLS validation are implemented. Existing durable PIN and auth attempt protection is preserved.
- A PostgreSQL SKIP LOCKED outbox reconciler recovers stranded accepted order/kitchen events and advances the durable location revision; this is in-app polling recovery, not mobile push delivery.
- Platform-only operations health counts and backlog age appear on `/platform/overview`; web role shell has a keyboard skip link and localized offline indicator.
- Added an isolated PostgreSQL backup/restore rehearsal script and operator runbook. No new schema migration or package installation required.
- See `docs/PHASE-13-ACCEPTANCE.md`. **Manual gates are NOT certified:** 3-language full visual QA, physical Android/receipt validation, peak-load, production backup/media recovery and measured RPO/RTO, accessibility, and cash reconciliation.

## Phase 14 status
- **Merged to main via PR #15**, after successful GitHub Actions typechecks, unit tests, Next.js build, migrations and Phase 1–14 seeded PostgreSQL integration.
- P14 is a **software implementation** of pilot evidence and independent countersignature workflow, not proof of a real restaurant service day.
- Owner/manager `/app/pilot`, platform `/platform/pilots`. Appendix-only, tenant-scoped PASS/FAIL evidence across 12 gates; 2-party cryptographically bound signatures are invalidated by any changed gate. Migrations required.
- CI verifies state-machine and authorization in a disposable seeded PostgreSQL instance. **Manual release prerequisites remain unsigned:** target Android/printer, Dari/Pashto/English screens, actual tender, one supervised restaurant shift, real restore, load and incident drills.
- Run `docs/PILOT-RUNBOOK.md` with real operators before tagging a release candidate. Until then **production launch is blocked**.

## Phase 15 status
- Shared premium design tokens, reusable UI primitives, consistent form/card/button/loading/feedback styling, and aligned web/Expo palette have been implemented. Login, restaurant overview and cashier checks now use shared primitives.
- A design-contract check is included in CI. See `docs/PHASE-15-ACCEPTANCE.md`.
- Physical browser/device visual QA and real restaurant pilot gates remain **outstanding**; do not treat this UI work as production approval.

## Phase 16 status
- The legacy flat sidebar has been replaced with a grouped, role-specific workspace menu, persistent desktop collapsed rail, localized active breadcrumbs, and a keyboard-aware mobile drawer. Navigation stays mounted independently from workspace content and exposes only implemented routes.
- `pnpm nav:verify` checks destination existence and navigation accessibility contracts in CI. See `docs/PHASE-16-ACCEPTANCE.md`.
- Browser/device visual QA and the Phase 14 real restaurant release gates are still **not signed off**.

## Phase 17 status
- A route-persistent global UI notification and confirmation provider, shared search/filter/pagination/retry controls, and focus-managed dialogs were introduced. Menu, floor, kitchen, staff, cashier check lists/settlement, and adjustment/refund workflows now use the shared UI and additional single-flight safeguards.
- `pnpm interaction:verify` now runs in CI alongside existing visual/navigation checks. Acceptance matrix and known manual validation gates: `docs/PHASE-17-ACCEPTANCE.md`.
- **Code changes are not proof of device QA or real cash settlement**. The Phase 14 independent pilot release gates remain outstanding.

## Phase 18 status
- Implemented email-based password reset (one-hour single-use tokens via Better Auth), web forgot/reset routes, authenticated profile name and password changes, session/device management and revocation, and responsive login/registration/invitation/onboarding interfaces.
- Secure invite-only redirect validation, explicit email verification, 3-language auth UX, role/tenant-aware account settings, owner draft progress and user-facing failure/recovery states. Waiter Expo gained recovery entry, name editing and password/session security controls; real-phone recovery links require a web callback origin. Added `pnpm auth:verify` to CI.
- See `docs/PHASE-18-ACCEPTANCE.md`; actual external mail delivery, manual device/RTL and recovery tests require operator verification. **This is not commercial deployment approval.**

## Phase 19 status
- Implemented a true live owner/manager restaurant dashboard at `/app/overview`. Dedicated management-only tenant-scoped API provides real 7/30-day settled sales, posted net collections, refunds, matching previous periods, top settled menu items, kitchen and guest queues, service performance and attention links.
- The dashboard retains a collapsible setup checklist, supports RTL/LTR languages, visibly distinguishes finance metrics to prevent double counting, handles offline/retry/stale responses and refreshes no more often than once every 30 seconds per visible tab.
- Added `pnpm dashboard:verify` and seeded `phase19-ci.ts` (PostgreSQL ledger reconciliation, role/tenant isolation and period validations). See `docs/PHASE-19-ACCEPTANCE.md` for manual acceptance.
- Real operator cash reconciliation, hardware/device visual QA and Phase 14 supervised pilot sign-offs **remain outstanding**.

## Phase 20 status
- Menu manager now includes a live tenant/location-scoped catalog summary, published and draft readiness, quick optimistic-version-controlled meal and category publishing, improved inventory selection and confirmations, filters, editable multilingual categories/modifiers and a staff guest-visible preview with revision and retry.
- The new meal publication endpoint retains the same category and modifier checks as the editor; all publishing/availability updates remain scoped and audited. No migration/new dependencies.
- `pnpm menu20:verify` and the seeded `apps/api/src/phase20-ci.ts` regression were added to CI. See `docs/PHASE-20-ACCEPTANCE.md` for manual menu publication, device, photo and QR validation.
- Production approval still requires actual restaurant pilot evidence, accounting and hardware QA from Phase 14.

## Phase 21 status
- Live floor board upgraded with genuine open-visit occupancy and party counts, capacity/free-seat metrics, cleaning/unassigned attention, section/status/waiter/assigned-to-me filters, section grouping, role-appropriate actions, accessible details, and manager workflow links. No fabricated reserved status.
- Owner/manager section and table management now has search/filter/pagination against tenant/location-scoped SQL before pagination (including real occupied/cleaning states, waiter/section constraints) and guarded archive/form controls. Existing server-side occupancy, waiter assignment, version and settlement protections remain authoritative.
- Permanent table QR management gained secure rotation confirmation, printable selection and search/state filters, current-page selection and active-table guards. Floor updates retain last good data and use request-sequence guards, visible-tab SSE/polling and reconnect sync.
- New responsive/RTL premium styling and three-language copy. No new migrations/packages. `pnpm floor21:verify` and seeded `phase21-ci.ts` are in CI.
- See `docs/PHASE-21-ACCEPTANCE.md` for code/DB checks and outstanding mobile, live waiter, physical QR and cashier-service pilot verification. **Phase 14 production pilot gates remain pending.**

## Phase 22 status
- Rebuilt owner/manager staff experience with real membership counts, active role breakdown, pending and failed invitation totals, role-aware management, safe editing and confirm/revoke/resend workflows. The role matrix describes actual server capabilities, not fake permission toggles.
- `/api/tenant/staff/overview` and scoped/filtered paginated `/staff` and `/invitations` endpoints supply accurate counts and live records. Staff updates can reject stale role/status via optimistic expected values, preserving owner and tenant safeguards.
- Restaurant settings now includes owner-editable informational weekly opening hours using existing JSONB, contact and receipt details, language/timezone and manager invitation policy. Save uses `expectedUpdatedAt` to reject stale owner changes; old clients remain compatible.
- Responsive premium styling in English/Dari/Pashto, RTL, defensive loading/error/retry and role/access guidance. No packages or schema migration.
- New `pnpm staff22:verify` and PostgreSQL-backed `phase22-ci.ts` in CI. See `docs/PHASE-22-ACCEPTANCE.md` for remaining production email, printed receipt and device verification.
- Phase 14 supervised operator pilot remains **outstanding**.

## Phase 23 status
- Rebuilt the Expo waiter workspace with a safe-area five-tab shell, polished active icons and unread ready-food badge. Added shared native headers, metric cards, action links, pills, pagers, loading/retry and error states with English/Dari/Pashto localization and RTL.
- Home now shows six **real** role-scoped live service metrics, tenant identity, kitchen alerts and working shortcuts without overriding a user's chosen app language.
- Tables: virtualized section grouping, own assignments and real occupancy metrics, section/status/search filters, actual ready-food and service-request attention queue, secured detail links.
- Orders: virtualized active/ready/completed paginated lists, kitchen status and pricing, focus-safe refresh, details links. Menu: virtualized real tenant catalog, real category/search, item modifiers/allergens, assigned active visit selector and guarded order-builder links. More: genuine account identity, direct operations links, preferences, secure profile and guarded signout.
- Focus-aware live loader skips background polling, ignores out-of-order responses, redirects expired sessions and retains last good data with explicit stale-network warning. `mobile23-data.ts` selectors are exercised by `pnpm mobile23:verify` (static contracts and native pure function tests). No new migrations or external libraries.
- See `docs/PHASE-23-ACCEPTANCE.md` for Expo Go hand-testing, real service flows, all locale/device and notification/vibration verification. **Phase 14 supervised pilot remains outstanding.**

## Phase 24 status
- Redesigned Expo waiter table details with live, role-authorized occupancy and assignment, party size stepper and validated seating, optimistic versioned cleaning, active visit summaries, real order totals/rounds and correct cashier settlement boundaries.
- Guest visit PIN is masked by default, only revealed on demand for 20 seconds, automatically re-hidden on leaving, and rotated only after a clear security warning with a server-side version check. Table-specific guest order reviews are fully navigable with paged server filtering.
- Service request lifecycle upgraded with table-specific counts, acknowledgment and resolution from the visit, plus a real paginated status- and table-filtered request queue with notes and confirmation. Cross-role and tenant guardrails remain in the backend.
- Strengthened waiter order detail handoff: reject duplicate serve/correction actions, safe focused refresh, actual tax/service fee display and server-confirmed open-visit ordering.
- New `mobile24-ops.ts` selectors, full Dari/Pashto/English copy, `pnpm mobile24:verify` and seeded PostgreSQL integration `phase24-ci.ts`; no new packages or database migrations.
- See `docs/PHASE-24-ACCEPTANCE.md` for live device, physical QR/PIN, cashier and restaurant QA. **Supervised Phase 14 pilot remains outstanding.**

## Phase 25 status
- Rebuilt Expo waiter order builder with a safe-area two-tab Menu / Cart workspace, real menu/category search, dish cards and modifier selection, editable item notes/quantity, accurate estimated total, guarded removal, explicit review/confirm and a real accepted kitchen-ticket route.
- Local cart validation now checks item publication/stock, version, mandatory and optional modifier groups/options (min/max, no duplicates), 40-line cap, 1–99 quantity, note limits and money ceilings before sending. Invalid dish prices are shown as unavailable rather than zero. User changes reset the idempotency key only when actual cart data changes.
- Encrypted user/tenant/visit scoped on-device drafts now use a two-slot commit journal with serialized writes and legacy P05 fallback. Submission request keys are durably saved **before HTTP POST** so uncertain sends lock edits and retry the **same cart/key**, avoiding duplicate kitchen tickets even after a visit closes or meal availability changes.
- Server-authoritative visit/menu preflight, explicit submit confirmation, robust offline/retry/401 states and live kitchen handoff. Dari/Pashto/English copy and RTL styling upgraded; no new migrations or npm packages.
- `pnpm mobile25:verify` adds native cart validators and static contract tests. `phase25-ci.ts` exercises real tenant/role scoping, replay, duplicate prevention, immutable amount after stock/price change and kitchen new/preparing/ready + waiter serving in disposable PostgreSQL.
- See `docs/PHASE-25-ACCEPTANCE.md` for real Android multi-step ordering, draft interruption, network ambiguity, currency and accessibility tests. **Phase 14 supervised restaurant pilot remains outstanding.**

## Next phase
Phase 26: mobile notifications, profile and offline resilience.

## Local commands
```powershell
cd C:\projects\restaurant
git pull --ff-only origin main
pnpm db:migrate
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
```
Ensure `apps/api/.env`, `apps/web/.env.local`, `apps/mobile/.env` exist and contain the required values, as documented in the example files.

## Phase 26 status (implementation branch)
- Native waiter notification inbox now uses role/assignment-safe server pagination and unread state, confirmed mark-one/mark-all, real ticket deep links, foreground-only 12-second polling, last verified sync and stale/read-only retry. The waiter badge is scoped to the signed-in account and tenant. No OS push capability is claimed or simulated.
- Profile and security remain server-authoritative: updated premium account/restaurant/role screen, editable name, persisted Dari/Pashto/English preference, protected password and session revocation, focus/foreground refresh, empty/offline/retry states and app version.
- Per-account/device opt-in ready-food vibration replaces global consent. A top-level network/server indicator records actual request failures and offers GET-only retry; accepted order submission keeps its Phase 25 durable idempotency workflow, and no financial/account action is silently queued offline.
- Added a waiter-assignment-restricted, idempotent read-all endpoint, P26 static/pure mobile tests and disposable PostgreSQL role/state regression. See `docs/PHASE-26-ACCEPTANCE.md`. **Physical Expo Go testing, notifications foreground/background behavior, RTL and Phase 14 restaurant pilot sign-off remain pending; do not claim production launch readiness.**

## Phase 27 status (implementation branch)
- Rebuilt kitchen New / Preparing / Ready / History with a dedicated high-contrast responsive service display, server-scoped queue counts and oldest ages, elapsed-attention labels, and an actual server-backed table-label search across pages.
- Ticket cards now surface order/line cooking notes, modifier options and quantities with clear preparation progress, per-line actions and distinct Start / Finish Remaining / Handoff / Remind actions. Failed detail fetch disables transitions, and stale version conflicts require a refreshed server state.
- Foreground-aware HTTP polling and revision SSE keep kitchen screens reconciling without claiming background delivery. Sound is opt-in by staff account/restaurant and cannot replace visible status. The entire web board supports English, Dari and Pashto with responsive focus/touch affordances.
- Added `pnpm kitchen27:verify`, real seeded PostgreSQL `phase27-ci.ts`, and acceptance matrix `docs/PHASE-27-ACCEPTANCE.md`. **Browser/tablet visual QA and Phase 14 physical restaurant pilot still require manual approval.**

## Phase 28 status (implementation branch)
- Added explicit, audited, idempotently replayable **waiter confirmation of physical kitchen pickup** after kitchen handoff (a separate event from service at the table). It is persisted in new nullable columns with a safe additive migration; historical pickup is not claimed as acknowledged.
- Kitchen owner/manager/kitchen now have a role-/tenant-scoped, row-locked ticket state reconciliation GET exposing progress, real handoff/receipt/service timestamps, and distinct waiter notification-read status.
- Before versioned POSTs the kitchen checks current server state. Any ambiguous POST transport/5xx result is stored per signed-in account/restaurant and blocks further mutations of that ticket until explicit GET verification. No automatic POST replay occurs.
- Location revision lock now precedes outbox cursor allocation, allowing a protected high-watermark GET and bounded 50-event cursor replay with SSE hints, foreground reconciliation, safe fallback and independent status feedback.
- DineFlow waiter mobile order screen adds authenticated Confirm Kitchen Pickup with English/Dari/Pashto copy and network-uncertain refresh safety. Kitchen displays pending/confirmed waiter receipt honestly.
- `pnpm kitchen28:verify`, disposable PostgreSQL `phase28-ci.ts` with 12 simultaneous orders and version races, and `docs/PHASE-28-ACCEPTANCE.md` describe evidence and outstanding real-device QA. **Phase 14 supervised restaurant pilot and physical/tablet verification remain outstanding.**

## Phase 29 implementation — kitchen operational performance & shared-screen readability
- New protected `GET /api/orders/kitchen/cards` returns the existing validated 10-ticket page and associated immutable cooking note/modifier/item snapshots in one bounded server response. The kitchen board renders tickets from bundled data, avoiding its previous 10 per-card API fetches while preserving full order-detail modal and version-preflight writes.
- Owner/manager/kitchen-only `GET /api/orders/kitchen/pulse?minutes=60|180|360` computes actual time-to-ready median/p95 and sample count from committed ticket timestamps; pending waiter pickup acknowledgment comes from real unacknowledged picked-up tickets. Zero-sample intervals return nulls instead of fabricated results. No arbitrary target is claimed as met.
- Kitchen Service Pulse includes selectable reporting window, independent 60-second polling and foreground refresh, graceful stale/error states, last verified time and server-side query duration. Responsive Standard/Large display sizing stores a preference per staff identity and restaurant; touch, RTL and no-sound states remain intact.
- Added scoped preparation sampling index via migration `0014_phase29_kitchen_performance.sql`, selector and UI tests `pnpm kitchen29:verify`, and `phase29-ci.ts` live PostgreSQL privacy, compact snapshot and performance checks. See `docs/PHASE-29-ACCEPTANCE.md`.
- **Automated verification cannot replace visual inspection on actual kitchen tablets, low-connectivity testing or the pending Phase 14 supervised restaurant pilot. Do not call production launch certified.**

## Phase 30 — KDS foreground visibility evidence
- Added an **explicit bounded, idempotent, restaurant/location-scoped** KDS foreground render receipt: kitchen cards are reported only after verified ticket snapshots render in a visible browser. Database `first_displayed_at` is assigned once using server time and nullable on historical tickets. No personal/device identity is collected or order version, outbox, financial data, preparation or waiter receipt is changed.
- Added actual data-backed **accepted / observed sample coverage, first-render median and p95 in seconds, and unreported active backlog** for the restaurant's 1/3/6-hour window. Zero/unsampled data is shown as missing, never invented as a zero-second success. No physical network latency SLA pass or human sight is claimed.
- Kitchen Service Pulse now has a dedicated localized English/Dari/Pashto Display Visibility panel with accurate methodology, cross-role isolation, independent refresh/error feedback and low-footprint idempotent reporting. Includes additive migration `0015_phase30_kitchen_display_observed.sql`, `pnpm kitchen30:verify` and seeded PostgreSQL `phase30-ci.ts` with 6 concurrent receipts and 10-ticket batching.
- See `docs/PHASE-30-ACCEPTANCE.md`. **Phase 14 real restaurant pilot, 20-table/10-client/200-ticket hardware validation, hands-on tablet testing and recovery sign-off remain unperformed.**

## Phase 31 — kitchen visibility gap triage and disposable busy-service rehearsal
- Added protected, read-only `GET /api/orders/kitchen/unobserved` for exact tenant/location age-filtered, table-searchable, oldest-first, 10-per-page active kitchen tickets missing a browser foreground render report. Missing telemetry never means a human did not see an order. No payment, staff/customer PII or business mutation.
- Premium expandable kitchen diagnostics panel inside the service pulse: Dari/Pashto/English, table search, 0/30/60/180/300-second age filter, live elapsed duration, paginated matching counts, independent 30-second refresh, honest connectivity errors and per-ticket detail inspection without recording a false display receipt.
- Added `pnpm kitchen31:verify` pure/static tests and `phase31-ci.ts` for role, tenant, age, pagination, first-render receipt and no-read-side-effect coverage.
- Added tightly guarded disposable `pnpm pilot31:rehearse` load harness: 20 tables, ten concurrent HTTP workers, 200 real accepted order rounds, unique numbering, outbox paging, bounded kitchen read, missing-report triage and 200 first-display receipts. GitHub CI runs the harness only on its seeded local `dineflow_ci`; it is NOT a physical 10-device or certified 3-second network visibility test.
- See `docs/PHASE-31-ACCEPTANCE.md`. **Outstanding: real tablet/browser checks, 20/10/200 physical network test, Phase 14 supervised restaurant pilot and independent release/backup/finance sign-off.**

## Phase 32 — live supervised pilot operational readiness cockpit
- Owner/manager `/app/pilot` includes a premium, RTL-aware, localized English/Dari/Pashto **Live Operating Snapshot**. Scoped `GET /api/pilot/operations?minutes=60|180|360` reports real accepted/observed kitchen coverage, active/unreported tickets, pending waiter pickup acknowledgment, visits, open checks and cashier shifts, published menu and usable tables, plus tenant-scoped internal outbox backlog and age.
- Client signal classification is **investigative only**: stale metrics are cleared after failed reads; independent 30s/foreground refresh, visible retry and no fabricated device delivery or physical human response. `pilotCertified:false` is always returned. Nothing here automatically marks any Phase 14 pilot gate passed or signs a release.
- `pnpm pilot32:verify` checks typed result integrity and multi-language presentation. Seeded `phase32-ci.ts` exercises RBAC/tenant isolation, genuine accepted ticket and render report transitions and no change to pilot fingerprints. No database migration.
- See `docs/PHASE-32-ACCEPTANCE.md`. **Still outstanding:** real tablet / Wi-Fi / receipt/printer tests, financial close and real cash reconciliation, isolated backup/restore, full supervised shift and independent approval.

## Phase 33 — pilot incident register with audited P0/P1 release blocking
- Owner and manager `/app/pilot` gain a full English/Dari/Pashto responsive incident register for real human-reported P0/P1/P2 defects attached to the 12 pilot acceptance gates, with status/severity filtering, bounded pagination, role-safe read-only event history and versioned concurrency-safe transitions. Only owner can resolve with written retest; manager can report/reopen.
- Two additive PostgreSQL tables persist scoped incident status and **append-only versioned evidence**. Tenant-row transactions and audit metadata enforce ordered concurrency and protect narratives from being added to general audit details.
- Open P0/P1 incidents block owner and platform sign-offs. **Every incident mutation invalidates existing signature fingerprints**; a resolved or reopened issue never automatically passes a physical test or changes a cashier/order ledger. Platform dashboard displays critical incident count but not private incident prose.
- `pnpm pilot33:verify` and disposable `phase33-ci.ts` validate tenant, role, race and signature security; see `docs/PHASE-33-ACCEPTANCE.md`. Migration `0016_phase33_pilot_incidents.sql` required.
- **Unperformed:** physical restaurant shift, printer/Android Wi-Fi testing, actual cash/receipt reconciliation, backup restore and independent real-world sign-off. Do not infer commercial launch from CI.

## Development-only interface launcher (post-P33 convenience feature)
- `/dev/interfaces` is a secure-to-navigate six-card preview tool for the existing restaurant owner/manager, waiter Expo, cashier, kitchen, guest QR/PIN and platform admin roles. It has no auth bypass, no forged demo data and no write operations.
- A local browser API /health/ready probe reports connected vs unavailable; Expo status is deliberately manual. Live customer entry only accepts the existing QR route and cannot redirect to third-party URLs. The layout has English/Dari/Pashto support with RTL and readable mobile/desktop styles.
- Server-side Next.js development guard; production builds render HTTP 404. `pnpm dev:interfaces:verify` checks real paths, safe QR parsing and copy. CI checks the production 404 by booting the built web app. No migration or extra dependencies.
- Documentation: `docs/DEV-INTERFACE-LAUNCHER.md`. Still requires actual user accounts, a real customer visit/PIN and an Expo physical device; not pilot certification.

## Menu Categories API reliability hotfix (after interface launcher)
- Reconfirmed that Menu's second navigation subtab is `/app/menu/categories`, which submits to `POST /api/menu/categories`. The transaction route already catches database exceptions, but `pg.Pool` previously had **no idle connection error listener**; Node could terminate from the independent EventEmitter `error` event on intermittent PostgreSQL/Neon/PgBouncer network drops. Listener now logs only a sanitized code and prevents process termination from this event while allowing normal pool reconnection.
- Safe menu error codes clarify duplicate category names (409), missing/stale menu schema (503, migration hint only in development) and database connectivity (503). The category form preserves entered values and offers localized help in English, Dari, Pashto. Duplicate write uses the existing DB partial unique index; no schema change.
- New API unit tests simulate idle pg Pool error without leaking a connection string; separate error classifier tests. Seeded integration runs concurrent duplicate category creates, checks API remains responsive and validates category publication, access isolation and modifier group creation. This cannot prove the user-specific crash is the same idle-socket issue without local API terminal logs.

## Phase 34 status — Operational and Deployment Readiness
- Credential-free, read-only HTTPS smoke verifies public API liveness and PostgreSQL readiness, standard security headers, anonymous role isolation, web login and absence of the development launcher in production.
- New `pnpm ops:preflight` and `pnpm ops:preflight:verify` commands; GitHub CI will run a disposable API + built-web smoke. The result is **not release authorization**.
- API reports 503 on `/api/health/ready` during graceful shutdown. No database migration or new user navigation is needed.
- Real pilot, independent financial reconciliation, physical receipt/Android review, database/media restore, alerts/on-call, observed incident prioritization and a human GO/HOLD decision remain pending.
- Acceptance and rollback: `docs/PHASE-34-ACCEPTANCE.md`. Next: Phase 35 — address real operator-observed recovery gaps.

## Phase 35 status — Recovery monitoring and operator triage
- Backend internal revision outbox now records **instance-local** start/scan/retry/success/processed metrics without leaking SQL error details or altering the durable event workflow.
- Platform-only read-only `GET /api/health/operations` keeps backwards-compatible counts/status, adds timestamped classification (`ok`, `investigate`, `urgent`), bounded named signals, current server worker diagnostics, explicit `pilotCertified:false` and mixed-instance scope.
- Platform overview replaces stale service status with a responsive three-locale **Operational recovery** panel, independent 30-second visible-only refresh, non-stale error handling, and real navigation to pilot blockers/support.
- Regression coverage: `pnpm phase35:verify`, pure worker/threshold unit tests through `pnpm test`, disposable P35 HTTP role contract in CI; no new database migrations or npm dependencies.
- Physical incident observation, real Android/kitchen/printer rehearsal, external pager setup, restore drills and independent real-money reconciliation remain pending and cannot be represented as complete by automated signals.
- Runbook: `docs/PHASE-35-ACCEPTANCE.md`. Next: proposed Phase 36 performance/availability tuning against actual measured traces.

## Phase 36 — Performance & Availability Evidence
- Added bounded in-memory API response sampling (max 1,024 completed non-health requests from last five minutes), with sanitized route groups, p50/p95, HTTP 5xx/429, slow request counts. Never stores query strings, QR/visit IDs, credentials, payloads, or customer/financial details.
- Reuses existing platform-admin `GET /api/health/operations`, adds process-local performance/pool pressure, 20-sample insufficiency disclosure and diagnostic-only signals; preserves anonymous denial, role guards, no-store, legacy Phase 35 fields and `pilotCertified:false`.
- Platform Overview now shows localized responsive API response/DB pool metrics and top sanitized route category table, alongside the real recovery panel, using existing 30-second foreground refresh.
- Set bounded HTTP reception timeouts and added partial index `order_outbox_pending_order_idx` for `delivered_at IS NULL` ordered reconciliation and oldest backlog. **Additive migration 0017; run `pnpm db:migrate`**.
- Phase 36 unit, static contract and disposable protected HTTP/SQL-index checks; CI executes them via existing `pnpm test`, `pnpm phase35:verify` and Phase 35 API integration.
- **Not complete:** real staging profiling, p95/p99 under actual phone/tablet load, incident and SLA attestation, physical printer, bank reconciliation, restore, customer experience or human pilot GO. See `docs/PHASE-36-ACCEPTANCE.md`. Next Phase 37: targeted bottleneck remediation using measured traces.

## Phase 37 — Kitchen Queue & Multi-Line Checkout Efficiency
- Waiter and approved guest carts (up to 40 priced lines) now commit all immutable order-line snapshots in one bounded multi-row INSERT inside the existing table/visit-locked, idempotent accepted-order transaction. Prices, modifier validations, audit, outbox and financial invariants are unchanged.
- Kitchen card reads reuse a single authorized tenant/location scope, project ticket version/pickup acknowledgement from the paginated ticket row and only fetch bounded line snapshots. The redundant second session lookup and ticket query are gone.
- Kitchen and management list/count queries no longer join `dining_visits` without need; waiter `/api/orders/my` **retains** the join and waiter-assignment predicate. Exact server-side tenant-scoped filtering and pagination remain.
- P29 real seeded integration now exercises five line quantities/notes, per-line snapshots, total/idempotent replay, private role and cross-tenant boundaries, transitions and the pickup-ack card. Source checks: `pnpm phase37:verify`; full typecheck/tests/CI and P31 rush simulation still apply.
- **No new migration/dependency.** Phase 36's database migration still required on instances not yet updated. No live staging performance claim, physical KDS/phone/receipt proof, cash sign-off or production release approval. See `docs/PHASE-37-ACCEPTANCE.md`.
- Next Phase 38 should prioritize bottlenecks measured on staging, not invent service-level improvements.

## Phase 38 — Repeated-Meal and Modifier Administration Reliability
- Checkout pricing now reuses **only within each single PostgreSQL transaction** locked meal and modifier group/option records when 1–40 order lines repeat a meal/group. Item/group version, price/option validity, per-line quantity/note/total, category publishing and group attachments remain independently validated.
- Owner/manager modifier group creation now inserts all 1–30 options in one statement, while edits batch deactivation of omitted (retained historically) option rows and newly added option rows under existing optimistic version/audit controls.
- Existing P05 seeded HTTP regression now submits a 40-line alternating-modifier cart, checks every immutable line note/price, one event/ticket, idempotent retry and rollback for stale item/group versions. Existing P03 verifies 30-option group creation, editing 10, adding 2, deactivating 20 while retaining 32 historical rows, and stale edit rejection.
- Verification: `pnpm phase38:verify` (in CI via Phase 37 chain) plus normal TypeScript, production build, full seeded integrations and disposable load exercise. **No new dependencies or Phase 38 migrations.**
- No real p95 improvement, real kitchen/waiter device testing, guest Wi-Fi failure, live financial reconciliation or external pilot approval claimed. Runbook `docs/PHASE-38-ACCEPTANCE.md`. Next: Phase 39 measured staging workflow and failure cases.
