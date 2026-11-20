# DineFlow Phase 41 — Supervised Pilot Action Queue and Durable Evidence Integrity

**Scope:** Final restaurant workflow validation support and operator readiness. This phase improves the usefulness and correctness of existing manually recorded pilot evidence. It **does not** claim to have run a physical restaurant shift, certified hardware or payments, or authorized production GO.

## What operators can do

Owners, managers and independent platform reviewers now see a **Next actions for a supervised pilot** section on their existing pilot review screen. This is not another empty checklist or a new signoff form: it derives the next work from the restaurant's actual twelve gate reviews, open incident counts, and currently valid owner/platform signatures.

The panel prioritizes urgent open P0/P1 incident resolution, failed gate retesting, missing physical test evidence, P2 follow-up, fresh owner signoff, then independent platform review. Every row navigates to the existing **incident register**, actual **gate evidence** form or **signoff** section. Managers can review gates but cannot sign for the owner. Platform reviewers see blocker counts and the independent decision screen, not private incident narratives. The interface supports responsive mobile/desktop cards, accessible links/buttons, and English, Dari and Pashto with RTL/LTR.

Even when all 12 gates and both internal signatures have been recorded, the panel states clearly that **physical trials, financial reconciliation, real device observation and external launch approval remain separate**. No gate is auto-passed from telemetry or green CI.

## Correctness issue fixed: deep review history

The previous pilot snapshot loaded the newest **500 gate events across all gates** and the newest **50 signatures across both signature stages**, then derived a latest-per-gate/latest-per-stage view in application memory. A restaurant that repeatedly retested the same gate hundreds of times could push the latest evidence for other gates out of the snapshot, incorrectly hiding real reviews. Likewise, dozens of later platform HOLD decisions could hide the current owner signoff and produce the wrong stage.

Phase 41 queries **the most recent ID independently for each gate and each signoff stage, within the authorized tenant**, then fetches only those selected rows. This avoids both global-history cutoffs. Audit/event history remains append-only and unmodified.

The existing release safeguards remain: one tenant-locked transaction protects signoff writes; open P0/P1 incidents block approval, every gate must have a latest **passed** manual review, and any incident event invalidates the previous fingerprint/signatures. P2 follow-ups remain visible but are not invented as automatic release blockers. Another tenant cannot see or change this restaurant's evidence.

### Verification

- `pnpm pilot41:verify`: source contracts for exact latest-per-gate and latest-per-stage SQL, twelve required gates, unchanged incident P0/P1 lock and manual GO warnings, UI anchors, responsive CSS, and English/Dari/Pashto.
- Pure planner tests exercise missing/failed gates, critical vs P2 incident precedence, stale fingerprints, owner vs platform review and no automatic signoff on an empty response.
- `pnpm --filter @dineflow/api exec tsx src/phase41-ci.ts` in GitHub CI uses only disposable local PostgreSQL `dineflow_ci` **after** earlier fixture-dependent phases. It records 12 gate reviews then 520 repeated reviews of one gate, confirms all 12 are still seen, records an owner signature, appends 58 later platform HOLD records, and confirms the current owner signature and held status are still represented. A later P0 invalidates prior fingerprints. No production data or real restaurant evidence is manufactured.
- Full CI also executes earlier phase integration checks, typecheck, unit tests, production web build and synthetic 200-ticket rehearsal.

**Database migration:** None. **New packages:** None. Pull the code and restart the API/web servers.

## Manual acceptance still outstanding

Run the missing supervised physical trials, with named operator, dated device/print and finance evidence, documented kitchen reception observations, 2-tenant permissions, real Wi-Fi disconnect/reconnect, backup restoration, real cash drawer and receipt reconciliation, and independent platform review. Record any defect in the existing P33 incident register and retest before signing. No software-generated action list is equivalent to an external operational approval.

**Next proposed:** Phase 42 — harden actual operations based on human pilot evidence and targeted verified defects without weakening financial, privacy or multi-tenant guarantees.
