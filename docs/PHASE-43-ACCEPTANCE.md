# DineFlow Phase 43 — Production-Built Release Candidate Route & Role Verification

**Scope:** Phase 43 closes an actual web routing defect and adds an executable, fail-closed **CI-only** release candidate walkthrough across the real Next.js production build and real Express/Neon-compatible PostgreSQL API. It does **not** certify a physical restaurant pilot or financial settlement.

## Fixed defect

The shared `/[area]/reports` Next page previously did not validate the `area` route segment, unlike the other scoped role pages. A directly typed URL such as `/cashier/reports`, `/kitchen/reports` or `/platform/reports` could render a manager's reports component shell. **Phase 43 returns a true server-rendered 404** unless the area is `app`, while preserving `/app/reports?tab=sales|items|service|audit` and the existing server-enforced reporting API authorization. This is defense in depth; Next route status alone is not an access control mechanism.

## CI release candidate smoke

Two independent gates were added:

- `pnpm phase43:verify`: a deterministic offline mock suite plus static safety contracts. A mocked API outage, wrong owner reporting status, broken web screen or altered route authorization fails the test. Never touches production or logs sensitive auth information.
- `pnpm phase43:smoke`: **live CI-only** check run after the existing disposable seeded real API integration suites. GitHub CI boots the **actual production-built** Next web server and walks 21 web route shells (manager, cashier, kitchen, platform, guest QR placeholder shell, malformed cross-role deep links, and absence of the dev interface), 11 anonymous API privacy/readiness probes, and 26 authenticated API GETs using seeded role accounts. These GETs verify actual Express permissions for a manager, cashier, kitchen operator, waiter, platform administrator and second restaurant owner. A route returning a wrong HTTP status, a server render failure, a missing readiness response or a cross-role privilege leak gives **HOLD / exit code 1**.

The live verifier is intentionally only invocable with `CI=true` **and** `GITHUB_ACTIONS=true`, a disposable localhost `dineflow_ci` PostgreSQL URL and loopback web/API origins. It logs **probe IDs and HTTP statuses only**, never passwords, Set-Cookie, response bodies, customer data or account emails. Requests do not follow redirects and have per-request deadlines. The only POST is to **disposable auth sign-in**; all restaurant and financial/pilot checks are safe GETs.

A reproducible machine-readable, secret-free evidence record is written as `dineflow-phase43-rc.json` in the GitHub runner's temporary directory. It includes the exact checked git SHA, timestamp, all probe IDs/statuses and pass/fail; it is an **ephemeral CI record** and **not** a signed release approval. No customer data and no credentials are exported. Green test status does not mean a real QR token has been scanned or any order physically prepared.

### How to inspect failures

In GitHub Actions > Verify DineFlow, open **P43 built-web end-to-end route and real API role gate (CI simulation)**. Each `FAIL` line names a stable route/authorization probe without exposing its full URL, query, credentials or response. Check the upstream Next API health/role permissions and correct the actual defect; do not weaken a test to force a release.

The smoke runs after the production build, seed/migrations and existing functional suites, **before** P31's 200-ticket disposable load. It does not submit new orders, bill customers or modify pilot signatures. The independent P09/P10/P42 finance, P14/P33 pilot and P39/P40 mobile order recovery tests remain required and unchanged.

## Release-candidate approval remains HOLD by default

Even with every P43 probe green, an operator must independently document:

1. **Real devices and six roles**: Android waiter and kitchen screen alongside owner, cashier, platform review and actual guest QR/PIN on a physical table. These cannot be verified by web route SSR.
2. **Real orders and kitchen handoff**: matching physical meals, timed pickup acknowledgement, lost Wi-Fi recovery, two actual mobile devices and an observed full service shift.
3. **Real money**: manually counted opening float/closing drawer, cash change, independently confirmed transfer, recorded refunds, and actual printer output compared to original immutable receipts. P42 DB-only checks are not proof of these.
4. **Recovery**: an isolated real backup/restore drill, migration forward/rollback rehearsal, monitored process health and documented on-call/incident handling.
5. **Operator sign-off**: zero outstanding P0/P1 incidents; the twelve owner-owned physical gate records; a fresh owner signature and an independently authorized platform GO/HOLD, under P33/P34/P41 rules. New evidence or incidents invalidate earlier signatures.
6. **Deployment provenance**: pin the verified GitHub SHA, deployment artifact/image digest and staging origin. Compare that candidate with the artifact actually deployed. Run Phase 34's authenticated-free remote smoke separately with staging HTTPS. A local CI test is not staging verification.

The operator must record actual outcomes and evidence privately. Do not auto-complete, simulate, or fabricate physical test results. If any verification is unavailable or a mismatch remains unresolved, the commercial release decision is **HOLD**.

**Phase 44 proposal:** final operator release packet and supervised GO/HOLD checklist, with explicit deployment, rollback and human evidence requirements. Do not promise production certification before real-world testing.

**Dependencies/migrations:** none. Pull latest `main`, restart web/API. The existing Next web and Express authorization semantics remain unchanged except for the correctly rejected reports deep links.
