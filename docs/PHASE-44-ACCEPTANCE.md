# DineFlow Phase 44 — Final Release Packet and Supervised GO/HOLD

**Roadmap status:** The planned **44 engineering phases are implemented** once Phase 44 passes CI and merges. This statement does **not** mean DineFlow has been deployed, independently verified in a live restaurant, or commercially approved. **Default release decision: HOLD.**

## What Phase 44 delivers

1. A GitHub Actions release-candidate evidence **packet** tied to the exact Git commit checked by Phase 43's live production-build smoke (not an assumed main branch tip). It identifies the GitHub run/attempt and the 58 successful disposable-API web/role probe results.
2. A human operator checklist with **16 mandatory unverified physical/financial/operational gates** and accountable roles. No gate is pre-checked, no receipt or bank proof is invented, and there is no command that automatically grants GO.
3. A **fail-closed** validation of evidence: wrong SHA, failed/missing/different expected probe, stale/missing phase43 input, attempted physical certification, bad provenance or execution outside disposable GitHub CI means HOLD / nonzero exit.
4. Two **secret-free** files created in GitHub CI after all existing tests and the 200-ticket synthetic rehearsal succeed: `dineflow-phase44-packet.json` and `dineflow-phase44-operator-checklist.md`. These are retained as a GitHub Actions artifact for 14 days. It is an unsigned CI artifact, **not** a digitally signed software supply-chain attestation or independent release approval.

This phase makes **no new database migrations, authentication role grants, payment transactions, hosted deployment, operational backup restore, or user-facing screens**. It does not run any expensive mutation on your real data. Existing restaurant operations remain unchanged.

## Evidence generation and controls

At the end of the `.github/workflows/verify.yml` job, a dedicated `pnpm release44:packet` step reads the previously generated `$RUNNER_TEMP/dineflow-phase43-rc.json` and compares its `commit` to both `git rev-parse HEAD` and `GITHUB_SHA`. It verifies **all 58 check IDs, order, expected statuses and observed statuses** against the current Phase 43 route/role inventory. A mixed-commit or partly green CI record will **not** produce a positive packet.

The builder only runs when `CI=true`, `GITHUB_ACTIONS=true`, `NODE_ENV` is not production, and `DATABASE_URL` identifies the **localhost disposable `dineflow_ci`** database. It reads no production data and performs no network requests. Its JSON/Markdown output is built from a strict allowlist; **no session cookies, passwords, raw URLs, bank references, customer data, receipt contents or response bodies** are copied. The local packet is written with restrictive permissions, and the uploaded Actions artifact contains no human approvals.

**Commands for development and review:**

```powershell
cd C:\projects\restaurant
pnpm phase44:verify
pnpm typecheck
pnpm test
pnpm build:web
```

**Note:** `pnpm release44:packet` is deliberately **CI-only** and must not be used on a local computer or a production database. To see the real output, open **GitHub → Alisina137/restaurant → Actions → Verify DineFlow → a successful Phase 44 run → Artifacts → DineFlow Phase 44 operator packet**. Compare its commit against the actual deployed artifact SHA/digest before planning a release.

The existing Phase 34 remote staging probe is **separate**:

```powershell
pnpm ops:preflight --api-origin https://your-real-staging-api.example --web-origin https://your-real-staging-web.example
```

Substitute your **own actual staging HTTPS domains**, not the examples. Do not attempt remote preflight until real staging exists. It is a read-only probe; a pass still does **not** validate restaurant cash or actual kitchen receipt printing.

## Mandatory human release workflow

The operator packet contains an **unverified** row for every item below. For each row, designate a responsible human, timestamp, actual observed result and private non-sensitive evidence pointer in an **access-controlled, separately stored operator log**. Do not put PINs, bank details, customer identifiers or secrets into CI artifacts, issues or public links.

| Area | Human evidence required | GO/HOLD consequence |
| --- | --- | --- |
| Build provenance | Actual staged/production app image digests match reviewed git SHA; schema migrations and compatible rollback identified | Mismatch → HOLD |
| Remote staging | Phase 34 independent HTTPS preflight passes after rollout, sessions/TLS/headers checked | Unavailable/fails → HOLD |
| Guest | Real table QR/PIN scanned on an actual device; invalid PIN blocked; order reviewed | Missing → HOLD |
| Waiter | Expo Go Android login, offline/dropped-response pending key, confirmed receipt and safe same-key replay | Duplicate ticket or lost evidence → P0/HOLD |
| Kitchen | Actual order arrival, ticket changes, pickup acknowledgement and screen/print observations | Committed but missing ticket → P0/HOLD |
| Multiple devices | Two live tablets, table handoff/assignment, a complete supervised shift | Conflict → HOLD |
| Cash | Physical float, tender/change, refund, closing drawer, and discrepancy reconciliation | Unexplained difference → HOLD |
| Transfers | Actual bank/provider independent confirmation and reconciliation | Unverified provider → HOLD |
| Receipt/refund | Real printed receipts match immutable snapshots, later refunds preserved and independently reviewed | Misstatement → P0/HOLD |
| Recovery | Isolated PostgreSQL restore, tested compatible app rollback, production-safe forward migration | Failed/no rehearsal → HOLD |
| Operations | Real alerting/on-call, outbox backlog, critical incident drill and recovery | Unowned P0/P1 → HOLD |
| Languages/accessibility | Dari, Pashto RTL, English, keyboard/screen reader/low bandwidth and device usability | Unverified → HOLD |
| Supervised service shift | Real restaurant staff complete shift from opening table through kitchen, cashier and closing | Missing → HOLD |
| Critical incidents | P0/P1 open incident count zero, append-only incident history preserved | Any open P0/P1 → HOLD |
| Owner signature | Owner has independently tested and attested all **12 current pilot gates**; correct evidence fingerprint | Stale/incomplete → HOLD |
| Platform approval | Separate authorized reviewer independently issues explicit GO/HOLD for current owner signature | No independent approval → HOLD |

The application itself records owner gate evidence under `/app/pilot` and a platform review under `/platform/pilots/:id`. The Phase 41 action board shows missing/stale gates and P0/P1 blockers, but it **does not** verify physical cash or printer output. CI-only test signatures and sample evidence are not substitutes for actual restaurant observations.

### Safe release and rollback sequence

**Before:** choose the exact reviewed application image SHA/digest; capture full recoverable encrypted backups; test a restore in an **isolated** environment; confirm additive migrations and compatibility with rollback image; ensure on-call, restaurant manager, cashier and platform approver know the decision procedure. Keep external evidence private.

**Pilot:** deploy to separate staging credentials/tenant, run Phase 34 remote preflight, rehearse real QR → waiter → kitchen → cashier → receipt/refund → close → audit, include network outage/restart, verify manual financial counts and transfer confirmations, and log P0/P1. Only after an owner and an independent platform operator sign the **current** evidence can a human make an explicit release decision.

**If HOLD or a serious incident:** stop new visits if necessary, preserve accepted order/financial/audit rows, give staff a safe manual continuity process, keep old application image and backups intact. Do not reissue payments, delete accepted tickets or rewrite immutable receipts to make metrics green. Investigate with authorized operators; restore only to isolated test systems unless an independently authorized disaster recovery procedure explicitly requires more. Roll back to a tested schema-compatible image, recheck active orders, kitchen tickets, receipt and cashier totals, and record a new review after incidents are closed.

**After an authorized release:** repeat external preflight, monitor readiness/outbox and actual physical kitchen/settlement evidence for the supervised window. A changed code digest, changed gate fingerprint, new P0/P1 or lost physical evidence requires a fresh HOLD/review.

## Technical verification

- `pnpm phase44:verify` runs pure Node tests for 58/58 matching candidate evidence, SHA binding, 16 all-unverified gates, read-only/secret filtering, rejection of failed/mismatched/missing evidence, negative GO claims, invalid CI origin and missing provenance. Source checks ensure the CI artifact steps and manuals remain in place.
- Full GitHub CI continues to enforce TypeScript, unit tests, Next.js production build, all P01–P43 seeded PostgreSQL/HTTP, mobile/workspace/finance guards, Phase 34 public smoke, Phase 43 live built-web/role smoke and 200-ticket rehearsal **before Phase 44 artifact upload**.
- The artifact can be **downloaded only by someone with appropriate repository Actions access**. It is disposable CI evidence, not a public customer or private financial record.
- No real hosted production URL, actual merchant bank verification, device/printer test, or signed release decision has been provided. Such external checks therefore remain **unverified**.

**Project state:** Phase 44 is the end of the planned engineering roadmap, **not** a production-ready certification. Any outstanding human gate means HOLD.
