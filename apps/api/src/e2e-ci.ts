import "dotenv/config";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { tenantMembership } from "./schema";
import { user } from "./schema";

const ROOT = process.env.E2E_API_URL ?? "http://localhost:4000";
const password = process.env.DEMO_PASSWORD;
if (process.env.NODE_ENV === "production" || !password) throw new Error("CI integration tests require development credentials");

async function request(path: string, options?: RequestInit) {
  return fetch(ROOT + path, { ...options, headers: {
    "Content-Type": "application/json", Origin: "http://localhost:3000",
    ...(options?.headers ?? {})
  } });
}
async function signIn(email: string, secret = password) {
  const response = await request("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password: secret }) });
  const cookies = response.headers.getSetCookie().map((item) => item.split(";")[0]).join("; ");
  return { response, cookies };
}
async function context(cookies: string) {
  return request("/api/context", { headers: { Cookie: cookies } });
}
async function main() {
  const health = await request("/api/health/ready");
  assert.equal(health.status, 200, "DB readiness must work");
  const publicSignup = await request("/api/auth/sign-up/email", { method: "POST", body: JSON.stringify({ email: "attacker@example.test", name: "Attacker", password }) });
  assert.equal(publicSignup.status, 403, "P01 forbids public signup");
  const wrong = await signIn("owner-ci@example.test", "wrongPass12345");
  assert.notEqual(wrong.response.status, 200, "wrong password must not authenticate");

  for (const [email, expectedRole, expectedHome] of [
    ["owner-ci@example.test", "owner", "/app/overview"],
    ["waiter-ci@example.test", "waiter", "/mobile-access"],
    ["kitchen-ci@example.test", "kitchen", "/kitchen/live"],
    ["cashier-ci@example.test", "cashier", "/cashier/checks"],
    ["platform-ci@example.test", "platform_admin", "/platform/overview"]
  ]) {
    const signedIn = await signIn(email);
    assert.equal(signedIn.response.status, 200, "correct credentials should authenticate: " + email);
    assert.ok(signedIn.cookies, "auth session cookie exists: " + email);
    const ctxResponse = await context(signedIn.cookies);
    assert.equal(ctxResponse.status, 200, "session context loads: " + email);
    const ctx = await ctxResponse.json() as { role: string; defaultRoute: string; tenantId: string | null };
    assert.equal(ctx.role, expectedRole);
    assert.equal(ctx.defaultRoute, expectedHome);
    const foreign = await request("/api/tenants/another-restaurant/access", { headers: { Cookie: signedIn.cookies } });
    assert.equal(foreign.status, 404, "tenant queries must not cross tenants");
    if (expectedRole === "platform_admin") {
      const tenant = await request("/api/tenants/dev-restaurant/access", { headers: { Cookie: signedIn.cookies } });
      assert.equal(tenant.status, 404, "platform admin must not have implicit access to private restaurant data");
    } else {
      assert.equal(ctx.tenantId, "dev-restaurant");
      const tenant = await request("/api/tenants/dev-restaurant/access", { headers: { Cookie: signedIn.cookies } });
      assert.equal(tenant.status, 200);
    }
    if (expectedRole === "waiter") {
      const change = await request("/api/preferences/locale", { method: "PUT", headers: { Cookie: signedIn.cookies }, body: JSON.stringify({ locale: "ps-AF" }) });
      assert.equal(change.status, 200, "user can change language");
      const after = await (await context(signedIn.cookies)).json() as { locale: string };
      assert.equal(after.locale, "ps-AF", "language must persist");
      const denied = await request("/api/context/tenant", { method: "PUT", headers: { Cookie: signedIn.cookies }, body: JSON.stringify({ tenantId: "other" }) });
      assert.equal(denied.status, 403, "tenant selector cannot select foreign tenants");
      const [record] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
      assert.ok(record);
      await db.update(tenantMembership).set({ status: "disabled" }).where(eq(tenantMembership.userId, record!.id));
      const revoked = await context(signedIn.cookies);
      assert.equal(revoked.status, 403, "revoked membership must take effect immediately");
    }
    if (expectedRole === "owner") {
      const signOutResponse = await request("/api/auth/sign-out", { method: "POST", headers: { Cookie: signedIn.cookies }, body: "{}" });
      assert.equal(signOutResponse.status, 200, "sign out should succeed");
      const revoked = await context(signedIn.cookies);
      assert.equal(revoked.status, 401, "signed-out session must be invalid");
    }
  }
  console.info("PASS: signup blocked; 5 roles; wrong password; tenant isolation; locale persistence; membership revoke; sign-out.");
}
main().then(async () => { await pool.end(); }).catch(async (error) => { console.error(error); await pool.end(); process.exitCode = 1; });
