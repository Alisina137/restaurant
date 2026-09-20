# Side Phase verification

The Side Phase adds adaptive workspaces, contributor permissions and practical local-ordering features on top of Phase 4. It does not add HesabPay or paid subscriptions.

## Automated result

Verified locally on 2026-09-20:

- `npm run typecheck` — pass
- `npm run lint` — pass with zero warnings
- `npm test` — pass, 21 tests across 6 suites
- `npm run build` — pass using Next.js 16.3.5
- `npm audit --audit-level=high` — no high or critical advisories; 4 moderate advisories remain in development-only Drizzle tooling, and the suggested forced fix is intentionally not applied because it is breaking

The Side Phase integration suite proves server-enforced contributor presets/custom permissions, description-only content editing, admin separation from restaurant membership, private saved-address isolation, one default address, real favorites/saved meals, Fresh Today special pricing, atomic no-oversell placement and one-time stock restoration. Existing suites continue to prove authentication, tenant isolation, safe profile revisions, ordering totals, idempotency and legal fulfillment transitions.

The managed implementation workspace could complete the production build but could not bind the local Next.js development server because its network-interface lookup returned `uv_interface_addresses ... Unknown system error 1`. Browser and physical-device review therefore remains an explicit local acceptance step rather than a claimed result.

## Apply and run after merge (PowerShell)

Back up or branch the development Neon database first, then run:

```powershell
cd C:\projects\restaurant
git switch main
git pull origin main
npm ci
npm run db:migrate
npm run dev
```

Migration `drizzle/0003_fixed_wind_dancer.sql` adds contributor permissions, restaurant operating state, Fresh Today offers, customer favorites/saved meals/addresses and order inventory snapshots. Run it through the migration command; do not paste or edit the SQL manually.

## Role and workspace walkthrough

| Actor       | Expected workspace and navigation                                                   | Important denial check                                     |
| ----------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Visitor     | Discover, Explore, Restaurants, Sign in and Join                                    | Cannot save or order without signing in                    |
| Customer    | Personal dashboard, saved items, orders and addresses                               | Cannot read another customer's address/order               |
| Owner       | Personal plus every owned restaurant workspace and full restaurant tools            | Cannot approve the owner's own restaurant review           |
| Contributor | Personal plus assigned restaurant workspaces and only granted tools                 | Hidden and direct API access both deny missing permissions |
| Admin       | Personal plus Admin approvals, restaurants, users, reports, order support and audit | Is not automatically a member of any restaurant            |

Test one user who owns one restaurant and contributes to another. Switch among Personal and both Restaurant workspaces, refresh the browser, and confirm the active choice remains valid. Remove the contribution in another session, refresh, and confirm the stale workspace falls back safely to Personal.

## Ordering walkthrough

1. As an owner, configure open/busy/paused kitchen state, preparation time and independent delivery/pickup availability.
2. Mark one meal sold out and confirm it cannot be newly quoted. Restore it for the next checks.
3. Create a published post linked to that meal and enable Fresh Today with a short active window, special price and quantity of one.
4. Open the public feed/menu in two customer accounts. Confirm the special price and real remaining count appear.
5. Place the offer order from one account. Confirm the second account receives an unavailable/changed response rather than a second order.
6. Reject or cancel the first order before fulfillment and confirm the unit becomes available once, not repeatedly.
7. Favorite the restaurant, save a meal, add two saved addresses and make one the default. Confirm these remain private to that customer.
8. Complete an ordinary order, choose **Order again**, inspect the new server quote and any price/offer-expiry warning, then explicitly confirm. It must never create an order from an old receipt without repricing.

## Responsive and localization walkthrough

- Check 360 px, a larger phone, tablet and desktop. Mobile has four primary actions plus **More**, no horizontal overflow and usable touch targets.
- Switch among English, Dari and Pashto. Confirm document direction becomes RTL for Dari/Pashto and that prices remain clearly labeled in AFN.
- Enable Low data, refresh, and confirm the preference remains active and nonessential feed/menu imagery and motion are reduced.
- Verify the workspace switcher and role-specific badges with keyboard navigation and a screen reader label.

## External checks still required

- Apply the migration to the project's development Neon branch before production and retain a recoverable backup/branch.
- Verify SMTP and private S3 uploads in the configured environment.
- Complete the browser/device walkthrough above on the target phones and browsers.
- Have fluent reviewers check Dari and Pashto wording; the code provides RTL and message catalogs, not certified translations.
- Exercise concurrency against Neon as well as the disposable integration database.

HesabPay and subscription charging remain Phase 5 work. Current orders stay explicitly unpaid/payment-on-delivery or pickup; never present them as online-paid.
