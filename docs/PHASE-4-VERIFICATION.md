# Phase 4 verification

Phase 4 delivers menus and restaurant-managed ordering without claiming a live online payment integration.

## Automated result

Verified locally on 2026-09-20:

- `npm run typecheck` — pass
- `npm run lint` — pass with zero warnings
- `npm test` — pass, 18 tests across 5 suites
- `npm run build` — pass using Next.js 16.3.5
- `npm audit --audit-level=high` — no high or critical advisories; 4 moderate advisories remain in development-only Drizzle tooling and the suggested force fix is intentionally not applied because it is breaking

The order integration test proves server-owned prices, delivery fee calculation, tenant isolation, idempotent order retries, legal delivery transitions and unpaid payment state. The restaurant lifecycle test proves that current approved details remain public during draft, pending and rejected revisions, and only change after approval.

## Apply and run (PowerShell)

```powershell
git pull origin main
npm ci
npm run db:migrate
npm run dev
```

Migration `drizzle/0002_eager_scarecrow.sql` creates the Phase 4 catalog, delivery, quote, order, event and restaurant-revision records. Run it once through the migration command; do not paste the SQL manually.

## Acceptance walkthrough

1. Sign in as an approved restaurant owner and open **Workspace → Manage menu & orders**.
2. Add a category, meal, optional sizes/extras and a meal photo.
3. Open **Delivery setup**, add an active area, fee, minimum and ETA, then return to the menu and start taking orders.
4. Open the public restaurant page at mobile width. Add a configured meal, choose delivery or pickup, provide the requested details and place the order.
5. Open **Orders** as the customer and confirm the order is awaiting acceptance and explicitly unpaid.
6. Open the restaurant order queue. Accept it, start preparing, move it out for delivery (or ready for pickup), then complete it.
7. Edit the approved restaurant name, description or photo and submit it. Confirm the old page remains public. Request changes as an administrator and confirm the old page still remains. Resubmit and approve; confirm the new details appear only then.

## External checks still required

- Test the migration against the project’s development Neon branch and keep a backup before production migration.
- Verify S3 restaurant, post and meal images using the configured private bucket.
- Exercise the full journey at 360 px, a larger phone, tablet and desktop in the target browsers.
- Test real SMTP verification/recovery separately; ordering requires a verified account.
- Define restaurant operating/support policies before real customers place orders.

HesabPay is not part of this phase. Phase 4 uses payment on delivery or pickup and leaves `paymentStatus` as `unpaid`. Do not present orders as paid until Phase 5 verifies provider callbacks, amount, currency, reference and replay safety.
