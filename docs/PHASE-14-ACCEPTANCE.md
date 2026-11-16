# Phase 14 — Controlled pilot readiness and release evidence

**Code-delivery status:** Pilot preparation tooling implemented. **Actual restaurant pilot: NOT PERFORMED.**
**Production approval: NOT GRANTED.** Do not interpret a CI "signed_off" test using disposable fixtures as a real restaurant's acceptance.

## Delivered in code
- Restaurant `/app/pilot`: owner submits append-only PASS/FAIL reviews for twelve explicitly named operational gates with free-text evidence (25–1500 characters), manager read-only; owner signs only when every gate has a current passing review.
- Platform `/platform/pilots`: one scoped restaurant per review, no customer order or check access. Platform administrator can HOLD or counter-sign owner evidence; decisions are append-only and audited.
- Latest gate result wins, and each owner/platform signature stores a SHA-256 snapshot of all latest gate event identifiers. Changing a gate **automatically invalidates the old sign-offs**. A release is signed off only when complete, current owner signed, and an independent platform approval references that owner sign-off.
- Serialized tenant row locks prevent concurrent signing and evidence changes from racing each other. Credentials, PINs, bank information and personal customer data must NOT be pasted in evidence; the API stores text and audit metadata only.
- Tenant isolation on every report, owner-only evidence, explicit independent platform role checks, 404 for unknown tenant, no deletion or alteration of evidence history through user endpoints.
- CI runs Phase 14 API acceptance against disposable seeded PostgreSQL: missing gates, untrusted actor, cross-tenant, invalid evidence, owner sign-off, platform HOLD/APPROVE, stale signatures after a new failed review, audit.
- Runbook: `docs/PILOT-RUNBOOK.md`. No payment gateway, automated cloud deployment, external backup setup or release token is fabricated.

## Mandatory real-world sign-off — still outstanding
| Gate | What must be demonstrated and linked in the owner evidence |
|---|---|
| roles | Seven authorized role journeys, revocation, and second-tenant isolation |
| qr | Printed QR, rotated/wrong/expired PIN, verified guest retries |
| orders | Waiter/guest order → kitchen → served, split/additional rounds and reconnect |
| cash | Actual cashier drawer and change; split payments, approved refund, immutable receipt, reports CSV |
| billing | Two restaurant subscriptions, manually verified payment and suspension/grace |
| languages | All seven roles in Dari RTL, Pashto RTL and English LTR |
| devices | Physical low-end Android, kitchen terminal, receipt hardware, browsers at 320–1280px |
| accessibility | Keyboard-only core workflows, screen reader labels, contrast and touch targets |
| reliability | Measured rush, outbox replay, disconnected networks and two-tenant load |
| backups | Isolated PostgreSQL and media restore, retention, RPO and RTO measured |
| rollback | Staging migration/rollback, monitored incident drill, on-call escalation |
| shift | One entire supervised, fully reconciled shift signed by the restaurant representative |

No item can truthfully be set to PASS based only on simulated database tests. Record failures, resolve and retest before owner sign-off and platform counter-sign. The sign-off is a record of accountable assertions, not an external certification.

## Definition of done vs pilot launch
The software code can be merged after green CI; pilot deployment and commercial launch require these manual gates plus operator confirmation of HTTPS domains, platform admin identity, database/media backups, payment verification, kitchen printer, staff training and incident response. `/api/health/ready` and platform-only `/api/health/operations` are live sources; the new page does not automatically start/stop deployments.

**Result:** code delivery complete when CI is green; final pilot/release **blocked** until an actual restaurant performs and signs off the manual gates.
