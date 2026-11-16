# DineFlow P10 acceptance — reviewed financial corrections

Source of truth: `docs/PRODUCT-SPECIFICATION-v1.md` P10, F10/F12, AT-012, BR-009/018/021/027/035.

## Scope delivered

- **Cashier and management:** `/cashier/adjustments` and `/app/billing/adjustments`, linked from finance check details. The workspaces expose request forms, review queue, real statuses, reason, actor and time, and authorized refund execution.
- **Assigned waiter mobile:** Order Details supports requesting a whole-round cancellation while the ticket remains New. The waiter supplies a required reason, retries safely with an idempotency key, sees manager review status, and cannot act on another waiter's visit. Owner/manager approval uses the same audited correction workflow. Partial item quantity corrections and cancellation after kitchen preparation are intentionally not silently edited and remain outside this safe P10 round-void route.
- **No destructive historical edits:** accepted rounds remain recorded; only a round that kitchen has not started may be marked `voided`, with a corresponding voided ticket/line status, outbox event, and audit trail.
- **Before tender:** item-round void and fixed-amount discount require an open, unsplit, unpaid check. Approval by another owner/manager applies the correction atomically, recalculates charges and check share, and increments the check version. Discounts reduce the taxable/service base while source menu snapshots remain unchanged.
- **After settlement:** partial/full refund must be requested, approved by another manager, and actually returned by a separate cashier with an active shift. A separate `finance_refunds` reversal record carries the original check and shift. Posted `check_payments` and issued `check_receipts` are immutable. The refund may not exceed cumulative originally posted tender, including a bound per tender method.
- **Safety:** tenant/location scope, request-key idempotency, version conflict detection, request and decision audit, amount checks, supervisor segregation, shift lock, cash drawer expected balance net of cash refunds, and no automated bank integration.
- **Pending correction guard:** a pending/approved discount or void blocks split, new tender, and settlement until the correction is decided. New orders remain permissible until a payment/split lock; that may invalidate the old approval request by version, requiring a fresh correction request.

## Local validation commands

```powershell
cd C:\projects\restaurant
git pull --ff-only origin main
pnpm db:migrate
pnpm typecheck
pnpm test
pnpm build:web
```

For **disposable CI/development database only**, run `pnpm seed:dev`, start the API and execute `pnpm --filter @dineflow/api exec tsx src/phase10-ci.ts` after Phase 9 integration. The GitHub verification workflow runs this after the P01–P09/08 regression suite.

## Manual pilot acceptance

1. Create a fresh visit and send one kitchen round. From the assigned waiter mobile Order Details, request cancellation with a reason, verify manager review and the applied/rejected status; another waiter must not access the round. Then In cashier adjustments, request a void, approve from a different manager, verify ticket disappears from active kitchen queue and immutable activity remains. Attempt the same after Starting preparation and verify rejection.
2. Request a discount, confirm version check, totals and the amount reflected in the guest bill. Submit duplicate request key with same/different payload and confirm replay/conflict.
3. Attempt splitting and tender while a correction is pending; see a clear conflict. Reject the request and retry safely.
4. Settle a fully served visit, verify immutable receipt, then request partial refund. Manager approves, another user with a valid open cashier shift confirms cash returned or **externally verified** transfer.
5. Replay the refund request and verify one reversal row and a negative Refunds entry in the transaction-history view. Attempt exceeding cumulative paid or tender-method amount; confirm rejection. Confirm the original receipt and posted payments do not mutate.
6. Verify shift expected cash subtracts cash refunds, report history makes reversals clear, and denied roles/another restaurant cannot read or change sensitive records.
7. Test English, Dari and Pashto on desktop/mobile-width browsers; verify RTL ordering, labels, error states, async loading and stable sidebar.
8. Run concurrent reviews/refunds, rejected applications, expired sessions, network retry, second cashier shift and unusual money rounding through a supervised pilot before production.

## Limitations

Automated payment-provider reversal and cash drawer hardware integrations are **not** part of this phase. The refund records are internal reconciliation, **not proof** of a bank refund. Prior printed receipts are never rewritten; show refund/reversal separately. Browser/Expo physical-device QA and supervised money-handling approval remain outstanding until performed.
