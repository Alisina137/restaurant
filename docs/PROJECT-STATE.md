# DineFlow Project State
**Product Specification:** v1.0, dated 2026-11-15. **Workflow:** Software Development Workflow V5.
**Repository:** Alisina137/restaurant. This repository was empty when P01 started.
**Current phase:** P01 — Foundation, app shells and identity.
**Status:** Source implemented, external dependency/database/device verification pending.

## Phase 1 baseline
- pnpm monorepo with independent API (Express, PostgreSQL, Drizzle, Better Auth), Next.js 16 web and Expo SDK 57 waiter mobile.
- Shared role/landing/locale rules; translations for Dari, Pashto, English; responsive web shell and native Home / More.
- Database tables for identity, memberships, preferred tenant, language and audit; migration committed.
- Public signup blocked. Developer-only bootstrap script gated from production, with credentials provided through local env.
- Web sign-in, workspace selection, per-role home, account and sign-out; waiter Expo sign-in/home/profile/sign-out.
- API session check on every protected call; direct access never accepts user-provided role/tenant values; tenant access check.
- Unreleased restaurant, kitchen, guest and finance operations are NOT active navigation yet.

## Acceptance/verification
- AT-001: role landing, restricted tenant, sign-in/sign-out and session expiry require live DB and device/browser.
- Static tests: shared RBAC/locale rules and tenant access.
- CI: install, TypeScript, unit and web production build; may be blocked until package lock and external services available.
- UI: design tokens and RTL/LTR styles applied; real device/browser visual audit pending.

## External setup (never commit credentials)
- DATABASE_URL (PostgreSQL), BETTER_AUTH_SECRET, BETTER_AUTH_URL, TRUSTED_ORIGINS.
- Optional DEMO_PASSWORD and development identity email addresses for seed.
- EXPO_PUBLIC_API_URL must be reachable from actual phone (e.g., HTTPS ngrok URL to API:4000).

## Next approved scope
P02 — restaurant onboarding, location, staff invitation/acceptance, initial platform controls. Preserve P01 functioning shells and permissions.

## Product change boundaries
Working brand DineFlow and Afghanistan/AFN locale defaults remain proposals, not commercial/legal confirmations.
Keep production onboarding disabled until P02's verified flow is implemented. Never enable public staff registration.
