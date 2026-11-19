import { type Request, type Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { auth } from "./auth";
import { db } from "./db";
import { contextFor, type IdentityContext } from "./context";
import { auditEvent, catalogRevision, location } from "./schema";
import { classifyMenuDbError } from "./menu-error-classifier";

export class MenuError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}
export function fail(status: number, code: string, message: string): never {
  throw new MenuError(status, code, message);
}
export type MenuScope = { actorId: string; tenantId: string; locationId: string; role: string; context: IdentityContext };
export async function scopeFor(req: Request, write = false): Promise<MenuScope> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return fail(401, "UNAUTHENTICATED", "Sign in required.");
  const context = await contextFor({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (!context || !context.tenantId || context.role === "platform_admin")
    return fail(403, "ACCESS_DENIED", "Restaurant access required.");
  if (write && context.role !== "owner" && context.role !== "manager")
    return fail(403, "ACCESS_DENIED", "Only restaurant owners and managers may edit the menu.");
  const [branch] = await db.select({ id: location.id }).from(location)
    .where(eq(location.tenantId, context.tenantId)).limit(1);
  if (!branch) return fail(409, "LOCATION_REQUIRED", "Configure a restaurant location first.");
  return { actorId: session.user.id, tenantId: context.tenantId, locationId: branch.id, role: context.role, context };
}
export type Handler = (req: Request, res: Response) => Promise<void>;
export function route(handler: Handler) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error: unknown) => {
      if (res.headersSent) { console.error("Menu response failed after headers", error); return; }
      if (error instanceof MenuError) {
        res.status(error.status).json({ code: error.code, message: error.message }); return;
      }
      const failure=classifyMenuDbError(error);
      if(failure.status>=500){
       // Only a stable category is logged; raw DB errors could disclose data.
       console.error(JSON.stringify({kind:"menu_request_failed",code:failure.code,
        method:req.method,route:"/api/menu"}));
      }
      res.status(failure.status).json({code:failure.code,message:failure.message});
    });
  };
}
export function field(v: unknown, max: number, label: string, min = 0): string {
  if (typeof v !== "string") return fail(400, "INVALID_FIELD", label + " must be text.");
  const s = v.trim();
  if (s.length < min || s.length > max) return fail(400, "INVALID_FIELD", label + " must be " + min + "–" + max + " characters.");
  return s;
}
export function labelFields(x: Record<string, unknown>) {
  return {
    nameFa: field(x.nameFa, 100, "Dari name", 2),
    namePs: field(x.namePs ?? "", 100, "Pashto name"),
    nameEn: field(x.nameEn ?? "", 100, "English name")
  };
}
export function bool(v: unknown, name: string): boolean {
  if (typeof v !== "boolean") return fail(400, "INVALID_FIELD", name + " must be true or false.");
  return v;
}
export function int(v: unknown, name: string, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max)
    return fail(400, "INVALID_FIELD", name + " must be a whole number between " + min + " and " + max + ".");
  return v;
}
export function bodyObject(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    return fail(400, "INVALID_BODY", "Expected a JSON object.");
  return req.body as Record<string, unknown>;
}
export function paramId(req: Request): string {
  const v = req.params.id;
  if (!v || typeof v !== "string" || v.length > 100) return fail(404, "NOT_FOUND", "Resource not found.");
  return v;
}
export function version(v: unknown): number { return int(v, "version", 1, 2_000_000_000); }
export function paging(req: Request): { page: number; limit: number; offset: number } {
  const raw = typeof req.query.page === "string" ? Number(req.query.page) : 1;
  const page = Number.isSafeInteger(raw) && raw >= 1 ? Math.min(raw, 100000) : 1;
  return { page, limit: 10, offset: (page - 1) * 10 };
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export async function changed(tx: Pick<typeof db, "insert">, scope: MenuScope, action: string, details: Record<string, unknown>) {
  await tx.insert(catalogRevision).values({ locationId: scope.locationId, tenantId: scope.tenantId, version: 1 })
    .onConflictDoUpdate({ target: catalogRevision.locationId,
      set: { version: sql`${catalogRevision.version} + 1`, changedAt: new Date() } });
  await tx.insert(auditEvent).values({
    id: randomUUID(), tenantId: scope.tenantId, userId: scope.actorId, action, details
  });
}
