# Restaurant Social

Mobile-first restaurant discovery and ordering platform for Afghanistan. Phase 3 adds a real restaurant publishing network: daily photo/text posts, Discover and Following feeds, restaurant search and filters, follows, likes, saves, reporting and administrator moderation.

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

## Phase 3 workflow

After applying the migration, an approved restaurant can open its workspace and select **Manage posts**. Owners and staff can create drafts, add up to four photos and publish or archive updates. Customers can:

- browse the paginated Discover feed or their Following feed;
- search approved restaurants by name, area, city and cuisine;
- filter by open status, delivery and pickup;
- follow restaurants and like, save or report posts;
- revisit saved posts from the account page.

Administrators review open content reports from the admin dashboard. Menus and meal-linked post actions intentionally remain inactive until Phase 4.

## Verification commands

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

See [Phase 3 verification](docs/PHASE-3-VERIFICATION.md) and [project state](docs/PROJECT-STATE.md) for exact results and remaining external checks.

## Current limits

Menus, orders, HesabPay, subscriptions, delivery workflow and ratings are later phases. The current interface labels online ordering and meal search as upcoming and does not simulate payments, ratings, meals or orders.
