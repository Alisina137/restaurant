# Phase 34 — Operational and Deployment Readiness

**Status:** Implementation and automated read-only smoke checks; physical pilot and commercial release are **not certified**. This phase adds no payment methods, subscriptions or database migrations.

## Purpose

Make deployment candidates auditable without pretending that green CI certifies a real restaurant. Phase 33 added a tenant incident register and P0/P1 blockers. Phase 34 adds a **credential-free public smoke test** for an actually running HTTPS candidate, safe CI-local verification, and an operator-owned launch/rollback process. We have no verified real restaurant pilot incident data, so no defects or successes are fabricated.

## Real deployment preflight

Use from the project root after installing dependencies, with real staging HTTPS origins:

\`\`\`powershell
pnpm ops:preflight --api-origin https://api.your-staging-domain.example --web-origin https://your-staging-domain.example
\`\`\`

Replace both examples with the deployment's exact HTTPS origins. Arguments must be origins only — no credentials, paths, query strings, IP-literal targets or local HTTP. The tool sends only unauthenticated GET requests with bounded timeouts, never follows redirects, and prints probe IDs and HTTP statuses but not response bodies or URLs. It does not access environment secrets, customer records, pilot incident text, restaurant money or mutation endpoints.

| Probe | Expected response | What failure means |
| --- | --- | --- |
| API liveness \`GET /api/health\` | 200 \`status:"ok"\` | API process/routing unavailable |
| Database \`GET /api/health/ready\` | 200 \`status:"ready"\` | Database connectivity unhealthy, or service draining |
| API response hardening | \`no-store\` cache and \`nosniff\` headers | Proxy/header regression |
| Guest isolation \`GET /api/context\` | 401 | Private identity endpoint is exposed |
| Platform isolation \`GET /api/health/operations\` | 401 | Protected operational data is exposed |
| Web entry \`GET /login\` | 200 | Web route/deployment unavailable |
| Developer-only launcher \`GET /dev/interfaces\` | 404 | Local-only development tooling exposed |

Any failed check returns a non-zero exit code, with a **HOLD** statement. **PASS does not imply that database migrations have all applied, that TLS certificates/edge rules are correct, that production is ready, that kitchen events were delivered to phones, or that the pilot sign-off was recorded.** Run this again after rollout and during supervised rollback exercises.

The existing \`/api/health\` remains a liveness endpoint; \`/api/health/ready\` now fails with 503 when shutdown begins, rather than advertising DB readiness during draining.

## Verification available to engineers

\`\`\`powershell
pnpm ops:preflight:verify
pnpm typecheck
pnpm test
pnpm build:web
\`\`\`

The dedicated Node test suite includes positive coverage and negative cases: database outage, private route leak, developer launcher exposed, missing headers, web failure, endpoint unreachable, bad URLs, and local-mode escape attempts. In GitHub Actions, after spinning up disposable Postgres with seeded test accounts and the built Next.js production server, a live localhost smoke uses \`--ci-local\` — accepted only with **CI=true and GITHUB_ACTIONS=true**. This is explicitly a simulation, never a production readiness certificate.

## Mandatory human GO/HOLD checklist

Record ownership, dates, observations, pass/fail, references to approved evidence, explicit GO/HOLD and independent reviewer in a **secure operator-controlled log** (not a CLI output). No entry may be auto-passed by CI.

1. **Release identity** — pin reviewed git commit/image digest, production web/API origin, migration set and rollback image. Stage using separate credentials and tenant data.
2. **Pilot authority** — owner manually passes all 12 pilot gates at \`/app/pilot\`, has zero unresolved P0/P1, and separately authorized platform operator reviews \`/platform/pilots/:id\`. Any new incident or change invalidates earlier signatures.
3. **Money and receipts** — actual cash drawer opening/closing, offline correction/refund, printed receipts and shift reports independently reconciled; unresolved discrepancy means HOLD.
4. **Real hardware** — owner/manager, kitchen, cashier, waiter Android and guest QR/PIN workflows on a real table and printer; Dari RTL, Pashto RTL, English; accessibility and low-bandwidth retries; two-tenant isolation.
5. **Recovery** — encrypted PostgreSQL and image backups with retention, **isolated** restore rehearsal using \`pnpm ops:rehearsal\`, audited forward migration and safe prior-app-image rollback. Never restore onto a live database without explicit authorization.
6. **Operations** — API readiness probe, authorized platform \`/api/health/operations\` review, actionable alert and human pager, safe edge rate limiting, TLS, session email delivery, backup monitoring and incident response contacts.
7. **Explicit decision** — accountable human launch owner and independent reviewer both confirm real evidence; no unresolved critical findings; fallback for ongoing visits is staffed and rehearsed.

## Incident response / rollback

**P0** — suspected tenant leak, missing committed kitchen ticket, or incorrect payment/receipt: stop new seating, preserve immutable order/financial/audit evidence, log a P0 in the restaurant incident register, and page the designated operator. Never rewrite immutable receipts, tenders or refunds.

**P1** — sustained critical service interruption: stop admitting new tables, preserve safe settlement of active visits, investigate API, Postgres, Wi-Fi, kitchen visibility and outbox; register P1, assign retest, hold new signoff.

**Rollback** — deploy a previously tested compatible application image only after an operator review; additive DB schema may be preserved but financial migrations must not be reversed blindly. Retest guest QR/PIN, an accepted kitchen order, readiness and cashier settlement after rollback. Re-record invalidated signatures.

## Scope and limitations

- No migrations, new user-facing tabs, new privileges, third-party integrations or irreversible runtime actions.
- Does not conduct a real production/staging deployment, external backup restore, physical printer trial, Android test, incident triage based on actual operator reports, or sign a pilot.
- After actual real-world evidence exists, **Phase 35** should prioritize and retest observed operational/recovery gaps without loosening P0/P1 holds.
