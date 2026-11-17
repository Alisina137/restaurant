# Phase 22 — Staff and Restaurant Settings Redesign

**Scope:** Owner/manager web workspace — staff directory, invitations, capability overview and restaurant settings. No new dependencies or database schema migration.

## Implemented

### Staff
- `GET /api/tenant/staff/overview`: authenticated owner/manager-only summary. Reads active and disabled membership counts, breakdown by active role, current valid pending invitations, failed email deliveries, and the owner's `managerCanInvite` policy. Reports role-appropriate permissions and allowed invite roles. All data is scoped to the active tenant.
- `GET /api/tenant/staff?q=&role=&status=&page=`: server-filtered, paginated member directory. Searches name/email; filters exact role and active/disabled status; joined counts use the **same** scoped predicates before pagination.
- `GET /api/tenant/invitations?q=&role=&status=&delivery=&page=`: server-filtered, paginated invitation history; accurately calculates pending versus expired based on database expiry, with delivery-state filtering.
- `PATCH /api/tenant/staff/:id`: optional optimistic `expectedRole` and `expectedStatus` checks reject stale edits with `409 VERSION_CONFLICT`; existing server guards preserve last active owner, forbid self-disable, prevent managers editing privileged roles, and prevent cross-restaurant modification.
- Staff UI shows live status and by-role summaries, real email delivery failures, responsive searchable/filterable staff cards, accessible focus-managed edit dialog, change confirmations, role-safe invitation forms and resend/revoke controls. The permission matrix describes actual **server-enforced** owner/manager/waiter/kitchen/cashier capabilities and clearly identifies that it is not an editable permission feature.
- Owner can configure whether managers can invite waiter/kitchen/cashier staff; managers cannot invite or edit managers/owners. A manager whose permission is revoked sees a read-only invitation state. Invitations use existing 48-hour verified-email single-use links. Failed delivery is explicitly distinguished from a successful email.
- All displayed data is fetched from authenticated APIs; no fake “activity” totals.

### Restaurant settings
- Responsive sections for restaurant contact, branch, address, receipt footer preview, weekly opening hours, timezone, locale and owner-only invitation policy; managers can view but cannot change settings.
- Reuses `restaurant_settings.opening_hours` JSONB without a migration. Days may be **unconfigured** (no claim about service), **closed** (explicit), or **open** (24-hour `HH:MM` start and end); times must satisfy start < end. The hours are informational; they do **not** enforce customer order windows, reservations or payments.
- `PATCH /api/tenant/settings` supports optional `openingHours` with strict week-day and clock validation, plus optional optimistic `expectedUpdatedAt`. Database row locks, transaction rollback and increasing timestamp prevent concurrent owners from overwriting newer changes. Older clients omitting these new fields continue to function without erasing configured hours.
- Form tracks unsaved changes, has discard changes, server conflict guidance, actionable save state, safe errors/retry, and reusable owner security links. Uses English/Dari/Pashto with RTL and responsive layouts.
- All changes to settings and memberships retain existing audit logs.

### Acceptance
- `pnpm staff22:verify` checks role/tenant authorization, back-end scoping, staff flows, settings conflict guards, schedule input and responsive i18n. Wired to GitHub Actions.
- `pnpm --filter @dineflow/api exec tsx src/phase22-ci.ts` uses real seeded PostgreSQL + HTTP: exact role/tenant isolation, filtered list count consistency, manager invitation policy on/off, pending/expired/resend/revoke transitions, staff optimistic updates and protected owner, valid/invalid weekly hours, stale owner settings conflict, and restoration of the original business policy.
- Existing build/typecheck/unit/DB integration and Phase 1–21 regression suites are retained.

### Manual operator acceptance **still pending**
- Verify actual email delivery on the configured production SMTP provider (CI uses console mail).
- Verify verified-email invitation acceptance on several real devices, role transitions with active browser sessions, disabled-member access, manager policy enforcement, staff counts and changes across multiple tenants.
- Verify actual business contact details, informational opening hours, receipt footer on printed receipts, correct timezone in reports, all 3 languages and RTL on desktop/mobile browsers.
- Verify expired invitations, resend after mail-provider outage, stale concurrent owner edits, keyboard focus/escape/trap, low bandwidth and reconnection, then complete the independent Phase 14 restaurant pilot.
- These CI checks are **not** production launch or legal/access-control certification.

## Next phase
**Phase 23 — Mobile workspace redesign**.
