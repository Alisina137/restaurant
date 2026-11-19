# DineFlow Phase 35 — Operational Recovery Monitoring and Triage

**Purpose:** Make API outbox recovery problems visible to platform operators **without** inferring that a customer phone or kitchen screen actually received an order or that the supervised restaurant pilot has passed. This is an operational-monitoring vertical slice, not a commercial go-live or external pager integration.

## What is delivered

| Role / route | Capability | Evidence |
| --- | --- | --- |
| Platform administrator — `/platform/overview` | **Operational recovery** panel with independent 30-second foreground refresh, manual retry, server-side classification, outbox backlog/age, worker mode, last successful scan, consecutive failures, and processed-since-start count | Authenticated `GET /api/health/operations`, durable outbox rows + in-memory local worker telemetry |
| Restaurant owner / manager — `/app/pilot` | Unchanged existing real-tenant incident register and 12 human-verified pilot gates | No new platform-only information leaked to restaurant users |
| Platform administrator — `/platform/pilots`, `/platform/support` | One-click navigation from diagnostics to pilot blockers and human support queue | Existing authorized routes, not automatic escalation |
| Unauthenticated, guest, restaurant staff | No operational diagnostic access | Requires a session and `platform_admin` role; POST is not exposed |

### Observations and classification

The API now reports `scope:server_instance_and_shared_outbox`, `checkedAt`, `severity` (`ok`, `investigate`, `urgent`), finite named `signals`, and `pilotCertified:false`. Existing `pendingOutbox`, `oldestPendingAt`, `oldestPendingAgeSeconds`, `status` and `polling` are preserved. Worker telemetry includes mode (`starting`, `active`, `disabled`, `stopped`), start/attempt/success/failure timestamps, failures, whether a batch is active and count processed **by this particular server instance**.

| Indicator | Investigate | Urgent |
| --- | --- | --- |
| Unreconciled internal events | Oldest pending >60s | Oldest pending >300s |
| Queue depth | n/a | >5,000 unreconciled rows |
| Retry failures | >0 consecutive | >=3 consecutive |
| Worker inactive | Disabled (even with no backlog) or no scan for >30s | Stalled when there are pending events |
| Cold start | First 30 seconds is **starting**, not a certified healthy service | Can become stalled if no successful scan occurs |

These are **diagnostic thresholds**, not guarantees or contractual SLAs. The message `OUTBOX_DELAY` means delayed internal revision reconciliation, **not** a missing accepted order, failed Android push, failed payment, or restaurant-wide outage. Another API replica may be processing outbox records. The panel explicitly names the mixed scope and must not be used as a release certification. Platform operators must follow the Phase 34 manual GO/HOLD checklist, read the pilot incident register and conduct physical hardware and money checks.

### Recovery and operator response (read-only)

1. **Active/OK:** Review last successful scan and pending count. If all are zero/recent, continue normal operator observation; never auto-approve a pilot.
2. **Retrying:** Check the API logs for `kind:outbox_reconcile_retry` with sanitized failure count; independently verify database availability and migrations. The retry loop still runs every 3 seconds. Secrets and raw SQL/driver errors are not written by this worker.
3. **Disabled:** Verify `OUTBOX_RECONCILIATION` is not accidentally set to `off` in the API environment. Configuration changes require a supervised operator; do not bypass financial, privacy or pilot controls.
4. **Stalled/urgent:** Inspect API readiness, PostgreSQL connectivity and process restarts, separate kitchen ticket displays and outbox timestamps. Stop admitting new tables when a genuine P0/P1 service failure has been observed; record a tenant-scoped incident and page a named human through existing external procedures.
5. **Recovery check:** When the root cause is corrected, observe a new successful scan and decreasing shared backlog, verify a real accepted test ticket, kitchen visible receipt, waiter service and supervised cashier settlement. A low backlog alone never proves guest/device delivery.
6. **Network outage and rollback:** Use the existing `docs/PHASE-34-ACCEPTANCE.md` incident and restore plan. Never manually mark outbox rows delivered, delete accepted tickets, bypass retry/auth security, reissue money entries or reverse a production financial migration to make the dashboard green.

### UI and accessibility

Responsive 3→2→1 metric cards and fixed-width action buttons; Dari and Pashto RTL plus English LTR labels and actionable warning descriptions; clear empty/loading/error states; foreground-only 30-second refresh; manual refresh; fresh `checkedAt` timestamp; stale data is cleared on request failure instead of showing an outdated green state. Critical indications are announced with `role="alert"`; other state uses `role="status"`. Links are real platform navigation destinations, no stub pages or new permissions.

### Verification

- `pnpm phase35:verify`: API/UI/CSS contract, locale coverage, visible permission model, foreground refresh and triage links.
- `pnpm test`: unit cases for start→retry→success, timestamp and counter reset, disabled worker, backlog thresholds (60/300s), three-failure urgent classification and recover-to-OK.
- `pnpm --filter @dineflow/api exec tsx src/phase35-ci.ts`: authenticated HTTP contract against **disposable seeded PostgreSQL**. Checks no public/restaurant-role operational read, no mutation via POST, no-store, schema and no sensitive content.
- CI also executes typechecking, previous phase tests, production web build, Phase 34 smoke and load rehearsal.

No database migrations or new dependencies. Existing role URLs and API response fields remain compatible.

### Evidence not collected

A real restaurant incident triage, Wi-Fi/device testing, observed packet loss/latency, third-party alert delivery, multi-replica aggregation, backup/media restoration, cash/receipt verification and independently authorized GO/HOLD are **not** supplied by code or CI. These require actual secure operator evidence and must remain release blockers where applicable. Treat the dashboard as one instance-local signal, not an external pager or remote monitoring service.

**Next phase (proposed):** Phase 36 — production performance and availability tuning based on measured network/database/device traces and authenticated tenant isolation tests. Do not fabricate real measurements.
