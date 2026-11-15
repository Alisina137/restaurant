# DineFlow Project State
**Product Specification:** v1.0 (2026-11-15). **Workflow:** Software Development Workflow V5.
**Repository:** Alisina137/restaurant. **Delivery branch:** phase-02-onboarding-staff.

## Phase 2 — Tenant onboarding, staff invitations, platform bootstrap
**Implementation status:** IMPLEMENTED — CI/real browser/device verification pending until the branch checks pass.

### Scoped delivered features (P02 F01/F02/F15/F16)
- Public owner account registration through Better Auth (verified email required for tenant creation). No role granted merely by account signup.
- Four-step owner setup: Account → Restaurant → Service Defaults → Review, with server-persisted drafts, unique slug, one location, tenant owner membership, initial settings and trial in a single database transaction; duplicate completion safe.
- Permissioned owner/manager staff Directory / Invitations / Permissions tabs. Edit/disable roles and memberships, protect last owner, immediately deny new API access for deactivated staff. Invitations: 48-hour expiry, one-time hash token, matching verified email, revoke, resend with rotating token.
- Production mail uses Resend API if configured. Clearly development-only console delivery available through DEV_EMAIL_DELIVERY=console; production cannot use it. Failed delivery is explicit with retry, never displays secrets in the UI.
- Owner settings: Restaurant / Localization / Security; manager read-only; validated server-saved values, audit trail, configurable manager invitation right. Locale Dari/Pashto/English; AFN default; customer ordering policy captured but ordering does not ship in this phase.
- Initial platform administrator oversight: restaurant metadata list/detail. No automatic admin access to a tenant's private orders.
- Restaurant setup Overview checklist; live staff count/pending invite count/location info. Menu and table stages deliberately not active until P03 and P04.
- Shared role-sensitive navigation extends only implemented destinations; persists through loading and RTL/LTR.

### Verification and known limits
- P01 GitHub Actions run 43722995802 previously passed PostgreSQL migration/seed, web build, typechecks, API smoke.
- P02 adds an isolated integration test for owner registration, draft resume, slug collision, idempotent creation, invitations and revocation, role permissions, tenant isolation, platform overview. CI config runs on phase branches, then production-build, PostgreSQL migration and real API integration.
- No local browser or Expo Go device test was performed by this execution environment. Confirm web responsive/RTL screen results on Windows and phone before calling P02 fully verified.
- External email provider/verified sender domain required for actual invite and email verification in production. No invented fallback or secret published. Trial is a configurable 14-day **proposed** pilot default; paid plans/billing remain P12.
- Production signup must be tested with configured email delivery before launch; keep secrets out of Git.

### Next approved phase
P03 — menu categories/items, modifiers, publication and availability. Preserve all P02 role/tenant security and navigation patterns.

### Commands
- From C:\\projects\\restaurant: git pull --ff-only origin main; pnpm install; pnpm db:migrate.
- pnpm dev:api, pnpm dev:web, pnpm dev:mobile in separate terminals; set environment per examples.
