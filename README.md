# Restaurant Social

Mobile-first restaurant discovery and ordering platform for Afghanistan. Phase 2 includes secure accounts, restaurant onboarding, admin review, public approved profiles and staff access controls.

## Requirements

- Node.js 20.19 or newer
- npm
- A development Neon PostgreSQL database
- SMTP credentials for real email delivery
- Optional private S3-compatible bucket for restaurant images

## Local setup

Use PowerShell from the project folder:

```powershell
npm install
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

Restaurant details work without image storage. To enable private photo uploads, configure all `S3_*` variables in `.env.local`. Uploads are decoded, size-limited, metadata-stripped, resized and re-encoded as WebP. The bucket must not be public; images are served through an authorization-aware application route.

## Verification commands

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

See [Phase 2 verification](docs/PHASE-2-VERIFICATION.md) and [project state](docs/PROJECT-STATE.md) for exact results and remaining external checks.

## Current limits

Menus, posts, orders, HesabPay, subscriptions and delivery status are later phases. The current interface labels online ordering unavailable and does not simulate payments, ratings or orders.
