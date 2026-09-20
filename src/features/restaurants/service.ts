import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import type { Database } from "@/db";
import {
  audit,
  media,
  membership,
  restaurant,
  restaurantRevision,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/session";
import { HttpError } from "@/lib/http";
import { deleteImage } from "@/lib/storage";
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
  deliveryAvailable: restaurant.deliveryAvailable,
  pickupAvailable: restaurant.pickupAvailable,
  acceptingOrders: restaurant.acceptingOrders,
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
    .where(and(eq(media.restaurantId, r.id), isNotNull(media.storageKey)));
  return { ...r, images };
}
export async function owned(db: Database, actor: Actor) {
  const rows = await db
    .select({ restaurant, role: membership.role })
    .from(membership)
    .innerJoin(restaurant, eq(membership.restaurantId, restaurant.id))
    .where(eq(membership.userId, actor.id))
    .orderBy(desc(restaurant.createdAt));
  if (!rows.length) return [];
  const revisions = await db
    .select()
    .from(restaurantRevision)
    .where(
      inArray(
        restaurantRevision.restaurantId,
        rows.map((row) => row.restaurant.id),
      ),
    );
  const byRestaurant = new Map(
    revisions.map((revision) => [revision.restaurantId, revision]),
  );
  return rows.map((row) => ({
    ...row,
    revision: byRestaurant.get(row.restaurant.id) || null,
  }));
}

export async function managementProfile(
  db: Database,
  actor: Actor,
  id: string,
  ownerOnly = false,
) {
  await member(db, actor, id, ownerOnly);
  const [[base], [revision]] = await Promise.all([
    db.select().from(restaurant).where(eq(restaurant.id, id)),
    db
      .select()
      .from(restaurantRevision)
      .where(eq(restaurantRevision.restaurantId, id)),
  ]);
  if (!base) throw new HttpError(404, "Restaurant not found.");
  return {
    restaurant: base,
    revision: revision || null,
    profile: revision || base,
    published: base.status === "approved",
  };
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
      await tx.insert(audit).values({
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
      const [[base], [revision], conflictingRestaurants, conflictingRevisions] =
        await Promise.all([
          tx.select().from(restaurant).where(eq(restaurant.id, id)),
          tx
            .select()
            .from(restaurantRevision)
            .where(eq(restaurantRevision.restaurantId, id)),
          tx
            .select({ id: restaurant.id })
            .from(restaurant)
            .where(and(eq(restaurant.slug, data.slug), ne(restaurant.id, id))),
          tx
            .select({ id: restaurantRevision.id })
            .from(restaurantRevision)
            .where(
              and(
                eq(restaurantRevision.slug, data.slug),
                ne(restaurantRevision.restaurantId, id),
              ),
            ),
        ]);
      if (!base || base.status === "suspended")
        throw new HttpError(
          409,
          "This restaurant is suspended. Contact an administrator.",
        );
      if (conflictingRestaurants.length || conflictingRevisions.length)
        throw new HttpError(409, "This page address is already taken.");

      if (base.status === "approved") {
        if (revision) {
          const [updated] = await tx
            .update(restaurantRevision)
            .set({
              ...data,
              status: "draft",
              reviewNote: "",
              version: version + 1,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(restaurantRevision.id, revision.id),
                eq(restaurantRevision.version, version),
                sql`${restaurantRevision.status} <> 'pending_review'`,
              ),
            )
            .returning();
          if (!updated)
            throw new HttpError(
              409,
              "This revision changed or is already under review. Refresh first.",
            );
          await tx.insert(audit).values({
            actorId: actor.id,
            restaurantId: id,
            action: "profile_revision_updated",
          });
          return { ...updated, id, isRevision: true };
        }
        if (base.version !== version)
          throw new HttpError(
            409,
            "This page changed. Refresh before editing.",
          );
        const [created] = await tx
          .insert(restaurantRevision)
          .values({ restaurantId: id, ...data })
          .returning();
        await tx.insert(audit).values({
          actorId: actor.id,
          restaurantId: id,
          action: "profile_revision_created",
        });
        return { ...created, id, isRevision: true };
      }

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
      await tx.insert(audit).values({
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
    const [revision] = await tx
      .select()
      .from(restaurantRevision)
      .where(eq(restaurantRevision.restaurantId, id));
    if (revision) {
      const [submitted] = await tx
        .update(restaurantRevision)
        .set({
          status: "pending_review",
          reviewNote: "",
          version: version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(restaurantRevision.id, revision.id),
            eq(restaurantRevision.version, version),
            sql`${restaurantRevision.status} in ('draft', 'changes_requested')`,
          ),
        )
        .returning();
      if (!submitted)
        throw new HttpError(
          409,
          "This revision is not ready to submit or has changed.",
        );
      await tx.insert(audit).values({
        actorId: actor.id,
        restaurantId: id,
        action: "profile_revision_submitted",
      });
      return { ...submitted, isRevision: true };
    }
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
    await tx.insert(audit).values({
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
  try {
    const outcome = await db.transaction(async (tx) => {
      const [revision] = await tx
        .select()
        .from(restaurantRevision)
        .where(eq(restaurantRevision.restaurantId, id));
      if (revision) {
        if (input.decision === "suspended")
          throw new HttpError(
            400,
            "Resolve the submitted revision before suspending the public page.",
          );
        if (
          revision.status !== "pending_review" ||
          revision.version !== input.version
        )
          throw new HttpError(
            409,
            "The submitted revision changed. Refresh and try again.",
          );
        if (input.decision === "changes_requested") {
          const [updated] = await tx
            .update(restaurantRevision)
            .set({
              status: "changes_requested",
              reviewNote: input.note,
              version: input.version + 1,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(restaurantRevision.id, revision.id),
                eq(restaurantRevision.version, input.version),
                eq(restaurantRevision.status, "pending_review"),
              ),
            )
            .returning();
          if (!updated)
            throw new HttpError(409, "This revision was already reviewed.");
          await tx.insert(audit).values({
            actorId: actor.id,
            restaurantId: id,
            action: "profile_revision_changes_requested",
            detail: input.note,
          });
          return { result: { ...updated, isRevision: true }, staleKeys: [] };
        }

        const pictures = await tx
          .select({
            id: media.id,
            storageKey: media.storageKey,
            pendingStorageKey: media.pendingStorageKey,
          })
          .from(media)
          .where(eq(media.restaurantId, id));
        const [approved] = await tx
          .update(restaurant)
          .set({
            slug: revision.slug,
            name: revision.name,
            description: revision.description,
            city: revision.city,
            area: revision.area,
            address: revision.address,
            phone: revision.phone,
            cuisine: revision.cuisine,
            deliveryAvailable: revision.deliveryAvailable,
            pickupAvailable: revision.pickupAvailable,
            hours: revision.hours,
            status: "approved",
            reviewNote: "",
            version: sql`${restaurant.version}+1`,
            updatedAt: new Date(),
          })
          .where(and(eq(restaurant.id, id), eq(restaurant.status, "approved")))
          .returning();
        if (!approved)
          throw new HttpError(409, "The public restaurant is not available.");
        for (const picture of pictures) {
          if (!picture.pendingStorageKey) continue;
          await tx
            .update(media)
            .set({
              storageKey: picture.pendingStorageKey,
              pendingStorageKey: null,
            })
            .where(eq(media.id, picture.id));
        }
        await tx
          .delete(restaurantRevision)
          .where(eq(restaurantRevision.id, revision.id));
        await tx.insert(audit).values({
          actorId: actor.id,
          restaurantId: id,
          action: "profile_revision_approved",
          detail: input.note,
        });
        return {
          result: approved,
          staleKeys: pictures
            .filter(
              (picture) =>
                picture.pendingStorageKey &&
                picture.storageKey &&
                picture.pendingStorageKey !== picture.storageKey,
            )
            .map((picture) => picture.storageKey!),
        };
      }

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
      await tx.insert(audit).values({
        actorId: actor.id,
        restaurantId: id,
        action: `review_${input.decision}`,
        detail: input.note,
      });
      return { result: r, staleKeys: [] };
    });
    await Promise.all(
      outcome.staleKeys.map((key) =>
        deleteImage(key).catch(() => console.error("media_cleanup_failed")),
      ),
    );
    return outcome.result;
  } catch (error) {
    if (constraintCode(error) === "23505")
      throw new HttpError(409, "This page address is already taken.");
    throw error;
  }
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
  await db.insert(audit).values({
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
    await tx.insert(audit).values({
      actorId: actor.id,
      restaurantId: id,
      action: "staff_removed",
      detail: removed.userId,
    });
    return { removed: true };
  });
}
