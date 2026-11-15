import assert from "node:assert/strict";
import test from "node:test";
import { direction, landingFor, mayViewTenant, t, webAreaFor, isLocale, isStaffRole } from "./index";

test("role landings never grant a foreign application", () => {
  assert.equal(landingFor("waiter", "web"), "/mobile-access");
  assert.equal(landingFor("waiter", "mobile"), "/home");
  assert.equal(landingFor("kitchen", "web"), "/kitchen/live");
  assert.equal(landingFor("platform_admin", "web"), "/platform/overview");
  assert.equal(webAreaFor("cashier"), "cashier");
  assert.equal(webAreaFor("waiter"), null);
});
test("disabled or foreign membership cannot access tenant", () => {
  const memberships = [{ userId: "u1", tenantId: "t1", status: "active" as const }, { userId: "u1", tenantId: "t2", status: "disabled" as const }];
  assert.equal(mayViewTenant("u1", "t1", memberships), true);
  assert.equal(mayViewTenant("u1", "t2", memberships), false);
  assert.equal(mayViewTenant("u1", "t3", memberships), false);
  assert.equal(mayViewTenant("u2", "t1", memberships), false);
});
test("Dari/Pashto mirror, English does not; strings exist", () => {
  for (const locale of ["fa-AF", "ps-AF", "en"] as const) {
    assert.ok(t(locale, "welcome").length > 0);
    assert.equal(isLocale(locale), true);
  }
  assert.equal(direction("fa-AF"), "rtl");
  assert.equal(direction("ps-AF"), "rtl");
  assert.equal(direction("en"), "ltr");
  assert.equal(isStaffRole("platform_admin"), false);
});
