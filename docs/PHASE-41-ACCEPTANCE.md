# DineFlow Phase 41 — Supervised Pilot Readiness Decision Board

**Purpose:** Make missing restaurant pilot evidence and incident blockers actionable for owners and independent platform reviewers. Existing sign-off security, real physical tests and manual GO/HOLD remain mandatory. This phase **does not** claim that a real restaurant or its financial records have been physically verified.

## What was delivered

- Added a visible **Pilot action board** to both the restaurant **Owner/Manager → Pilot** page and **Platform Admin → Pilot review**. It derives an ordered action plan from the existing authenticated read-only pilot snapshot, not from made-up metrics or a second state store.
- Four quick metrics: **open P0/P1 incidents**, **passed gates**, **missing gate reviews** and **failed gate reviews**. Distinguishes failed tests from untested tasks.
- Prioritized actions: (1) unresolved critical incidents, (2) failed/untested evidence for each of the twelve distinct pilot gates, (3) current owner signature, (4) independent platform decision or explicit HOLD, (5) **always** a separate reminder that Android/tablet, kitchen/printer, cash, backups and supervised shift still require external human evidence.
- Gate action buttons take the permitted restaurant **owner** directly to the existing evidence form and preselect the correct gate. Manager and independent platform operators see the same read-only evidence gap summary without an unauthorized edit capability.
- Current signatures are computed against the **same fingerprint and owner-signoff ID** as the server's authorized signoff pipeline. A new incident or modified gate makes old signatures visibly stale. Platform approval isn't treated as valid without current owner signoff and zero unresolved P0/P1 blockers.
- English, Dari and Pashto labels, RTL-safe layout, responsive 4→2 cards, keyboard-visible action focus, explicit warning/status states and non-interactive print view.

## Operational and financial safeguards

This board is only a **derived view** over `GET /api/pilot` or `GET /api/platform/pilots/:id`. It never writes an incident, changes a gate, signs a review, modifies a payment, marks an outbox record delivered, or asserts that telemetry proves customer/device receipt. All original server authorization gates and append-only evidence/incident events remain unchanged.

The evidence forms still require minimum observations, owner-only gate submissions and owner signatures. The independent platform operator still decides HOLD/approved under the existing server-side checks. A signed-off software record is **not** a production deployment authorization or real-life restaurant certification.

## Automated acceptance

- `pnpm phase41:verify`: source contracts for linking authenticated pilot views, real gate actions, three locales, keyboard/responsive design, zero auto-GO, immutable incident signatures and original authorized signoff routes; pure TS scenario tests.
- `apps/web/src/lib/pilot41-ci.ts`: deterministic scenarios with all twelve gates passed, missing gate, failed gate, multiple unresolved P0/P1 incidents, stale owner fingerprint, stale platform owner ID, platform HOLD and up-to-date software signoff; always asserts `externallyCertified:false`.
- Existing CI still exercises the real seeded pilot/incident HTTP authorization and concurrency tests (`phase32-ci.ts`, `phase33-ci.ts`) plus TypeScript, tests, production web build, deployment smoke and simulated 200-ticket rush.
- No new API route, database migration or dependency. Pull the code and restart the web app.

## Required hands-on validation before release

On a real restaurant pilot with authorized staff, verify each of the **twelve** gates with physical Android, genuine QR/PIN, kitchen display, printed receipt, cashier reconciliation, refunds, network failure, RTL/English, accessibility, backup/restore, supervised service shift and real incident response. Use a named reviewer, timestamps, measured results and private evidence location. P0/P1 unresolved events **must** block pilot approval and force fresh signatures after resolution.

Review multiple restaurant tenants, table handoffs and staff reassignments using actual devices. Do not paste customer personal data, raw bank details, secret keys or PIN/QR credentials in the evidence form. This board cannot verify real-money totals or attach external evidence automatically; it only helps operators see which steps they must still complete.

**Next proposed phase:** Phase 42 — independently confirm cashier settlement and receipt integrity through supervised staging/integration acceptance, then close *observed* defects without fabricating physical pilot evidence.
