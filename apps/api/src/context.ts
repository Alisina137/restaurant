import { eq, and } from "drizzle-orm";
import { landingFor, isStaffRole, type Locale, type StaffRole, type Role } from "@dineflow/shared";
import { db } from "./db";
import { platformAdmin, tenant, tenantMembership, userPreference } from "./schema";

export type Membership = { tenantId: string; tenantName: string; role: StaffRole };
export type IdentityContext = {
  user: { id: string; name: string; email: string };
  locale: Locale; role: Role; tenantId: string | null; tenantName: string | null;
  memberships: Membership[]; defaultRoute: string;
};
export async function contextFor(user: { id: string; name: string; email: string }): Promise<IdentityContext | null> {
  const [isPlatform, preferences, rows] = await Promise.all([
    db.select({ userId: platformAdmin.userId }).from(platformAdmin).where(eq(platformAdmin.userId, user.id)).limit(1),
    db.select().from(userPreference).where(eq(userPreference.userId, user.id)).limit(1),
    db.select({ tenantId: tenantMembership.tenantId, tenantName: tenant.name, role: tenantMembership.role })
      .from(tenantMembership).innerJoin(tenant, eq(tenantMembership.tenantId, tenant.id))
      .where(and(eq(tenantMembership.userId, user.id), eq(tenantMembership.status, "active"), eq(tenant.status, "active")))
  ]);
  const memberships = rows.filter((row): row is Membership => isStaffRole(row.role));
  const preferred = preferences[0]?.activeTenantId;
  const selected = memberships.find((m) => m.tenantId === preferred) ?? memberships[0];
  const role: Role | undefined = isPlatform.length ? "platform_admin" : selected?.role;
  if (!role) return null;
  const locale = preferences[0]?.locale === "en" || preferences[0]?.locale === "ps-AF" ? preferences[0].locale : "fa-AF";
  return {
    user, locale, role,
    tenantId: role === "platform_admin" ? null : (selected?.tenantId ?? null),
    tenantName: role === "platform_admin" ? null : (selected?.tenantName ?? null),
    memberships, defaultRoute: landingFor(role, "web")
  };
}
