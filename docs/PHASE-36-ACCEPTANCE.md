# DineFlow Phase 36 — Performance & Availability Evidence

**Release status:** Implementation and disposable CI verification only. Production performance measurements, third-party monitoring, physical Android/tablet use, real cashier reconciliation and supervised pilot authorization are **not** complete.

## Scope and changes

Phase 36 builds on the Phase 35 internal outbox recovery panel with **measured, bounded API response metrics** and a targeted PostgreSQL optimization for recovery scanning. It does not claim a production SLA, inject fake requests in user environments, cache private restaurant records or auto-approve a release.

| Surface | Function | Authority |
|---|---|---|
| Platform admin `/platform/overview` → Operational recovery → **API performance** | Five-minute, instance-local response count, p50/p95 in ms, 5xx count, 429 count, slow responses >1.5 s, PostgreSQL pool active/idle/waiting, top five safe API route *categories*. | Existing platform-only `GET /api/health/operations` |
| API middleware | Bounded rolling buffer of at most **1,024 completed non-health API requests**, with sanitized route groups. | Internal, anonymous requests contribute to statistics but cannot read them. |
| Database | Partial index on `order_outbox(created_at,id) WHERE delivered_at IS NULL`. | Additive migration; supports oldest-pending queries and durable reconciliation without modifying order data. |
| HTTP lifecycle | Explicit `headersTimeout=45s` and `requestTimeout=180s`; existing 5s keep-alive; graceful drain still reports 503 readiness. | API server instance only. |

### Measurement model

The internal observer collects **only** sanitized API categories (e.g. `/api/menu`, `/api/orders`, `/api/guest`), response status and duration. Paths with customer QR/PIN/visit identifiers, raw request or response bodies, payment details, SQL errors, personal identifiers, cookies, and query strings are not persisted in the monitor. `/api/health` and `/api/health/ready` are excluded so frequent automated probes do not artificially lower user-facing p50/p95.

Each response contains `performance` in the existing platform-only operations API. `windowSeconds=300`, `sampleCapacity=1024`, `sampleCount`, `limitedToRecentSamples`, `sampledFrom=completed_api_requests_on_this_instance`, `checkedAt`, `p50Ms`, `p95Ms`, `serverErrors`, `rateLimited`, `slowRequests`, `routeGroups` (top five categories), `pool` and `availability`. The public response remains anonymous-401 / tenant-403, private no-store, no mutation route. Before 20 observations, UI explicitly says there is **insufficient evidence** to conclude a latency trend.

**Investigation indicators (not SLA objectives):**
- p95 >1,500 ms with **at least 20** completed API requests.
- 3+ HTTP 5xx responses in the bounded recent sample.
- 3+ PostgreSQL clients waiting for a connection at read time.

All indicators are for investigation; even a zero-error/p95 result cannot attest kitchen device delivery or production availability. These are not Prometheus-wide aggregates or automated on-call pages. A sample cap reached or server restart affects representativeness; display and docs explicitly disclose this.

### Practical database optimization and rollout

The reconciler executes a transactional `SELECT ... FROM order_outbox WHERE delivered_at IS NULL ORDER BY created_at,id LIMIT ... FOR UPDATE SKIP LOCKED`. Previous `order_outbox_tenant_idx` led with tenant/location, which is not ordered for this **global oldest-undelivered** scan. The new filtered index directly supports the select's filtering and ordering as well as the global oldest-pending operation query.

After pulling, **run `pnpm db:migrate` once** before testing against your existing database. This is additive: it creates an index, does not delete or update money, food tickets, ledger entries, accounts, timestamps, or outbox delivery acknowledgements. Back up first in production; standard index creation may lock writes briefly for a very large table, so schedule a supervised maintenance window. Verify plan/index hit rate on real staging with `EXPLAIN (ANALYZE, BUFFERS)` **only against approved non-sensitive staging data**. Do not assume a specific index is used on tiny tables. No query planner guarantee or numerical speedup is claimed before measurement.

### Roles, UI and handling

The existing Platform Admin dashboard keeps all navigation and recovery controls. The performance panel adds responsive 4→2 small metric cards, 5-row sanitized category table, explicit insufficiency/truncation messages, English/Dari RTL/Pashto RTL labels, and warnings. It uses Phase 35's 30-second foreground-only fetch (no extra polling). Loading/disconnected errors clear stale success and do not falsely advertise healthy state.

Operators: investigate actual 5xx, pool contention, or elevated p95 with private tracing and database diagnostics; check API readiness, logs, Postgres pool/network, kitchen observation evidence, and independently reported physical device timings. Do not drop accepted orders, bypass financial audit, modify queued events or increase DB pool size arbitrarily to make a chart green.

### Tests / acceptance

- `pnpm phase36:verify`: source contracts for middleware safety, schema/index consistency, platform routing, localization and responsive CSS.
- `pnpm test`: bounded buffer, percentile nearest rank, time-window expiry, route sanitization, invalid samples, 5xx/429 signals, startup insufficiency and pool-wait triggers.
- `pnpm --filter @dineflow/api exec tsx src/phase36-ci.ts`: disposable seeded DB, protected endpoint HTTP samples, tenant/anonymous denial, no-store, payload shape, and migrated partial index.
- Existing `pnpm --filter @dineflow/api exec tsx src/phase35-ci.ts` in GitHub CI additionally performs the Phase 36 protected measurements and index assertions, keeping integration safety in the normal CI flow.
- GitHub CI also runs types, production web build, earlier phase suites, database migrations, and disposable 20-table/10-synthetic-worker/200-ticket rehearsal. All are synthetic. They are **not** 10 physical devices or proof of commercial traffic capacity.

### Manual physical/staging acceptance still outstanding

Record reproducible and date-stamped measurements on authorized staging, with at least one low-end Android on a weak connection, an actual kitchen screen, a physical receipt printer, concurrent cashier shift and multiple restaurant tenants. Capture external p50/p95/p99 and DB plan/buffer data; separately measure order-to-kitchen visibility, retries, outbox reconciliation, tenant leakage, and money drawer reconciliation. Independently review backup/restore and real-world on-call readiness. Phase 33 P0/P1 blockers and Phase 34 human GO/HOLD remain mandatory.

**Next phase:** Phase 37 should use the measured trace/slow-query list from this phase to optimize the most consequential workflows without weakening privacy, idempotency, or financial invariants.
