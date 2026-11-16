# DineFlow Pilot — Operator Runbook (P14)
**Classification:** Operational checklist. Executing this document requires real restaurant representatives, physical devices and secure production-like infrastructure. None is provided by GitHub CI.

## 1. Define the pilot before provisioning
Record restaurant representative and phone via secure operations records (not pilot evidence text); date/time in Asia/Kabul, number of tables, menu and modifier complexity, peak tickets, printer model, Android device/OS, staffing, support owner, and exact settlement methods. Confirm authorized platform administrator and independent financial reviewer. Agree support hours, rollback owner and incident escalation contacts.

## 2. Safe launch preparation
- Keep test data in a **disposable** staging tenant; do not seed dummy users/payments into a real restaurant.
- Provision an isolated Postgres DB, private encrypted backup retention and persistent media storage (back both up); separate staging/prod keys. Verify production HTTPS API + web domains, trusted origins, email/Better Auth, database migrations and credentials before allowing staff to log in.
- Only deploy code/images previously tested in CI; pin exact commit. Perform a staging migration dry run, a real isolated restore rehearsal using `pnpm ops:rehearsal` and a previous-image rollback rehearsal. Do not run the restore command with a live restaurant target.
- Check `/api/health/ready` and operator-only `/api/health/operations`; confirm pager/outbox alert routing and who answers the phone. Outbox `delivered_at` is **in-app revision publication**, not phone push notification.
- Confirm the subscribed restaurant's trial/plan, staff limits and invoices; platform must independently verify manual payments. Train staff to use actual kitchen and cashier workflows. Confirm guest QR/PIN and old codes invalidated when a new table identity is issued.

## 3. Execute the 12 acceptance gates
Use the 12 gate definitions in `docs/PHASE-14-ACCEPTANCE.md`. Test each actual role on the targeted equipment, record pass/fail and reviewer observations in `/app/pilot`. Use references to approved evidence stored outside the app; never paste customer PII, bank account details, auth tokens or secret QR/PIN values into the text field. A failed gate blocks owner signature until fixed and retested. Run two unrelated restaurant tenants and prove no private data crosses.

## 4. Supervised shift
A restaurant representative supervises one complete service day. In a simulated rush before live trading and again during service, seat tables, scan real QR, create guest and waiter orders, prepare, hand off, request assistance and bill, split and settle checks, print receipts, correct/refund with supervisor approval, then close and clean tables. Preserve immutable receipts and reconcile:
- Actual cash opening float + collected cash - cash refunds - paid-out change = counted expected drawer.
- Daily net collected = posted payments - posted refunds; settled-check value is a **separate** metric and must not be double-counted.
- All kitchen tickets completed, no accepted order lost, blocked tables and incidents explained.
Perform offline/reconnect and failover tests only in controlled windows without risking active customer orders.

## 5. Escalation & incident procedure
**Stop new seating** if receipts differ from actual cash, kitchen delivery is uncertain, tenant access leaks, data is missing, or the database is unhealthy. Keep existing visits safely settleable and preserve financial/audit records. Declare P0 for data leakage, lost ticket or incorrect money; P1 for sustained inability to operate during service. Contact the named on-call owner; preserve UTC time range, request IDs and sanitized logs (no tokens or customer information). Do not overwrite financial records to "fix" a discrepancy. Restore from verified backup only under a reviewed plan and measured recovery objectives. A previous-image rollback must preserve additive schema and immutable ledgers.

## 6. Formal acceptance
The real **restaurant owner** records 12 PASS gates with actual evidence and signs in `/app/pilot` with their name, date, restaurant and known limitations. A separate **platform administrator** checks evidence and records HOLD or APPROVED in `/platform/pilots/:id`. Updating any gate voids the validity of both earlier signatures. Any unresolved P0/P1, incomplete device/finance/recovery test, or missing actual restaurant representative means HOLD.

Platform "signed_off" is **not** automated deployment approval and creates no entitlement/financial side effects. Explicitly record operator decision whether to schedule a second tenant and monitor the next two service days. Tag a production release candidate only after independent verification of all release gates and the real shift.

## 7. Post-shift
Review incident counts, outbox backlog, cashier mismatches, kitchen latency, real user feedback and blocked issues with restaurant staff. Log each defect, responsible engineer and retest evidence. Require a second pilot or renewed sign-off after changes to any essential flow. Never call an unobserved shift "completed" or invent positive feedback.
