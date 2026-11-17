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

## Next phase
Phase 24: mobile table and visit details, action forms and service workflow redesign.

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
