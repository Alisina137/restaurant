# Restaurant Social

Mobile-first restaurant discovery and ordering platform for Afghanistan. The Side Phase adds adaptive customer/restaurant/admin workspaces, contributor permissions, Fresh Today limited offers, live kitchen availability and safer repeat ordering on top of Phase 4.

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
- `BETTER_AUTH_URL`: the exact origin open in your browser—normally `http://localhost:3000`; if Next.js starts on port 3001 because 3000 is occupied, use `http://localhost:3001` and restart the server. Use the exact HTTPS origin in production.

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

## Side Phase workflow

After applying the migration, a signed-in user can switch among Personal, owned restaurant, contributed restaurant and Admin workspaces when authorized. Owners can grant manager, kitchen, content-editor or custom permissions; the same permissions are enforced by server services and APIs.

Approved restaurants can:

- create categories, meals, sizes and extra groups;
- upload meal photos and link menu items from posts;
- define restaurant-operated delivery areas, fees, minimums and ETAs;
- start or pause ordering without hiding the restaurant page;
- publish time- and quantity-limited **Fresh Today** meal offers;
- communicate open, busy or paused kitchen state and preparation estimates;
- accept orders and move delivery or pickup through valid fulfillment states.

Customers can search restaurants and meals, favorite restaurants, save meals and private delivery addresses, receive a server-calculated price, place an idempotent order, cancel before acceptance and follow its status from **Orders**. **Order again** always creates a fresh quote and displays price or availability changes before confirmation.

When an approved restaurant edits its profile or photos, the current version stays public. The proposed version is stored separately; approval publishes it atomically, while rejection leaves the current public page unchanged.

Side Phase orders are paid directly to the restaurant on delivery or pickup. HesabPay is intentionally not simulated; verified online payment is Phase 5.

## Verification commands

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

See [Side Phase verification](docs/SIDE-PHASE-VERIFICATION.md) and [project state](docs/PROJECT-STATE.md) for exact results and remaining external checks.

## Current limits

HesabPay, subscriptions, online refunds, ratings, notifications and production deployment are later phases. Restaurants deliver their own orders; there is no platform driver network or live map. The application never marks an order paid without a verified payment integration.
