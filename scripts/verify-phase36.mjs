import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const file=p=>readFileSync(p,"utf8");
const hardening=file("apps/api/src/production-hardening.ts");
const api=file("apps/api/src/index.ts");
const model=file("apps/api/src/phase36-performance.ts");
const schema=file("apps/api/src/schema.ts");
const migration=file("apps/api/drizzle/0017_phase36_outbox_pending_index.sql");
const journal=JSON.parse(file("apps/api/drizzle/meta/_journal.json"));
const panel=file("apps/web/src/components/phase36-performance-panel.tsx");
const parent=file("apps/web/src/components/phase35-ops-console.tsx");
const css=file("apps/web/src/app/phase36.css");
const layout=file("apps/web/src/app/layout.tsx");

assert.ok(model.includes("PERFORMANCE_CAPACITY = 1024")&&
 model.includes("PERFORMANCE_WINDOW_MS = 5 * 60_000"),"Bounded window");
assert.ok(model.includes("limitedToRecentSamples"),"Sampling limitation not hidden");
assert.ok(model.includes("actualSlaCertified:false"),"No auto certification");
assert.ok(!model.includes("originalUrl")||model.includes("never req.originalUrl"),
 "Performance data must not read full URL");
assert.ok(hardening.includes("httpPerformanceMonitor.record(category,res.statusCode,durationMs)"),
 "Metrics must reflect real finished HTTP requests");
assert.ok(hardening.includes('req.path.startsWith("/api/health")'),
 "Health probes must not dominate customer traffic samples");
assert.ok(api.includes('app.get("/api/health/operations",requireIdentity'),
 "Metrics only via protected operations API");
assert.ok(api.includes('req.identity?.role!=="platform_admin"'),
 "Tenant users may not access platform metrics");
assert.ok(api.includes("assessAvailability(httpPerformance,poolPressure)"),
 "Metrics must be assessed against actual observations");
assert.ok(api.includes("maxConfigured:10")&&api.includes("pool.waitingCount"),
 "Database pool pressure visibility required");
assert.ok(api.includes("server.requestTimeout=180_000")&&
 api.includes("server.headersTimeout=45_000"),"Bound idle HTTP reception");
assert.ok(migration.includes("CREATE INDEX IF NOT EXISTS")&&
 migration.includes('WHERE "delivered_at" IS NULL'),"Pending-only outbox index");
assert.ok(schema.includes("order_outbox_pending_order_idx"),"Schema must model DB index");
assert.equal(journal.entries.at(-1).tag,"0017_phase36_outbox_pending_index");
assert.ok(parent.includes("PlatformPerformancePanel data={data.performance} locale={locale}"),
 "Place performance in real platform overview, not disconnected stub");
for(const value of [
 'en:', '"fa-AF":', '"ps-AF":',
 'sampleCount','p95Ms','serverErrors','pool.waiting','actualSlaCertified',
 'limitedToRecentSamples','routeGroups','aria-labelledby'
])assert.ok(panel.includes(value),"Missing locale/status/metric "+value);
assert.ok(css.includes("@media(max-width:560px)"),"Small-screen metrics must fit");
assert.ok(layout.includes('import "./phase36.css"'),"Performance styles must be loaded");
console.info("PASS Phase 36 contracts: protected latency metrics, bounded sampling, real pool data, indexed pending SQL, localized responsive panel.");
