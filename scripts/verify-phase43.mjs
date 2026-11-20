import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=p=>readFileSync(p,"utf8");
const route=file("apps/web/src/app/[area]/reports/page.tsx");
const proxy=file("apps/web/src/proxy.ts");
const gates=file("apps/web/src/lib/phase43-route-gates.ts");
const areaTests=file("apps/web/src/lib/phase43-route-gates.ci.ts");
const smoke=file("scripts/phase43-release-smoke.mjs");
const tests=file("scripts/phase43-release-smoke.test.mjs");
const workflow=file(".github/workflows/verify.yml");
const pkg=JSON.parse(file("package.json"));
const docs=file("docs/PHASE-43-ACCEPTANCE.md");
assert.ok(proxy.includes("isWrongRoleRoute(request.nextUrl.pathname)")&&
 proxy.includes("status:404")&&proxy.includes('matcher:["/:area/:section/:path*"]'),
 "Next proxy must reply 404 before any HTML streaming begins");
assert.ok(gates.includes('"reports","pilot","billing"')&&
 gates.includes('"ready","preparing","history"')&&
 gates.includes('"checks","shifts","transactions"'),
 "Reject only known wrong-area routes before streaming");
assert.ok(areaTests.includes('"/g/guest-visit/menu"')&&
 areaTests.includes('"/platform/reports"'),
 "Keep guest and correct role pages available while denying wrong area");
assert.ok(route.includes('if(area!=="app")notFound()'),
 "Direct /cashier/reports and /platform/reports must return server 404");
assert.ok(route.includes('const [{area},{tab}]=await Promise.all([params,searchParams])'),
 "Maintain normal app report tabs after area rejection");
for(const marker of [
 "webRoutes=[","anonymousApi=[","roleChecks=[",
 '"/app/overview"','"/app/pilot"','"/app/billing/shifts"',
 '"/cashier/checks"','"/cashier/shifts"',
 '"/kitchen/live"','"/kitchen/ready"',
 '"/platform/overview"','"/platform/pilots"',
 '"/cashier/reports",404','"/platform/reports",404',
 '"/dev/interfaces",404','"/api/finance/shifts/current",401',
 '"/api/pilot",401','"/api/health/operations",401',
 "financiallyCertified:false","physicalPilotCertified:false","humanGoAuthorized:false",
 'if(process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true"',
 "Phase 43 may only probe explicit localhost CI origins.",
 'redirect:"manual"','cache:"no-store"',
 'mode:0o600','execFileSync("git",["rev-parse","HEAD"]'
])assert.ok(smoke.includes(marker),"Missing RC route/identity/release safeguard: "+marker);
assert.ok(!smoke.includes("console.log(cookie)")&&
 !smoke.includes("console.log(password)")&&
 !smoke.includes("console.log(await response.text())"),
 "Release gate must not print credentials or private API response bodies");
assert.ok(tests.includes('mockFetch({badPath:')&&
 tests.includes('mockFetch({noApiReadiness:true})')&&
 tests.includes('mockFetch({badRole:'),
 "Test fail-closed behavior, not just green mocks");
assert.ok(workflow.includes("P43 built-web end-to-end route and real API role gate")&&
 workflow.includes("pnpm phase43:smoke")&&workflow.includes("pnpm phase43:verify"),
 "Both deterministic and actual built-web checks must run in GitHub");
assert.ok(pkg.scripts["phase43:verify"]&&pkg.scripts["phase43:smoke"]);
assert.ok(docs.includes("CI-only")&&docs.includes("physical")&&
 docs.includes("HOLD"),"Do not imply automated deployment approval");
console.info("PASS P43 source contract: app-only reports route, full role surface matrix, private API denials, CI origin guard and explicit external HOLD.");
