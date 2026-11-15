# DineFlow — Restaurant Ordering & Management SaaS

A role-aware, multi-tenant SaaS foundation for restaurant ordering. Source of truth: **Product Specification v1.0** and **Software Development Workflow V5**.

## Structure
- apps/api — Express 4 (port 4000), Better Auth, Drizzle/PostgreSQL, multi-tenant role guards.
- apps/web — Next.js (port 3000) for owner/manager, kitchen, cashier and platform administration.
- apps/mobile — Expo SDK 57 waiter app (Android/iOS).
- packages/shared — role access rules, language dictionary, shared types.

## Development setup (Windows PowerShell)
Run these commands **from your existing restaurant IDE folder**.

If it is an empty directory not yet cloned:
```powershell
cd C:\projects\restaurant
git clone https://github.com/Alisina137/restaurant.git .
```
If already cloned and tracking main:
```powershell
cd C:\projects\restaurant
git pull --ff-only origin main
```
Then:
```powershell
corepack enable
pnpm install
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.local.example apps\web\.env.local
Copy-Item apps\mobile\.env.example apps\mobile\.env
```
Fill in your **local** PostgreSQL DATABASE_URL and BETTER_AUTH_SECRET (32+ random characters) in apps/api/.env. Do not share or commit secrets. Update BETTER_AUTH_URL and TRUSTED_ORIGINS for actual reachable API/web hosts. If the physical phone uses Expo Go, run `ngrok http 4000` separately and set apps/mobile/.env EXPO_PUBLIC_API_URL to the public HTTPS tunnel URL. Restart Expo after changing this variable.

Create tables and optionally seed **development-only** identity records:
```powershell
pnpm db:migrate
# Set DEMO_PASSWORD (12+ chars) and DEMO_*_EMAIL fields in apps/api/.env first.
pnpm seed:dev
```

Start API and web in **separate** PowerShell windows:
```powershell
pnpm dev:api
pnpm dev:web
```
Optionally start Expo Go:
```powershell
pnpm dev:mobile
```
Web: http://localhost:3000 • API: http://localhost:4000/api/health • mobile: scan Expo QR.

### Phase 1 guardrails
- This phase has no production restaurant signup; staff accounts must be invited in P02.
- The explicit development seed creates sample identities and a demo restaurant, not simulated production data.
- No live menu, tables, order or payment screens are available yet; links are hidden by design.
- To verify: `pnpm typecheck`, `pnpm test`, `pnpm build:web`.
- See docs/PROJECT-STATE.md and docs/PHASE-01-ACCEPTANCE.md for status and acceptance evidence.
