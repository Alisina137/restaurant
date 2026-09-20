# Restaurant Social

Mobile-first restaurant discovery and ordering platform for Afghanistan. Phase 4 adds restaurant menus, meal options, delivery zones, secure server-priced checkout, customer order history and restaurant-managed fulfillment.

## Requirements

- Node.js 20.19 or newer
- npm
- A development Neon PostgreSQL database
- SMTP credentials for real email delivery
- Optional private S3-compatible bucket for restaurant and post images

## Local setup

Use PowerShell from the project folder:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Open `.env.local` and configure at least:

- `DATABASE_URL`: the connection URL for a development Neon database.
- `BETTER_AUTH_SECRET`: a unique high-entropy value of at least 32 characters. A PowerShell generator is shown below.
- `BETTER_AUTH_URL`: `http://localhost:3000` locally; the exact HTTPS origin in production.

```powershell
$Bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($Bytes)
[Convert]::ToBase64String($Bytes)
```

Never commit `.env.local`. Apply the database migration and run the app:

```powershell
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`.

During development, `MAIL_MODE=file` saves verification and reset messages in `.local-mail`. Read them with:

```powershell
npm run mail:inbox
```

This local mail mode is rejected in production. Configure SMTP before deployment.

## Create the first administrator

Register an account and verify its email first, then run:

```powershell
npm run admin:grant -- your-email@example.com
```

The script refuses to grant administrator access to an unverified account. Administrator decisions are audited, and an administrator cannot approve a restaurant they belong to.

## Image uploads

Restaurant details and text posts work without image storage. To enable private restaurant and post photo uploads, configure all `S3_*` variables in `.env.local`. Uploads are decoded, size-limited, metadata-stripped, resized and re-encoded as WebP. The bucket must not be public; images are served through authorization-aware application routes.

## Phase 4 workflow

After applying the migration, an approved restaurant can open its workspace and select **Manage menu & orders**. Owners and staff can:

- create categories, meals, sizes and extra groups;
- upload meal photos and link menu items from posts;
- define restaurant-operated delivery areas, fees, minimums and ETAs;
- start or pause ordering without hiding the restaurant page;
- accept orders and move delivery or pickup through valid fulfillment states.

Customers can search restaurants and meals, configure a meal, choose delivery or pickup, receive a server-calculated price, place an idempotent order, cancel before acceptance and follow its status from **Orders**.

When an approved restaurant edits its profile or photos, the current version stays public. The proposed version is stored separately; approval publishes it atomically, while rejection leaves the current public page unchanged.

Phase 4 orders are paid directly to the restaurant on delivery or pickup. HesabPay is intentionally not simulated; verified online payment is Phase 5.

## Verification commands

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

See [Phase 4 verification](docs/PHASE-4-VERIFICATION.md) and [project state](docs/PROJECT-STATE.md) for exact results and remaining external checks.

## Current limits

HesabPay, subscriptions, online refunds, ratings, notifications and production deployment are later phases. Restaurants deliver their own orders; there is no platform driver network or live map. Phase 4 never marks an order paid without a verified payment integration.
