# DineFlow — multi-restaurant ordering SaaS

A new restaurant platform for waiter-assisted dine-in orders and customer self-service QR menus, backed by a tenant-aware kitchen/cashier/admin system. Implementation follows **DineFlow Product Specification v1.0** and **Software Development Workflow V5**.

## Current state
**Phase P01 source committed; actual install/build/database/device verification pending.** Only real implemented entry/profile workspaces are visible. No menu or kitchen screen is claimed ready.

## Workspace
- `apps/api`: Fastify + Better Auth + PostgreSQL membership context.
- `apps/web`: Next.js responsive sign-in and role landing, persistent shell.
- `apps/mobile`: Expo staff sign-in and shell.
- `packages/core`: locales, roles and shared copy.
- `docs/PROJECT-STATE.md`: setup, precise verification status and next phase.

## Local start
Install Node.js 22+, pnpm 10+. Run `pnpm install`. Copy `.env.example` to `apps/api/.env` and set your own database and secret. Run `pnpm --filter @dineflow/api auth:migrate` and `pnpm db:setup`; optional development seed `pnpm seed:dev` after setting DEMO_PASSWORD locally. In separate terminals: `pnpm dev:api`, `pnpm dev:web`, `pnpm dev:mobile`. Expo Go needs an externally reachable API URL, not localhost.
