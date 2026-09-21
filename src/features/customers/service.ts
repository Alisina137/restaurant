import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Database } from "@/db";
import {
  customerAddress,
  favoriteRestaurant,
  meal,
  media,
  restaurant,
  savedMeal,
} from "@/db/schema";
import type { Actor } from "@/lib/session";
import { HttpError } from "@/lib/http";
import { addressInput, toggleInput } from "./validation";
import { z } from "zod";

function verified(actor: Actor) {
  if (!actor.emailVerified)
    throw new HttpError(403, "Verify your email before saving items.");
}

export async function setFavorite(
  db: Database,
  actor: Actor,
  restaurantId: string,
  raw: unknown,
) {
  verified(actor);
  z.string().uuid().parse(restaurantId);
  const { active } = toggleInput.parse(raw);
  const [place] = await db
    .select({ id: restaurant.id })
    .from(restaurant)
    .where(
      and(eq(restaurant.id, restaurantId), eq(restaurant.status, "approved")),
    );
  if (!place) throw new HttpError(404, "Restaurant not found.");
  if (active)
    await db
      .insert(favoriteRestaurant)
      .values({ userId: actor.id, restaurantId })
      .onConflictDoNothing();
  else
    await db
      .delete(favoriteRestaurant)
      .where(
        and(
          eq(favoriteRestaurant.userId, actor.id),
          eq(favoriteRestaurant.restaurantId, restaurantId),
        ),
      );
  return { active };
}

export async function setSavedMeal(
  db: Database,
  actor: Actor,
  mealId: string,
  raw: unknown,
) {
  verified(actor);
  z.string().uuid().parse(mealId);
  const { active } = toggleInput.parse(raw);
  const [dish] = await db
    .select({ id: meal.id })
    .from(meal)
    .innerJoin(restaurant, eq(restaurant.id, meal.restaurantId))
    .where(
      and(
        eq(meal.id, mealId),
        eq(meal.available, true),
        eq(restaurant.status, "approved"),
      ),
    );
  if (!dish) throw new HttpError(404, "Meal not found.");
  if (active)
    await db
      .insert(savedMeal)
      .values({ userId: actor.id, mealId })
      .onConflictDoNothing();
  else
    await db
      .delete(savedMeal)
      .where(and(eq(savedMeal.userId, actor.id), eq(savedMeal.mealId, mealId)));
  return { active };
}

export async function savedCollection(db: Database, actor: Actor) {
  const [favoriteRows, mealRows] = await Promise.all([
    db
      .select({
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        city: restaurant.city,
        area: restaurant.area,
        cuisine: restaurant.cuisine,
      })
      .from(favoriteRestaurant)
      .innerJoin(restaurant, eq(restaurant.id, favoriteRestaurant.restaurantId))
      .where(
        and(
          eq(favoriteRestaurant.userId, actor.id),
          eq(restaurant.status, "approved"),
        ),
      )
      .orderBy(desc(favoriteRestaurant.createdAt)),
    db
      .select({
        id: meal.id,
        name: meal.name,
        description: meal.description,
        priceMinor: meal.priceMinor,
        imageKey: meal.imageKey,
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
      })
      .from(savedMeal)
      .innerJoin(meal, eq(meal.id, savedMeal.mealId))
      .innerJoin(restaurant, eq(restaurant.id, meal.restaurantId))
      .where(
        and(
          eq(savedMeal.userId, actor.id),
          eq(meal.available, true),
          eq(restaurant.status, "approved"),
        ),
      )
      .orderBy(desc(savedMeal.createdAt)),
  ]);
  const favoriteIds = favoriteRows.map((item) => item.id);
  const logos = favoriteIds.length
    ? await db
        .select({ id: media.id, restaurantId: media.restaurantId })
        .from(media)
        .where(
          and(
            inArray(media.restaurantId, favoriteIds),
            eq(media.kind, "logo"),
            isNotNull(media.storageKey),
          ),
        )
    : [];
  return {
    restaurants: favoriteRows.map((item) => ({
      ...item,
      logoId: logos.find((logo) => logo.restaurantId === item.id)?.id || null,
    })),
    meals: mealRows,
  };
}

export async function listAddresses(db: Database, actor: Actor) {
  return db
    .select()
    .from(customerAddress)
    .where(eq(customerAddress.userId, actor.id))
    .orderBy(desc(customerAddress.isDefault), desc(customerAddress.createdAt));
}

export async function saveAddress(
  db: Database,
  actor: Actor,
  raw: unknown,
  id?: string,
) {
  verified(actor);
  const input = addressInput.parse(raw);
  if (id) z.string().uuid().parse(id);
  return db.transaction(async (tx) => {
    if (input.isDefault)
      await tx
        .update(customerAddress)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(customerAddress.userId, actor.id));
    if (id) {
      if (!input.version)
        throw new HttpError(400, "Address version is required.");
      const [updated] = await tx
        .update(customerAddress)
        .set({
          ...input,
          version: input.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customerAddress.id, id),
            eq(customerAddress.userId, actor.id),
            eq(customerAddress.version, input.version),
          ),
        )
        .returning();
      if (!updated)
        throw new HttpError(
          409,
          "This address changed. Refresh and try again.",
        );
      return updated;
    }
    const [created] = await tx
      .insert(customerAddress)
      .values({ ...input, userId: actor.id })
      .returning();
    return created;
  });
}

export async function deleteAddress(db: Database, actor: Actor, id: string) {
  z.string().uuid().parse(id);
  const [removed] = await db
    .delete(customerAddress)
    .where(
      and(eq(customerAddress.id, id), eq(customerAddress.userId, actor.id)),
    )
    .returning();
  if (!removed) throw new HttpError(404, "Address not found.");
  return { removed: true };
}
