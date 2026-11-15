# DineFlow project state — 2026-11-15

Product source of truth: DineFlow Product Specification v1.0.
Development policy: Software Development Workflow V5.
New codebase confirmed: remote repository previously contained README only.

## Phase P01 — Foundation, app shells and identity
**Status: IMPLEMENTED — VERIFICATION PENDING**. Source foundation includes pnpm monorepo, Better Auth and PostgreSQL-backed membership context, three-language shared dictionary, Next.js sign-in/role-context workspace, Expo sign-in/role-context mobile, and secure role guard for restaurant requests. The identity, subscription and end-to-end device tests have NOT been executed against a real database.

**User-visible active routes**: /login, /dashboard; authenticated Expo sign-in/workspace/sign-out. The dashboard shell remains mounted during data loading. All unimplemented menu, orders, billing, kitchen, and platform-management routes are hidden; no dummy navigational entries.

## Local prerequisites
- Node 22+, pnpm 10+, PostgreSQL or Neon database.
- Copy root .env.example to apps/api/.env, fill DATABASE_URL, BETTER_AUTH_SECRET and BETTER_AUTH_URL.
- Configure mobile EXPO_PUBLIC_API_URL to an HTTPS tunnel accessible from the physical device (localhost on the phone does not reach your PC).
- Run pnpm install, then pnpm --filter @dineflow/api auth:migrate (Better Auth identity migration), pnpm db:setup, and (optional) pnpm seed:dev with a locally chosen DEMO_PASSWORD >=12 chars.
- Start pnpm dev:api and pnpm dev:web in separate terminals, or pnpm dev:mobile on a third terminal.
- Development demo identities after seed: waiter@demo.dineflow.local, cashier@demo.dineflow.local, platform@demo.dineflow.local. Password is DEMO_PASSWORD and is never committed.

## Notes / blockers
- Package resolution and TS/build/unit/device checks not performed in the repository-writing connector. Fresh lockfile needed after pnpm install.
- Auth CLI migration command must be confirmed against installed Better Auth version before deployment.
- HTTPS/tunnel/mobile cookie transport and Expo plugin compatibility must be tested on an actual device.
- P02 covers tenant self-onboarding and staff invitations. Demo seed is strictly development-only.
- Production sign-up path is disabled until safe P02 onboarding.
- Next local API rewrite assumes backend on port 4000; configure proxy for hosted deployment.

## Next
P02 — Restaurant onboarding, role invitations, first-run configuration, platform tenant review. Do not jump to P02 while blocking P01 real integration checks remain.
