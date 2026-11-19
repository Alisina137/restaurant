# DineFlow Phase 33 — Accountable Pilot Incident Register & Release Blockers

## Outcome
Give restaurant owners and managers a production-shaped pilot incident workflow that records observed defects during **real** supervised trials, assigns severity and a specific acceptance gate, tracks resolution/retests with immutable history, and prevents an existing signed-off pilot from remaining approved when a critical issue is reported or reopened.

**This phase does not perform the physical restaurant pilot or certify a release.** Only authorized human operators may record evidence; the application does not automatically pass a physical acceptance gate, close a cash discrepancy or notify external emergency response contacts.

## Role → screen → workflow → data

| Role | Screen | Actions | Authority |
| --- | --- | --- | --- |
| Restaurant owner | `/app/pilot` → **Pilot Incident Register** | Open P0/P1/P2 incidents, filter/search by status/severity, review immutable event history, resolve after human retest, reopen, review pilot blocker count, re-sign | `/api/pilot/incidents`, `/api/pilot/incidents/:id/:action`, protected gate signature API |
| Manager | Same restaurant pilot screen | Report an incident, inspect all scoped incidents/history, reopen a resolved regression; cannot resolve or sign off | Active tenant manager membership, server RBAC |
| Platform operator | `/platform/pilots/:id` | See unresolved P0/P1 **count**, hold or deny approval; never access the restaurant-only incident narrative via `/api/pilot/incidents` | Platform admin role with pilot status count |
| Kitchen, waiter, cashier, unrelated tenant | No incident administration access | Denied or tenant-isolated | Session/context and tenant row-scoped SQL |

### Incident lifecycle

1. Owner or manager records a severity **P0** (data leak, lost accepted order, incorrect money) or **P1** (sustained service interruption) or **P2** (noncritical follow-up) attached to one of the 12 pilot gate keys. Title 8–120 characters; detailed non-sensitive observation 25–1500 characters.
2. A transaction locks the tenant row, inserts an incident with status `open`, and inserts **append-only `opened` evidence** at version 1; audit metadata contains incident UUID, severity and gate key, not sensitive evidence prose.
3. The owner can mark `resolved` with explicit manually written retest description (at least 35 characters). Versioned, tenant-locked updates reject simultaneous/stale submissions. Managers cannot attest resolution.
4. An owner or manager may `reopen` a resolved issue with a reason of at least 25 characters; immutable `reopened` event records the new version. No deletion endpoints are exposed.
5. The list is server-side scoped and filtered **before** pagination, 10 per page, with real page count and oldest/newest timestamps; historical events are bounded to the latest 100 and are read-only. There is no editing of prior incident evidence.
6. **Release safety:** `GET /api/pilot` and platform review expose `incidents:{total,open,blocking}`. Any **open P0/P1** makes the pilot status **blocked**, prevents the owner from recording a *new* pilot sign-off, and prevents independent platform approval. Open P2 follow-ups can remain in the register without automatically blocking sign-off. Crucially, the SHA-256 signature snapshot incorporates the latest tenant incident event ID: **every new incident, resolution or reopening invalidates existing owner and platform signatures**, even if a former approval existed. Reapproval requires renewed human review and signatures.
7. This is separate from 12 existing gate reviews. Resolution does **not** silently change a previously failed gate to passed, touch financial ledgers, release an order or change a subscription.

### UI quality and safety
- Premium responsive register with aligned fields, severity tags, stage labels, 12 localized gate names, status/severity selectors, 10-row pages, retry/error/empty/loading states, full event timeline, owner-only resolution form, 48px touch controls, visible keyboard focus, RTL Dari/Pashto and LTR English.
- The preexisting owner Pilot Operations Readiness Cockpit, gate evidence and signoff UI remain stable. Platform reviewer sees blockers and cannot bypass server-side checks.
- Each form warns against pasting guest identity, payment details, QR/PIN, bank numbers, auth tokens or other credentials. Do not use free-text fields as confidential logs.

### Verification

- `pnpm pilot33:verify`: static API/UI/migration contracts, pure validator and English/Dari/Pashto content checks.
- `pnpm --filter @dineflow/api exec tsx src/phase33-ci.ts` against disposable seeded PostgreSQL: RBAC and two-tenant isolation, invalid field filtering, P0 creation and fingerprint invalidation, refusal to sign all 12 passing gates while P0 remains open, 12-item server pagination and severity filter, four simultaneous resolution attempts with only one success, P2 follow-up nonblocking, owner/platform re-sign only after P0 resolution, instant invalidation when P0 is reopened, all three immutable events and SQL audit logs.
- Full GitHub CI continues Phase 1–32 tests, TypeScript across all packages, web production build, DB migrations and controlled P31 20/10/200 load rehearsal.
- Migration `0016_phase33_pilot_incidents.sql` adds only two new tables and indexes with PostgreSQL check constraints; does not rewrite existing kitchen, finance or pilot evidence.

### Manual pilot — still not completed
Record a genuine P0/P1 during a supervised restaurant drill, verify **operator manually stops new seating and escalates** using the named on-call procedure outside DineFlow. Have the owner/manager independently read incident history, verify no cross-restaurant leakage, document retest and resolve. Check that the existing platform approval is invalid and that both reviewers must re-sign. Validate all 12 physical acceptance gates: kitchen tablets, low-end Android, real receipt printer, financial drawer, backup restore, actual device/network p95 and complete supervised shift.

A passed simulated CI audit is **not** an actual production pilot, external call, bank reconciliation, human observation or deploy authorization.

## Next phase
Phase 34 should use actual pilot defects, operator feedback and independent financial/network evidence to prioritize the remaining launch blockers.
