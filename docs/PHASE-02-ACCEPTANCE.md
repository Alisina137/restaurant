# P02 Acceptance and demo path
Scope: F01/F02/F15/F16 bootstrap, AT-002, BR-001/022/025/033/034. Later phase work intentionally hidden.

## Scripted demo
1. Visit /register in web dashboard; sign up with a real email, verify via provider or development-only console.
2. Visit /onboarding/restaurant and finish Account → Restaurant → Service Defaults → Review. Save draft and reload between steps. New tenant and branch are stored; slug collision reports 409. Retrying final submit does not create a second tenant.
3. Owner arrives at /app/overview and sees real branch and staff counts, no synthetic revenue. Phase 3/4 checklist entries are not clickable.
4. Owner opens /app/staff/invitations and invites waiter; recipient receives a one-time secure URL. Recipient registers or signs in with matching verified email, accepts, and lands in proper role workspace.
5. Owner opens /app/staff/directory; modifies role/status and disables the waiter. API context now denies revoked member; attempting to disable/demote only active owner fails.
6. Owner visits /app/settings/restaurant, /localization and /security, edits and reloads to verify persistence. Manager cannot change owner-only settings.
7. Platform admin visits /platform/restaurants, sees tenant listing/detail metadata. Owner cannot access platform data; platform admin cannot read restaurant staff by default.

## Automated acceptance
- CI: typecheck all packages, shared/API unit tests, Next.js production build, migrate and seed on PostgreSQL 16, Phase1 identity integration, Phase2 tenant onboarding+staff+platform integration.
- Failure states: 401 unauthenticated; 403 wrong role/verified gating; 404 foreign tenant object; 409 duplicate slug/pending invitation/reused invitation; 503 mail delivery explicit.
- Cross-tenant user membership filtered server-side; not trusted from client-supplied tenant IDs.
- Pending browser/device verification: width 320/768/1280, RTL focus order and forms, screen reader, email provider and Android login.

## Explicit deferrals
Menu/ordering/kitchen/tables/billing/subscriptions plans are not exposed as clickable routes until their dedicated phases.
