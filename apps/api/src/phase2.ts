import { Router, type Request, type Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isLocale, isStaffRole, type StaffRole } from "@dineflow/shared";
import { auth } from "./auth";
import {MenuError} from "./menu-helpers";
import {assertCapacity} from "./phase12-entitlements";
import { db } from "./db";
import { contextFor, type IdentityContext } from "./context";
import { publicWebURL, sendEmail } from "./email";
import { auditEvent, location, onboardingClaim, onboardingDraft, platformAdmin, restaurantSetting,
  staffInvitation, tenant, tenantMembership, tenantTrial, tenantSubscription, user, userPreference } from "./schema";

type SessionUser = { id: string; name: string; email: string; verified: boolean };
type Handler = (req: Request, res: Response) => Promise<void>;
function route(handler: Handler) {
  return (req: Request, res: Response) => { void handler(req, res).catch((error: unknown) => {
    if(error instanceof MenuError){res.status(error.status).json({code:error.code,message:error.message});return;}
    console.error("P02 operation failed", error);
    if (!res.headersSent) res.status(503).json({ code: "SERVICE_UNAVAILABLE", message: "Please retry the action." });
  }); };
}
function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ code, message });
}
async function currentUser(req: Request, res: Response): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) { fail(res, 401, "UNAUTHENTICATED", "Please sign in."); return null; }
  const [person] = await db.select({ verified: user.emailVerified, email: user.email, name: user.name })
    .from(user).where(eq(user.id, session.user.id)).limit(1);
  if (!person) { fail(res, 401, "UNAUTHENTICATED", "Please sign in."); return null; }
  return { id: session.user.id, email: person.email.toLowerCase(), name: person.name, verified: person.verified };
}
async function scopedUser(req: Request, res: Response, roles: readonly StaffRole[] = ["owner", "manager"]) {
  const person = await currentUser(req, res);
  if (!person) return null;
  const context = await contextFor(person);
  if (!context || !context.tenantId || !roles.includes(context.role as StaffRole)) {
    fail(res, 403, "ACCESS_DENIED", "You do not have access to this restaurant."); return null;
  }
  return { person, context, tenantId: context.tenantId };
}
function str(v: unknown, max = 100): string { return typeof v === "string" ? v.trim().slice(0, max + 1) : ""; }
function validEmail(v: unknown): v is string { return typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function tokenHash(raw: string) { return createHash("sha256").update(raw).digest("hex"); }
function dateAfterHours(h: number) { return new Date(Date.now() + h * 3_600_000); }
function hasRole(role: string): role is StaffRole { return isStaffRole(role); }
/** Hours are informational only; the ordering policy is enforced elsewhere. Do not invent a reservation gate. */
const weekdays=["mon","tue","wed","thu","fri","sat","sun"] as const;
type ServiceHours=Record<string,null|{open:string;close:string}>;
function validClock(value:unknown):value is string {
 return typeof value==="string"&&/^([01]\\d|2[0-3]):[0-5]\\d$/.test(value);
}
function parseOpeningHours(value:unknown):ServiceHours {
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new MenuError(400,"INVALID_HOURS","Opening hours must be a day-by-day schedule.");
 const data=value as Record<string,unknown>,out:ServiceHours={};
 if(Object.keys(data).some(day=>!weekdays.includes(day as typeof weekdays[number])))
  throw new MenuError(400,"INVALID_HOURS","Opening hours include an unknown day.");
 for(const [day,entry] of Object.entries(data)){
  if(entry===null){out[day]=null;continue;}
  if(!entry||typeof entry!=="object"||Array.isArray(entry))
   throw new MenuError(400,"INVALID_HOURS","Choose closed or set opening and closing times.");
  const time=entry as Record<string,unknown>;
  if(Object.keys(time).some(key=>key!=="open"&&key!=="close")||
    !validClock(time.open)||!validClock(time.close)||time.open>=time.close)
   throw new MenuError(400,"INVALID_HOURS","Opening time must be earlier than closing time in 24-hour format.");
  out[day]={open:time.open,close:time.close};
 }
 return out;
}
type Draft = { name: string; slug: string; locationName: string; city: string; phone: string; address: string;
  timezone: string; locale: "fa-AF"|"ps-AF"|"en"; orderingPolicy: "waiter_approval"|"direct_to_kitchen";
  receiptFooter: string; acceptedTerms: boolean };
const defaults: Draft = { name: "", slug: "", locationName: "Main branch", city: "Kabul", phone: "", address: "",
  timezone: "Asia/Kabul", locale: "fa-AF", orderingPolicy: "waiter_approval", receiptFooter: "", acceptedTerms: false };
function parseDraft(value: unknown): Draft {
  const x = typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    name: str(x.name, 100), slug: str(x.slug, 48).toLowerCase(), locationName: str(x.locationName, 80),
    city: str(x.city, 80), phone: str(x.phone, 30), address: str(x.address, 200),
    timezone: str(x.timezone, 60) || defaults.timezone,
    locale: isLocale(x.locale) ? x.locale : defaults.locale,
    orderingPolicy: x.orderingPolicy === "direct_to_kitchen" ? "direct_to_kitchen" : "waiter_approval",
    receiptFooter: str(x.receiptFooter, 160), acceptedTerms: x.acceptedTerms === true
  };
}
function validDraft(d: Draft): string | null {
  if (d.name.length < 2 || d.name.length > 100) return "Restaurant name must contain 2–100 characters.";
  if (!/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/.test(d.slug)) return "Slug must have 3–48 lowercase letters, numbers or hyphens.";
  if (d.locationName.length < 2 || d.locationName.length > 80) return "Enter a valid branch name.";
  if (d.city.length < 2 || d.city.length > 80) return "Enter a valid city.";
  if (!Intl.supportedValuesOf("timeZone").includes(d.timezone) && d.timezone !== "Asia/Kabul") return "Select a valid timezone.";
  if (!d.acceptedTerms) return "You must confirm the terms to continue.";
  return null;
}
async function audit(actor: string, tenantId: string | null, action: string, details: Record<string, unknown> = {}) {
  await db.insert(auditEvent).values({ id: randomUUID(), userId: actor, tenantId, action, details });
}

export const onboardingRouter = Router();
onboardingRouter.get("/status", route(async (req, res) => {
  const person = await currentUser(req, res); if (!person) return;
  const [claim] = await db.select({ tenantId: onboardingClaim.tenantId })
    .from(onboardingClaim).where(eq(onboardingClaim.userId, person.id)).limit(1);
  const membership = await contextFor(person);
  res.json({ user: person, tenantId: claim?.tenantId ?? membership?.tenantId ?? null,
    defaultRoute: membership?.defaultRoute ?? null, mayCreate: !claim && person.verified && !membership });
}));
onboardingRouter.get("/draft", route(async (req, res) => {
  const person = await currentUser(req, res); if (!person) return;
  const [draft] = await db.select({ payload: onboardingDraft.payload }).from(onboardingDraft)
    .where(eq(onboardingDraft.userId, person.id)).limit(1);
  res.json({ draft: { ...defaults, ...(draft?.payload as object ?? {}) } });
}));
onboardingRouter.put("/draft", route(async (req, res) => {
  const person = await currentUser(req, res); if (!person) return;
  if (!person.verified) { fail(res, 403, "EMAIL_UNVERIFIED", "Verify your email before setup."); return; }
  const draft = parseDraft(req.body);
  if (JSON.stringify(req.body).length > 5000) { fail(res, 400, "INVALID_DRAFT", "Draft is too large."); return; }
  await db.insert(onboardingDraft).values({ userId: person.id, payload: draft })
    .onConflictDoUpdate({ target: onboardingDraft.userId, set: { payload: draft, updatedAt: new Date() } });
  res.json({ draft, saved: true });
}));
onboardingRouter.post("/complete", route(async (req, res) => {
  const person = await currentUser(req, res); if (!person) return;
  if (!person.verified) { fail(res, 403, "EMAIL_UNVERIFIED", "Verify your email before setup."); return; }
  const existing = await db.select({ tenantId: onboardingClaim.tenantId }).from(onboardingClaim)
    .where(eq(onboardingClaim.userId, person.id)).limit(1);
  if (existing.length) { res.json({ tenantId: existing[0]!.tenantId, created: false }); return; }
  const isPlatform = await db.select({ id: platformAdmin.userId }).from(platformAdmin)
    .where(eq(platformAdmin.userId, person.id)).limit(1);
  if (isPlatform.length) { fail(res, 403, "ACCESS_DENIED", "Platform operators cannot register a restaurant from this account."); return; }
  const draft = parseDraft(req.body); const error = validDraft(draft);
  if (error) { fail(res, 400, "INVALID_RESTAURANT", error); return; }
  const tenantId = randomUUID(), locationId = randomUUID();
  const days = Math.max(1, Math.min(90, Number(process.env.TRIAL_DAYS) || 14));
  try {
    await db.transaction(async (tx) => {
      await tx.insert(tenant).values({ id: tenantId, slug: draft.slug, name: draft.name, status: "trial" });
      await tx.insert(location).values({ id: locationId, tenantId, name: draft.locationName, city: draft.city });
      await tx.insert(restaurantSetting).values({ tenantId, phone: draft.phone || null, address: draft.address || null,
        timezone: draft.timezone, locale: draft.locale, orderingPolicy: draft.orderingPolicy, receiptFooter: draft.receiptFooter });
      await tx.insert(tenantMembership).values({ id: randomUUID(), tenantId, userId: person.id, role: "owner" });
      await tx.insert(onboardingClaim).values({ userId: person.id, tenantId });
      const ends=dateAfterHours(days*24);
      await tx.insert(tenantTrial).values({ tenantId, expiresAt: ends });
      await tx.insert(tenantSubscription).values({tenantId,planId:"starter-v1",status:"trial",trialEndsAt:ends});
      await tx.insert(userPreference).values({ userId: person.id, locale: draft.locale, activeTenantId: tenantId })
        .onConflictDoUpdate({ target: userPreference.userId, set: { locale: draft.locale, activeTenantId: tenantId, updatedAt: new Date() } });
      await tx.insert(auditEvent).values({ id: randomUUID(), userId: person.id, tenantId, action: "tenant.created",
        details: { slug: draft.slug, locationId, trialDays: days } });
    });
    res.status(201).json({ created: true, tenantId, defaultRoute: "/app/overview" });
  } catch (err) {
    const dbError = err as { code?: string; cause?: { code?: string } };
    if (dbError.code === "23505" || dbError.cause?.code === "23505") {
      const [claim] = await db.select({ tenantId: onboardingClaim.tenantId }).from(onboardingClaim)
        .where(eq(onboardingClaim.userId, person.id)).limit(1);
      if (claim) { res.json({ created: false, tenantId: claim.tenantId }); return; }
      fail(res, 409, "SLUG_TAKEN", "This restaurant address is already taken."); return;
    }
    throw err;
  }
}));

export const staffRouter = Router();
staffRouter.get("/setup", route(async (req, res) => {
  const data = await scopedUser(req, res); if (!data) return;
  const [branches, settings, staffCount, pending, trial] = await Promise.all([
    db.select().from(location).where(eq(location.tenantId, data.tenantId)).limit(1),
    db.select().from(restaurantSetting).where(eq(restaurantSetting.tenantId, data.tenantId)).limit(1),
    db.select({ total: count() }).from(tenantMembership).where(and(eq(tenantMembership.tenantId, data.tenantId), eq(tenantMembership.status, "active"))),
    db.select({ total: count() }).from(staffInvitation).where(and(eq(staffInvitation.tenantId, data.tenantId), eq(staffInvitation.status, "pending"))),
    db.select().from(tenantTrial).where(eq(tenantTrial.tenantId, data.tenantId)).limit(1)
  ]);
  res.json({ restaurant: data.context.tenantName, location: branches[0] ?? null, settings: settings[0] ?? null,
    teamCount: staffCount[0]?.total ?? 0, pendingInvites: pending[0]?.total ?? 0,
    trialExpiresAt: trial[0]?.expiresAt ?? null });
}));
staffRouter.get("/settings", route(async (req, res) => {
  const data = await scopedUser(req, res); if (!data) return;
  const [setting] = await db.select().from(restaurantSetting).where(eq(restaurantSetting.tenantId, data.tenantId)).limit(1);
  const [branch] = await db.select().from(location).where(eq(location.tenantId, data.tenantId)).limit(1);
  const [org] = await db.select().from(tenant).where(eq(tenant.id, data.tenantId)).limit(1);
  res.setHeader("Cache-Control","private, no-store, max-age=0");
  res.json({ setting: setting ?? null, location: branch ?? null, restaurant: org ?? null });
}));
staffRouter.patch("/settings", route(async (req, res) => {
  const data = await scopedUser(req, res, ["owner"]); if (!data) return;
  const body = req.body as Record<string, unknown>;
  const name = str(body.name, 100), locationName = str(body.locationName, 80), city = str(body.city, 80);
  const phone = str(body.phone, 30), address = str(body.address, 200), timezone = str(body.timezone, 60);
  const locale = body.locale, receiptFooter = str(body.receiptFooter, 160);
  if (name.length < 2 || name.length > 100 || locationName.length < 2 || city.length < 2 ||
      locationName.length > 80 || city.length > 80 ||
      !isLocale(locale) || (!Intl.supportedValuesOf("timeZone").includes(timezone) && timezone !== "Asia/Kabul") ||
      phone.length > 30 || address.length > 200 || receiptFooter.length > 160 ||
      typeof body.managerCanInvite !== "boolean") {
    fail(res, 400, "INVALID_SETTINGS", "Please correct the restaurant settings."); return;
  }
  // Old clients may omit these fields; do not silently erase a configured timetable.
  const hours=body.openingHours===undefined?undefined:parseOpeningHours(body.openingHours);
  const expected=body.expectedUpdatedAt;
  if(expected!==undefined&&(typeof expected!=="string"||
    !Number.isFinite(Date.parse(expected))||expected.length>40))
    throw new MenuError(400,"INVALID_VERSION","Refresh restaurant settings before saving.");
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT tenant_id FROM restaurant_settings WHERE tenant_id=${data.tenantId} FOR UPDATE`);
    const [current]=await tx.select({updatedAt:restaurantSetting.updatedAt})
      .from(restaurantSetting).where(eq(restaurantSetting.tenantId,data.tenantId)).limit(1);
    if(!current)throw new MenuError(404,"NOT_FOUND","Restaurant settings unavailable.");
    if(typeof expected==="string"&&current.updatedAt.getTime()!==new Date(expected).getTime())
      throw new MenuError(409,"VERSION_CONFLICT","Settings changed elsewhere. Reload to review the latest values.");
    const updatedAt=new Date(Math.max(Date.now(),current.updatedAt.getTime()+1));
    await tx.update(tenant).set({ name }).where(eq(tenant.id, data.tenantId));
    await tx.update(location).set({ name: locationName, city }).where(eq(location.tenantId, data.tenantId));
    await tx.update(restaurantSetting).set({ phone: phone || null, address: address || null, timezone,
      locale, receiptFooter, managerCanInvite: body.managerCanInvite as boolean,
      ...(hours!==undefined?{openingHours:hours}:{}),updatedAt })
      .where(eq(restaurantSetting.tenantId, data.tenantId));
    await tx.insert(auditEvent).values({ id: randomUUID(), userId: data.person.id, tenantId: data.tenantId,
      action: "tenant.settings_updated", details: { name, locationName, city, timezone, locale,
        openingHoursChanged:hours!==undefined,managerCanInvite:body.managerCanInvite } });
  });
  res.setHeader("Cache-Control","private, no-store, max-age=0");
  res.json({ saved: true });
}));
staffRouter.get("/staff", route(async (req, res) => {
  const data = await scopedUser(req, res); if (!data) return;
  const page = Math.max(1, Math.min(500, Number(req.query.page) || 1)), perPage = 10;
  const [rows, totals] = await Promise.all([
    db.select({ id: tenantMembership.id, role: tenantMembership.role, status: tenantMembership.status,
      createdAt: tenantMembership.createdAt, email: user.email, name: user.name, userId: user.id })
      .from(tenantMembership).innerJoin(user, eq(tenantMembership.userId, user.id))
      .where(eq(tenantMembership.tenantId, data.tenantId))
      .orderBy(asc(user.name), asc(tenantMembership.id)).limit(perPage).offset((page - 1) * perPage),
    db.select({ total: count() }).from(tenantMembership).where(eq(tenantMembership.tenantId, data.tenantId))
  ]);
  res.json({ items: rows, total: totals[0]?.total ?? 0, page, perPage });
}));
staffRouter.patch("/staff/:id", route(async (req, res) => {
  const data = await scopedUser(req, res); if (!data) return;
  const role = req.body?.role, status = req.body?.status;
  if (!hasRole(role) || (status !== "active" && status !== "disabled")) {
    fail(res, 400, "INVALID_MEMBERSHIP", "Choose a valid role and status."); return;
  }
  try {
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM tenants WHERE id = ${data.tenantId} FOR UPDATE`);
      const [target] = await tx.select().from(tenantMembership)
        .where(and(eq(tenantMembership.id, (req.params.id ?? "")), eq(tenantMembership.tenantId, data.tenantId))).limit(1);
      if (!target) return "NOT_FOUND";
      if (data.context.role === "manager" && (target.role === "owner" || target.role === "manager" || role === "owner" || role === "manager")) return "ACCESS_DENIED";
      if (target.userId === data.person.id && status === "disabled") return "SELF_DISABLE";
      if (target.role === "owner" && (role !== "owner" || status === "disabled")) {
        const owners = await tx.select({ total: count() }).from(tenantMembership)
          .where(and(eq(tenantMembership.tenantId, data.tenantId), eq(tenantMembership.role, "owner"), eq(tenantMembership.status, "active")));
        if ((owners[0]?.total ?? 0) <= 1) return "LAST_OWNER";
      }
      await tx.update(tenantMembership).set({ role, status })
        .where(and(eq(tenantMembership.id, target.id), eq(tenantMembership.tenantId, data.tenantId)));
      await tx.insert(auditEvent).values({ id: randomUUID(), userId: data.person.id, tenantId: data.tenantId,
        action: "staff.membership_updated", details: { membershipId: target.id, fromRole: target.role,
          toRole: role, fromStatus: target.status, toStatus: status } });
      return "OK";
    });
    if (outcome !== "OK") { fail(res, outcome === "NOT_FOUND" ? 404 : 403, outcome, outcome === "LAST_OWNER" ?
      "Transfer ownership before disabling the last owner." : "Cannot change this membership."); return; }
    res.json({ saved: true });
  } catch (err) { throw err; }
}));
async function mayInvite(req: Request, res: Response) {
  const data = await scopedUser(req, res); if (!data) return null;
  if (data.context.role === "manager") {
    const [setting] = await db.select({ allowed: restaurantSetting.managerCanInvite }).from(restaurantSetting)
      .where(eq(restaurantSetting.tenantId, data.tenantId)).limit(1);
    if (!setting?.allowed) { fail(res, 403, "INVITES_DISABLED", "Owner permission is required to invite staff."); return null; }
  }
  return data;
}
async function dispatchInvite(id: string, token: string, email: string, tenantName: string, message: string) {
  const url = publicWebURL("/auth/invite/" + encodeURIComponent(token));
  try {
    await sendEmail(email, "Invitation to " + tenantName + " on DineFlow",
      "You were invited to join " + tenantName + ".\n" + (message ? message + "\n" : "") +
      "Open this single-use link within 48 hours:\n" + url + "\n");
    await db.update(staffInvitation).set({ deliveryStatus: "sent", lastSentAt: new Date(),
      sendAttempts: sql`${staffInvitation.sendAttempts} + 1` }).where(eq(staffInvitation.id, id));
    return true;
  } catch (err) {
    await db.update(staffInvitation).set({ deliveryStatus: "failed", lastSentAt: new Date(),
      sendAttempts: sql`${staffInvitation.sendAttempts} + 1` }).where(eq(staffInvitation.id, id));
    console.warn("Invitation email not sent", err instanceof Error ? err.message : "Unknown error");
    return false;
  }
}
staffRouter.get("/invitations", route(async (req, res) => {
  const data = await scopedUser(req, res); if (!data) return;
  const page = Math.max(1, Math.min(500, Number(req.query.page) || 1)), perPage = 10;
  const [rows, totals] = await Promise.all([
    db.select({ id: staffInvitation.id, email: staffInvitation.email, role: staffInvitation.role,
      status: staffInvitation.status, deliveryStatus: staffInvitation.deliveryStatus,
      expiresAt: staffInvitation.expiresAt, createdAt: staffInvitation.createdAt,
      acceptedAt: staffInvitation.acceptedAt, sendAttempts: staffInvitation.sendAttempts })
      .from(staffInvitation).where(eq(staffInvitation.tenantId, data.tenantId))
      .orderBy(desc(staffInvitation.createdAt)).limit(perPage).offset((page - 1) * perPage),
    db.select({ total: count() }).from(staffInvitation).where(eq(staffInvitation.tenantId, data.tenantId))
  ]);
  res.json({ items: rows.map((row) => ({ ...row, status: row.status === "pending" && row.expiresAt < new Date() ?
    "expired" : row.status })), total: totals[0]?.total ?? 0, page, perPage });
}));
staffRouter.post("/invitations", route(async (req, res) => {
  const data = await mayInvite(req, res); if (!data) return;
  const email = str(req.body?.email, 254).toLowerCase(), role = req.body?.role;
  const message = str(req.body?.message, 280);
  if (!validEmail(email) || !hasRole(role) || (role === "owner" && data.context.role !== "owner") ||
      (data.context.role === "manager" && role === "manager") || message.length > 280) {
    fail(res, 400, "INVALID_INVITATION", "Check the recipient and role."); return;
  }
  const activeUser = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (activeUser.length) {
    const existing = await db.select().from(tenantMembership)
      .where(and(eq(tenantMembership.tenantId, data.tenantId), eq(tenantMembership.userId, activeUser[0]!.id), eq(tenantMembership.status, "active"))).limit(1);
    if (existing.length) { fail(res, 409, "ALREADY_MEMBER", "This person already belongs to the restaurant."); return; }
  }
  const pending = await db.select().from(staffInvitation)
    .where(and(eq(staffInvitation.tenantId, data.tenantId), eq(staffInvitation.email, email),
      eq(staffInvitation.status, "pending")));
  if (pending.some((entry) => entry.expiresAt > new Date())) {
    fail(res, 409, "INVITATION_PENDING", "An invitation already exists. Resend or revoke it first."); return;
  }
  const token = randomBytes(32).toString("base64url"), id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM tenants WHERE id=${data.tenantId} FOR UPDATE`);
    await assertCapacity(tx,data.tenantId,"staff");
    for (const item of pending) await tx.update(staffInvitation).set({ status: "revoked" }).where(eq(staffInvitation.id, item.id));
    await tx.insert(staffInvitation).values({ id, tenantId: data.tenantId, email, role,
      tokenHash: tokenHash(token), expiresAt: dateAfterHours(48), invitedBy: data.person.id, message });
    await tx.insert(auditEvent).values({ id: randomUUID(), userId: data.person.id, tenantId: data.tenantId,
      action: "staff.invited", details: { invitationId: id, role } });
  });
  const sent = await dispatchInvite(id, token, email, data.context.tenantName ?? "your restaurant", message);
  res.status(sent ? 201 : 202).json({ id, deliveryStatus: sent ? "sent" : "failed",
    message: sent ? "Invitation email sent." : "Invitation saved but email delivery failed. Configure email and use Resend." });
}));
staffRouter.post("/invitations/:id/resend", route(async (req, res) => {
  const data = await mayInvite(req, res); if (!data) return;
  const invite = await db.select().from(staffInvitation)
    .where(and(eq(staffInvitation.id, (req.params.id ?? "")), eq(staffInvitation.tenantId, data.tenantId))).limit(1);
  if (!invite.length || invite[0]!.status !== "pending") { fail(res, 409, "INVITATION_UNAVAILABLE", "Invitation cannot be resent."); return; }
  if (data.context.role === "manager" && (invite[0]!.role === "owner" || invite[0]!.role === "manager")) {
    fail(res, 403, "ACCESS_DENIED", "You cannot resend this invitation."); return;
  }
  const token = randomBytes(32).toString("base64url");
  await db.update(staffInvitation).set({ tokenHash: tokenHash(token), expiresAt: dateAfterHours(48), deliveryStatus: "pending" })
    .where(and(eq(staffInvitation.id, invite[0]!.id), eq(staffInvitation.tenantId, data.tenantId)));
  await audit(data.person.id, data.tenantId, "staff.invitation_resent", { invitationId: invite[0]!.id });
  const sent = await dispatchInvite(invite[0]!.id, token, invite[0]!.email, data.context.tenantName ?? "your restaurant", invite[0]!.message);
  res.status(sent ? 200 : 202).json({ deliveryStatus: sent ? "sent" : "failed",
    message: sent ? "Invitation resent." : "Invitation saved but email delivery failed." });
}));
staffRouter.post("/invitations/:id/revoke", route(async (req, res) => {
  const data = await mayInvite(req, res); if (!data) return;
  const [entry] = await db.select().from(staffInvitation)
    .where(and(eq(staffInvitation.id, (req.params.id ?? "")), eq(staffInvitation.tenantId, data.tenantId))).limit(1);
  if (!entry || entry.status !== "pending") { fail(res, 409, "INVITATION_UNAVAILABLE", "Invitation is not pending."); return; }
  if (data.context.role === "manager" && (entry.role === "owner" || entry.role === "manager")) {
    fail(res, 403, "ACCESS_DENIED", "You cannot revoke this invitation."); return;
  }
  await db.update(staffInvitation).set({ status: "revoked" })
    .where(and(eq(staffInvitation.id, entry.id), eq(staffInvitation.tenantId, data.tenantId), eq(staffInvitation.status, "pending")));
  await audit(data.person.id, data.tenantId, "staff.invitation_revoked", { invitationId: entry.id });
  res.json({ revoked: true });
}));

export const publicInvitationRouter = Router();
publicInvitationRouter.get("/:token", route(async (req, res) => {
  const token = str(req.params.token, 128);
  if (token.length < 30) { fail(res, 404, "INVITATION_INVALID", "Invitation unavailable."); return; }
  const [entry] = await db.select({ email: staffInvitation.email, role: staffInvitation.role,
    status: staffInvitation.status, expiresAt: staffInvitation.expiresAt, name: tenant.name })
    .from(staffInvitation).innerJoin(tenant, eq(staffInvitation.tenantId, tenant.id))
    .where(eq(staffInvitation.tokenHash, tokenHash(token))).limit(1);
  if (!entry || entry.status !== "pending" || entry.expiresAt <= new Date()) {
    fail(res, 404, "INVITATION_INVALID", "This link is expired or revoked. Ask the owner to resend."); return;
  }
  res.json({ restaurant: entry.name, email: entry.email, role: entry.role, expiresAt: entry.expiresAt });
}));
publicInvitationRouter.post("/:token/accept", route(async (req, res) => {
  const person = await currentUser(req, res); if (!person) return;
  if (!person.verified) { fail(res, 403, "EMAIL_UNVERIFIED", "Verify your email to accept your invitation."); return; }
  const token = str(req.params.token, 128);
  const outcome = await db.transaction(async (tx) => {
    // A conditional update is the single-use claim: only one concurrent accept succeeds.
    const [entry] = await tx.update(staffInvitation).set({ status: "accepted", acceptedBy: person.id, acceptedAt: new Date() })
      .where(and(eq(staffInvitation.tokenHash, tokenHash(token)), eq(staffInvitation.status, "pending"),
        sql`${staffInvitation.expiresAt} > now()`, eq(staffInvitation.email, person.email))).returning();
    if (!entry) return null;
    const [existing] = await tx.select().from(tenantMembership)
      .where(and(eq(tenantMembership.tenantId, entry.tenantId), eq(tenantMembership.userId, person.id))).limit(1);
    if (existing) {
      await tx.update(tenantMembership).set({ status: "active", role: entry.role })
        .where(eq(tenantMembership.id, existing.id));
    } else {
      await tx.insert(tenantMembership).values({ id: randomUUID(), tenantId: entry.tenantId, userId: person.id, role: entry.role });
    }
    await tx.insert(userPreference).values({ userId: person.id, activeTenantId: entry.tenantId })
      .onConflictDoUpdate({ target: userPreference.userId, set: { activeTenantId: entry.tenantId, updatedAt: new Date() } });
    await tx.insert(auditEvent).values({ id: randomUUID(), userId: person.id, tenantId: entry.tenantId,
      action: "staff.invitation_accepted", details: { invitationId: entry.id, role: entry.role } });
    return entry.tenantId;
  });
  if (!outcome) { fail(res, 409, "INVITATION_UNAVAILABLE", "Invitation expired, already used, or belongs to a different email."); return; }
  res.json({ tenantId: outcome, accepted: true });
}));

export const platformRestaurantRouter = Router();
platformRestaurantRouter.get("/", route(async (req, res) => {
  const person = await currentUser(req, res); if (!person) return;
  const admin = await db.select().from(platformAdmin).where(eq(platformAdmin.userId, person.id)).limit(1);
  if (!admin.length) { fail(res, 403, "ACCESS_DENIED", "Platform administrators only."); return; }
  const page = Math.max(1, Math.min(500, Number(req.query.page) || 1));
  const [rows, totals] = await Promise.all([
    db.select({ id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status, createdAt: tenant.createdAt })
      .from(tenant).orderBy(desc(tenant.createdAt)).limit(10).offset((page - 1) * 10),
    db.select({ total: count() }).from(tenant)
  ]);
  res.json({ items: rows, total: totals[0]?.total ?? 0, page, perPage: 10 });
}));
platformRestaurantRouter.get("/:id", route(async (req, res) => {
  const person = await currentUser(req, res); if (!person) return;
  const admin = await db.select().from(platformAdmin).where(eq(platformAdmin.userId, person.id)).limit(1);
  if (!admin.length) { fail(res, 403, "ACCESS_DENIED", "Platform administrators only."); return; }
  const [org] = await db.select({ id: tenant.id, name: tenant.name, slug: tenant.slug,
    status: tenant.status, createdAt: tenant.createdAt }).from(tenant).where(eq(tenant.id, (req.params.id ?? ""))).limit(1);
  if (!org) { fail(res, 404, "NOT_FOUND", "Restaurant not found."); return; }
  const [branches, subscriptions, memberships] = await Promise.all([
    db.select({ name: location.name, city: location.city }).from(location).where(eq(location.tenantId, org.id)).limit(1),
    db.select({ startedAt: tenantTrial.startedAt, expiresAt: tenantTrial.expiresAt })
      .from(tenantTrial).where(eq(tenantTrial.tenantId, org.id)).limit(1),
    db.select({ total: count() }).from(tenantMembership)
      .where(and(eq(tenantMembership.tenantId, org.id), eq(tenantMembership.status, "active")))
  ]);
  res.json({ restaurant: org, location: branches[0] ?? null, trial: subscriptions[0] ?? null,
    staffCount: memberships[0]?.total ?? 0 });
}));
