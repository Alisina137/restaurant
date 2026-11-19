import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const get=(path)=>readFileSync(path,"utf8");
const api=get("apps/api/src/index.ts");
const worker=get("apps/api/src/outbox-reconciler.ts");
const model=get("apps/api/src/phase35-operations.ts");
const platform=get("apps/web/src/components/phase12-platform.tsx");
const view=get("apps/web/src/components/phase35-ops-console.tsx");
const layout=get("apps/web/src/app/layout.tsx");
const css=get("apps/web/src/app/phase35.css");

assert.ok(api.includes('app.get("/api/health/operations",requireIdentity'),
 "Operations must remain platform-only");
assert.ok(api.includes('req.identity?.role!=="platform_admin"'),
 "No tenant/guest private operational data");
assert.ok(api.includes("evaluateOperations(pending,ageSeconds,worker)"),
 "Operations data must be tied to measured backlog and worker state");
assert.ok(api.includes('res.setHeader("Cache-Control","no-store")'),
 "Monitoring responses must not be cached");
assert.ok(worker.includes("outboxRuntimeMonitor.success(processed)")&&
 worker.includes("outboxRuntimeMonitor.failure()"),
 "Worker must report failed and successful attempts");
assert.ok(!worker.includes('error instanceof Error?error.message'),
 "Do not log raw SQL errors with connection strings");
assert.ok(model.includes("pilotCertified:false")&&model.includes("server_instance_and_shared_outbox"),
 "Never auto-certify a pilot or call per-instance data global");
assert.ok(platform.includes("<PlatformOperationsPulse/>"),
 "Platform overview must expose the actual diagnostic console");
assert.ok(layout.includes('import "./phase35.css"'),"Operational styles must be loaded");
for(const phrase of [
 'locale=workspace.locale','setInterval(refreshVisible,30000)','visibilitychange',
 'setData(null);setError(true)','/api/health/operations','/platform/pilots','/platform/support',
 'aria-live="polite"','role="alert"'
])assert.ok(view.includes(phrase),"Missing UI/refresh/recovery path: "+phrase);
for(const locale of ['en:', '"fa-AF":', '"ps-AF":'])
 assert.ok(view.includes(locale),"Diagnostic copy missing locale "+locale);
for(const severity of ["OUTBOX_BACKLOG","OUTBOX_DELAY","WORKER_DISABLED",
 "WORKER_STALLED","OUTBOX_CRITICAL_DELAY"])
 assert.ok(view.includes(severity),"Missing action label "+severity);
assert.ok(css.includes("@media(max-width:560px)")&&css.includes(".p35-ops-grid"),
 "Monitoring data must stay usable at phone width");
console.info("PASS Phase 35: scoped route, privacy-safe telemetry, foreground polling, triage links, 3 locales and responsive styles.");
