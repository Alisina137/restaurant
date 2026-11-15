import type { IdentityContext } from "./context";
export function canAccessTenant(context: IdentityContext, tenantId: string): boolean {
  return context.role !== "platform_admin" &&
    context.tenantId === tenantId &&
    context.memberships.some((member) => member.tenantId === tenantId);
}
