# Phase 09 — Cashier Settlement & Real Receipts

**Source:** `docs/PRODUCT-SPECIFICATION-v1.md`, P09/PG-21–26, F11/F15, AT-011.

## Implemented in branch `phase-09-cashier-checks-ledger`

- Cashier web persistent sidebar **Open Checks / Transactions / Shift Summary / Receipts**; finance management under **Billing** for restaurant owners/managers; **Charges & Receipts** setting and customer read-only Bill route.
- Check created lazily from an active table visit, showing all accepted immutable order snapshots. Late rounds reconcile before split/payment locks. Charge snapshot is immutable per check; tax/service policy changes affect new checks only.
- **Single bill, equal split (2–10 shares, remainder last), item split** with explicit whole-quantity allocation for every line, server-side conservation checks, no change after tender.
- **Cash** with received amount and exact change, or **manual external transfer** explicitly confirmed outside DineFlow and requiring reference. No payment gateway claimed. Posted payments are append-only and idempotent; concurrent cashier check locks and share balance prevent overpayment.
- Cashier current and previous shift, opening float, cash sales/expected drawer/count/variance. A configurable per-restaurant threshold defaults to 50 AFN; a manager/owner must explicitly acknowledge excessive variance from the functional Billing → Shift Oversight screen. Tender and shift-close transactions use the same row lock so a closed shift cannot receive late cash.
- **Settle** only at zero due, all shares paid, all kitchen tickets marked served, no pending guest approvals. Atomic receipt creation from immutable prices and payment snapshot, visit close, cleaning table state, guest session revocation, audit.
- Browser receipt preview, 80mm print and **Save as PDF** through browser printing; reprint increments counter and audit without changing historical charges or payments. No invented third-party PDF generator.
- Transaction list grouped by tenant and restaurant-configured business-date timezone, method filter and pagination. Receipt search by table/check/number, business date filters and server-side 20/page pagination. Read-only guest Bill shows current visit charges/due, no cashier information or guest payment controls.
- Tenant and role authorization: cashier/owner/manager can access finance; guests only current visit Bill; waiters/kitchen cannot post tender; cross-tenant 404.
- Responsive finance controls, localized English, Dari RTL and Pashto RTL.

## Verification

GitHub CI: `pnpm typecheck`, `pnpm test`, `pnpm build:web`, real PostgreSQL migration+seed, existing P01–P06 integration and `apps/api/src/phase9-ci.ts`.

P09 acceptance tests cover new check/charge snapshot, 1-minor-unit rounding, item quantity conservation, equal split remainder, order lock, cashier shift requirement, concurrent cashiers, same-key replay, received cash/change, externally confirmed transfer, unsettled food & pending guest guard, receipt reconciliation, cleaning status, invalidation of guest sessions, tenant isolation, reprint and shift count.

**Required manual QA before pilot:** local browser, actual receipt printer/80mm paper, cash drawer and manager cash-variance procedure, 320–1280px responsive layout, phone/tablet guest Bill, three locales and failure/retry after timeouts.

## Explicit constraints

- **Dependency:** P07 guest-order code is merged into `main` as PR #7. P08 request-bill/service requests are still not implemented; cashier's Requested tab therefore does not invent data. P09 CI covers the cashier flow with real P07 guest sessions and pending approvals.
- Cashier **Payment Requested** tab truthfully shows an empty P08-dependent state. Other check tabs are functional.
- No refund/reversal/discount adjustment workflow until P10; posted entries cannot be deleted or edited. Transaction history currently includes only posted tenders, not reversals.
- No emailed receipts without a configured verified delivery provider.
- **No live payment gateway**; manual transfer confirmation is staff attestation.
- The guest Bill route requires an active table guest session; post-close read-only grace period remains a known gap.
- The guest profile/order history cannot access older table visits; by design, no prior patrons' private data is exposed.

## Local verification commands

```powershell
cd C:\projects\restaurant
git fetch origin phase-09-cashier-checks-ledger
git switch -c phase-09-cashier-checks-ledger --track origin/phase-09-cashier-checks-ledger
pnpm install
pnpm db:migrate
pnpm dev:api
# start other terminals in same folder: pnpm dev:web ; pnpm dev:mobile
```
