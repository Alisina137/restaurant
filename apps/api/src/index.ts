import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { isLocale } from "@dineflow/shared";
import { auth } from "./auth";
import { db } from "./db";
import { auditEvent, tenantMembership, userPreference } from "./schema";
import { contextFor, type IdentityContext } from "./context";
import { canAccessTenant } from "./tenant-access";
import { onboardingRouter, staffRouter, publicInvitationRouter, platformRestaurantRouter } from "./phase2";
import { categoryRouter } from "./menu-categories";
import { groupRouter } from "./menu-groups";
import { itemRouter } from "./menu-items";
import { imageRouter } from "./menu-images";
import { catalogRouter } from "./menu-catalog";
import { sectionRouter } from "./floor-sections";
import { tableRouter } from "./floor-tables";
import { visitRouter } from "./floor-visits";
import { floorLiveRouter } from "./floor-live";
import { orderRouter } from "./order-routes";
import { serviceRouter } from "./phase6-service";
import {guestPublicRouter} from "./guest-public";
import {guestOrdersRouter} from "./guest-orders";
import {guestStaffRouter} from "./guest-staff";
import {financeRouter} from "./finance-routes";
import {financeHistoryRouter,guestFinanceRouter} from "./finance-history";
import {guestAssistanceRouter,staffAssistanceRouter} from "./phase8-requests";

const app = express();
app.disable("x-powered-by");
const origins = (process.env.TRUSTED_ORIGINS ?? "http://localhost:3000").split(",").map((x) => x.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.includes(origin)); }, credentials: true }));
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => { res.json({ status: "ok" }); });
app.get("/api/health/ready", async (_req, res) => {
  try { await db.execute(sql`select 1`); res.json({ status: "ready" }); }
  catch { res.status(503).json({ code: "DB_UNAVAILABLE", message: "Database unavailable" }); }
});
app.use("/api/onboarding", onboardingRouter);
app.use("/api/tenant", staffRouter);
app.use("/api/invitations", publicInvitationRouter);
app.use("/api/platform/restaurants", platformRestaurantRouter);
app.use("/api/menu/categories", categoryRouter);
app.use("/api/menu/groups", groupRouter);
app.use("/api/menu/items", itemRouter);
app.use("/api/menu/images", imageRouter);
app.use("/api/menu", catalogRouter);
app.use("/api/floor/sections", sectionRouter);
app.use("/api/floor/tables", tableRouter);
app.use("/api/floor/visits", visitRouter);
app.use("/api/floor", floorLiveRouter);
app.use("/api/orders", orderRouter);
app.use("/api/orders", serviceRouter);
app.use("/api/guest",guestPublicRouter);
app.use("/api/guest",guestOrdersRouter);
app.use("/api/guest/staff",guestStaffRouter);
app.use("/api/finance",financeRouter);
app.use("/api/finance",financeHistoryRouter);
app.use("/api/guest",guestFinanceRouter);
app.use("/api/guest",guestAssistanceRouter);
app.use("/api/service",staffAssistanceRouter);

type AuthorizedRequest = Request & { identity?: IdentityContext };
async function requireIdentity(req: AuthorizedRequest, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) { res.status(401).json({ code: "UNAUTHENTICATED", message: "Sign in required" }); return; }
    const identity = await contextFor({ id: session.user.id, email: session.user.email, name: session.user.name });
    if (!identity) { res.status(403).json({ code: "NO_MEMBERSHIP", message: "No active assigned role" }); return; }
    req.identity = identity;
    next();
  } catch (error) {
    console.error("identity request failed", error);
    res.status(503).json({ code: "SERVICE_UNAVAILABLE", message: "Please try again" });
  }
}
app.get("/api/context", requireIdentity, (req: AuthorizedRequest, res) => res.json(req.identity));
app.get("/api/tenants/:tenantId/access", requireIdentity, (req: AuthorizedRequest, res) => {
  const tenantId = req.params.tenantId;
  if (!req.identity || typeof tenantId !== "string" || !canAccessTenant(req.identity, tenantId)) {
    res.status(404).json({ code: "NOT_FOUND", message: "Restaurant unavailable" });
    return;
  }
  res.json({ tenantId: req.identity.tenantId, name: req.identity.tenantName, role: req.identity.role });
});
app.put("/api/preferences/locale", requireIdentity, async (req: AuthorizedRequest, res) => {
  const locale = req.body?.locale;
  if (!isLocale(locale)) { res.status(400).json({ code: "INVALID_LOCALE", message: "Unsupported language" }); return; }
  const userId = req.identity!.user.id;
  try {
    await db.insert(userPreference).values({ userId, locale }).onConflictDoUpdate({
      target: userPreference.userId, set: { locale, updatedAt: new Date() }
    });
    res.json({ locale });
  } catch { res.status(503).json({ code: "SAVE_FAILED", message: "Could not save preference" }); }
});
app.put("/api/context/tenant", requireIdentity, async (req: AuthorizedRequest, res) => {
  const tenantId = req.body?.tenantId;
  const identity = req.identity!;
  if (identity.role === "platform_admin" || typeof tenantId !== "string" || !identity.memberships.some((m) => m.tenantId === tenantId)) {
    res.status(403).json({ code: "ACCESS_DENIED", message: "Not an active member" });
    return;
  }
  const userId = identity.user.id;
  try {
    await db.transaction(async (tx) => {
      const [membership] = await tx.select({ id: tenantMembership.id }).from(tenantMembership)
        .where(and(eq(tenantMembership.userId, userId), eq(tenantMembership.tenantId, tenantId), eq(tenantMembership.status, "active"))).limit(1);
      if (!membership) throw new Error("MEMBERSHIP_REVOKED");
      await tx.insert(userPreference).values({ userId, activeTenantId: tenantId }).onConflictDoUpdate({
        target: userPreference.userId, set: { activeTenantId: tenantId, updatedAt: new Date() }
      });
      await tx.insert(auditEvent).values({ id: randomUUID(), userId, tenantId, action: "context.tenant_switch", details: {} });
    });
    res.json({ selected: tenantId });
  } catch { res.status(409).json({ code: "MEMBERSHIP_CHANGED", message: "Access changed, refresh and try again" }); }
});
app.use((_req, res) => res.status(404).json({ code: "NOT_FOUND", message: "Route unavailable" }));
app.use((_error: unknown, _req: Request, res: Response, _next: NextFunction) => res.status(400).json({ code: "BAD_REQUEST", message: "Invalid request" }));
const port = Number(process.env.PORT ?? "4000");
app.listen(port, () => console.info("DineFlow API listening on port " + port));
