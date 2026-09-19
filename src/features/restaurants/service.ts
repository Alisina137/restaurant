import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { audit, media, membership, restaurant, user } from "@/db/schema";
import type { Actor } from "@/lib/session";
import { HttpError } from "@/lib/http";
import { profileInput, updateInput, reviewInput } from "./validation";
import { z } from "zod";

export const publicFields = {
  id: restaurant.id,
  slug: restaurant.slug,
  name: restaurant.name,
  description: restaurant.description,
  city: restaurant.city,
  area: restaurant.area,
  address: restaurant.address,
  phone: restaurant.phone,
  cuisine: restaurant.cuisine,
  hours: restaurant.hours,
};
export async function member(
  db: Database,
  actor: Actor,
  id: string,
  ownerOnly = false,
) {
  z.string().uuid().parse(id);
  const [row] = await db
    .select()
    .from(membership)
    .where(
      and(eq(membership.userId, actor.id), eq(membership.restaurantId, id)),
    )
    .limit(1);
  if (!row || (ownerOnly && row.role !== "owner"))
    throw new HttpError(
      403,
      "You do not have permission to manage this restaurant.",
    );
  return row;
}
function verified(actor: Actor) {
  if (!actor.emailVerified)
    throw new HttpError(403, "Verify your email before managing a restaurant.");
}
export async function admin(db: Database, actor: Actor) {
  const [record] = await db
    .select({ isAdmin: user.isAdmin, verified: user.emailVerified })
    .from(user)
    .where(eq(user.id, actor.id));
  if (!record?.isAdmin || !record.verified)
    throw new HttpError(403, "Administrator access is required.");
}
export async function listPublic(db: Database) {
  return db
    .select(publicFields)
    .from(restaurant)
    .where(eq(restaurant.status, "approved"))
    .orderBy(desc(restaurant.createdAt))
    .limit(60);
}
export async function getPublic(db: Database, slug: string) {
  const [r] = await db
    .select(publicFields)
    .from(restaurant)
    .where(and(eq(restaurant.slug, slug), eq(restaurant.status, "approved")))
    .limit(1);
  if (!r) return null;
  const images = await db
    .select({ id: media.id, kind: media.kind })
    .from(media)
    .where(eq(media.restaurantId, r.id));
  return { ...r, images };
}
export async function owned(db: Database, actor: Actor) {
  return db
    .select({ restaurant, role: membership.role })
    .from(membership)
    .innerJoin(restaurant, eq(membership.restaurantId, restaurant.id))
    .where(eq(membership.userId, actor.id))
    .orderBy(desc(restaurant.createdAt));
}
export async function createRestaurant(
  db: Database,
  actor: Actor,
  raw: unknown,
) {
  verified(actor);
  const input = profileInput.parse(raw);
  try {
    return await db.transaction(async (tx) => {
      const [r] = await tx.insert(restaurant).values(input).returning();
      await tx
        .insert(membership)
        .values({ userId: actor.id, restaurantId: r.id, role: "owner" });
      await tx
        .insert(audit)
        .values({
          actorId: actor.id,
          restaurantId: r.id,
          action: "restaurant_created",
        });
      return r;
    });
  } catch (e) {
    if (constraintCode(e) === "23505")
      throw new HttpError(
        409,
        "This page address is already taken. Choose another.",
      );
    throw e;
  }
}
function constraintCode(e: unknown): string | undefined {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code || x?.cause?.code;
}
export async function updateRestaurant(
  db: Database,
  actor: Actor,
  id: string,
  raw: unknown,
) {
  verified(actor);
  await member(db, actor, id, true);
  const { version, ...data } = updateInput.parse(raw);
  try {
    return await db.transaction(async (tx) => {
      const [r] = await tx
        .update(restaurant)
        .set({
          ...data,
          status: "draft",
          reviewNote: "",
          version: version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(restaurant.id, id),
            eq(restaurant.version, version),
            sql`${restaurant.status} <> 'suspended'`,
          ),
        )
        .returning();
      if (!r)
        throw new HttpError(
          409,
          "This page changed or was suspended. Refresh before editing.",
        );
      await tx
        .insert(audit)
        .values({
          actorId: actor.id,
          restaurantId: id,
          action: "profile_updated_requires_review",
        });
      return r;
    });
  } catch (e) {
    if (constraintCode(e) === "23505")
      throw new HttpError(409, "This page address is already taken.");
    throw e;
  }
}
export async function submitRestaurant(
  db: Database,
  actor: Actor,
  id: string,
  version: number,
) {
  verified(actor);
  await member(db, actor, id, true);
  z.number().int().positive().parse(version);
  return db.transaction(async (tx) => {
    const [r] = await tx
      .update(restaurant)
      .set({
        status: "pending_review",
        reviewNote: "",
        version: version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(restaurant.id, id),
          eq(restaurant.version, version),
          sql`${restaurant.status} in ('draft', 'changes_requested')`,
        ),
      )
      .returning();
    if (!r)
      throw new HttpError(
        409,
        "This page is not ready to submit or has changed. Refresh and try again.",
      );
    await tx
      .insert(audit)
      .values({
        actorId: actor.id,
        restaurantId: id,
        action: "submitted_for_review",
      });
    return r;
  });
}
export async function reviewRestaurant(
  db: Database,
  actor: Actor,
  id: string,
  raw: unknown,
) {
  await admin(db, actor);
  z.string().uuid().parse(id);
  const input = reviewInput.parse(raw);
  const [own] = await db
    .select()
    .from(membership)
    .where(
      and(eq(membership.restaurantId, id), eq(membership.userId, actor.id)),
    );
  if (own)
    throw new HttpError(
      403,
      "Another administrator must review a restaurant you belong to.",
    );
  return db.transaction(async (tx) => {
    const allowed =
      input.decision === "suspended"
        ? sql`${restaurant.status} = 'approved'`
        : sql`${restaurant.status} in ('pending_review', 'suspended')`;
    const [r] = await tx
      .update(restaurant)
      .set({
        status: input.decision,
        reviewNote: input.note,
        version: input.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(restaurant.id, id),
          eq(restaurant.version, input.version),
          allowed,
        ),
      )
      .returning();
    if (!r)
      throw new HttpError(
        409,
        "The review state has changed. Refresh and try again.",
      );
    await tx
      .insert(audit)
      .values({
        actorId: actor.id,
        restaurantId: id,
        action: `review_${input.decision}`,
        detail: input.note,
      });
    return r;
  });
}
export async function addStaff(
  db: Database,
  actor: Actor,
  id: string,
  email: unknown,
) {
  verified(actor);
  await member(db, actor, id, true);
  const normalized = z.string().email().parse(email).trim().toLowerCase();
  const [target] = await db
    .select()
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);
  if (!target?.emailVerified)
    throw new HttpError(
      400,
      "Ask this person to register and verify their email first.",
    );
  if (target.id === actor.id)
    throw new HttpError(400, "You already own this restaurant.");
  const [result] = await db
    .insert(membership)
    .values({ restaurantId: id, userId: target.id, role: "staff" })
    .onConflictDoNothing()
    .returning();
  if (!result)
    throw new HttpError(409, "This person already belongs to the restaurant.");
  await db
    .insert(audit)
    .values({
      actorId: actor.id,
      restaurantId: id,
      action: "staff_added",
      detail: target.id,
    });
  return { id: result.id };
}
export async function removeStaff(
  db: Database,
  actor: Actor,
  id: string,
  membershipId: string,
) {
  verified(actor);
  await member(db, actor, id, true);
  z.string().uuid().parse(membershipId);
  return db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(membership)
      .where(
        and(
          eq(membership.id, membershipId),
          eq(membership.restaurantId, id),
          eq(membership.role, "staff"),
        ),
      )
      .returning();
    if (!removed) throw new HttpError(404, "Staff membership not found.");
    await tx
      .insert(audit)
      .values({
        actorId: actor.id,
        restaurantId: id,
        action: "staff_removed",
        detail: removed.userId,
      });
    return { removed: true };
  });
}
