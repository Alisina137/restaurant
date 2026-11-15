import assert from "node:assert/strict";
import test from "node:test";
import { canAccessTenant, type IdentityContext } from "./context";
const base: IdentityContext = {
  user: { id: "u1", name: "A", email: "a@example.com" }, locale: "en",
  role: "waiter", tenantId: "tenant-a", tenantName: "A",
  memberships: [{ tenantId: "tenant-a", tenantName: "A", role: "waiter" }],
  defaultRoute: "/mobile-access"
};
test("tenant-scoped actions require selected, active membership", () => {
  assert.equal(canAccessTenant(base, "tenant-a"), true);
  assert.equal(canAccessTenant(base, "tenant-b"), false);
  assert.equal(canAccessTenant({ ...base, role: "platform_admin", tenantId: null }, "tenant-a"), false);
});
