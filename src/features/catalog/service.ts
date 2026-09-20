import { and, asc, desc, eq, gt, inArray, lte } from "drizzle-orm";
import type { Database } from "@/db";
import {
  audit,
  deliveryZone,
  extraGroup,
  extraOption,
  freshOffer,
  meal,
  mealVariant,
  menuCategory,
  post,
  restaurant,
  savedMeal,
} from "@/db/schema";
import type { Actor } from "@/lib/session";
import { HttpError } from "@/lib/http";
import { member } from "@/features/restaurants/service";
import {
  categoryInput,
  mealInput,
  orderingInput,
  zoneInput,
} from "./validation";
import { z } from "zod";

function code(error: unknown) {
  const value = error as { code?: string; cause?: { code?: string } };
  return value.code || value.cause?.code;
}

function verified(actor: Actor) {
  if (!actor.emailVerified)
    throw new HttpError(403, "Verify your email before managing a menu.");
}

async function approvedRestaurant(db: Database, restaurantId: string) {
  const [record] = await db
    .select()
    .from(restaurant)
    .where(
      and(eq(restaurant.id, restaurantId), eq(restaurant.status, "approved")),
    );
  if (!record) throw new HttpError(404, "Restaurant not found.");
  return record;
}

async function menuRows(db: Database, restaurantId: string, owner = false) {
  const categories = await db
    .select()
    .from(menuCategory)
    .where(
      owner
        ? eq(menuCategory.restaurantId, restaurantId)
        : and(
            eq(menuCategory.restaurantId, restaurantId),
            eq(menuCategory.active, true),
          ),
    )
    .orderBy(asc(menuCategory.sortOrder), asc(menuCategory.createdAt));
  const meals = await db
    .select()
    .from(meal)
    .where(
      owner
        ? eq(meal.restaurantId, restaurantId)
        : and(eq(meal.restaurantId, restaurantId), eq(meal.available, true)),
    )
    .orderBy(asc(meal.sortOrder), asc(meal.createdAt));
  const mealIds = meals.map((item) => item.id);
  if (!mealIds.length)
    return categories.map((category) => ({ ...category, meals: [] }));
  const [variants, groups] = await Promise.all([
    db
      .select()
      .from(mealVariant)
      .where(inArray(mealVariant.mealId, mealIds))
      .orderBy(asc(mealVariant.sortOrder), asc(mealVariant.createdAt)),
    db
      .select()
      .from(extraGroup)
      .where(inArray(extraGroup.mealId, mealIds))
      .orderBy(asc(extraGroup.sortOrder), asc(extraGroup.createdAt)),
  ]);
  const groupIds = groups.map((group) => group.id);
  const options = groupIds.length
    ? await db
        .select()
        .from(extraOption)
        .where(inArray(extraOption.groupId, groupIds))
        .orderBy(asc(extraOption.sortOrder), asc(extraOption.createdAt))
    : [];
  return categories.map((category) => ({
    ...category,
    meals: meals
      .filter((item) => item.categoryId === category.id)
      .map((item) => ({
        ...item,
        variants: variants.filter(
          (variant) =>
            variant.mealId === item.id && (owner || variant.available),
        ),
        extraGroups: groups
          .filter((group) => group.mealId === item.id)
          .map((group) => ({
            ...group,
            options: options.filter(
              (option) =>
                option.groupId === group.id && (owner || option.available),
            ),
          })),
      })),
  }));
}

export async function publicMenu(
  db: Database,
  restaurantId: string,
  actorId?: string,
) {
  const record = await approvedRestaurant(db, restaurantId);
  const [categories, zones, offers] = await Promise.all([
    menuRows(db, restaurantId),
    db
      .select()
      .from(deliveryZone)
      .where(
        and(
          eq(deliveryZone.restaurantId, restaurantId),
          eq(deliveryZone.active, true),
        ),
      )
      .orderBy(asc(deliveryZone.name)),
    db
      .select({
        id: freshOffer.id,
        mealId: freshOffer.mealId,
        specialPriceMinor: freshOffer.specialPriceMinor,
        stockRemaining: freshOffer.stockRemaining,
        endsAt: freshOffer.endsAt,
      })
      .from(freshOffer)
      .innerJoin(post, eq(post.id, freshOffer.postId))
      .where(
        and(
          eq(freshOffer.restaurantId, restaurantId),
          eq(freshOffer.active, true),
          lte(freshOffer.startsAt, new Date()),
          gt(freshOffer.endsAt, new Date()),
          gt(freshOffer.stockRemaining, 0),
          eq(post.status, "published"),
        ),
      )
      .orderBy(desc(freshOffer.endsAt)),
  ]);
  const mealIds = categories.flatMap((category) =>
    category.meals.map((item) => item.id),
  );
  const saved =
    actorId && mealIds.length
      ? await db
          .select({ mealId: savedMeal.mealId })
          .from(savedMeal)
          .where(
            and(
              eq(savedMeal.userId, actorId),
              inArray(savedMeal.mealId, mealIds),
            ),
          )
      : [];
  const savedIds = new Set(saved.map((item) => item.mealId));
  const offerByMeal = new Map(
    offers.map((item) => [item.mealId, item] as const),
  );
  return {
    restaurant: {
      id: record.id,
      name: record.name,
      slug: record.slug,
      acceptingOrders: record.acceptingOrders,
      kitchenState: record.kitchenState,
      deliveryAvailable: record.deliveryAvailable,
      pickupAvailable: record.pickupAvailable,
      deliveryOrdersEnabled: record.deliveryOrdersEnabled,
      pickupOrdersEnabled: record.pickupOrdersEnabled,
      prepTimeMin: record.prepTimeMin,
      prepTimeMax: record.prepTimeMax,
      availabilityNote: record.availabilityNote,
      availabilityUpdatedAt: record.availabilityUpdatedAt,
    },
    categories: categories.map((category) => ({
      ...category,
      meals: category.meals.map((item) => ({
        ...item,
        saved: savedIds.has(item.id),
        freshOffer: offerByMeal.get(item.id) || null,
      })),
    })),
    zones,
  };
}

export async function ownerCatalog(
  db: Database,
  actor: Actor,
  restaurantId: string,
) {
  verified(actor);
  await member(db, actor, restaurantId);
  const [record] = await db
    .select()
    .from(restaurant)
    .where(eq(restaurant.id, restaurantId));
  if (!record) throw new HttpError(404, "Restaurant not found.");
  const [categories, zones] = await Promise.all([
    menuRows(db, restaurantId, true),
    db
      .select()
      .from(deliveryZone)
      .where(eq(deliveryZone.restaurantId, restaurantId))
      .orderBy(asc(deliveryZone.name)),
  ]);
  return { restaurant: record, categories, zones };
}

export async function saveCategory(
  db: Database,
  actor: Actor,
  restaurantId: string,
  raw: unknown,
  id?: string,
) {
  verified(actor);
  await member(db, actor, restaurantId, "menu");
  const input = categoryInput.parse(raw);
  if (id) z.string().uuid().parse(id);
  try {
    if (id) {
      const [updated] = await db
        .update(menuCategory)
        .set({ ...input, updatedAt: new Date() })
        .where(
          and(
            eq(menuCategory.id, id),
            eq(menuCategory.restaurantId, restaurantId),
          ),
        )
        .returning();
      if (!updated) throw new HttpError(404, "Menu category not found.");
      return updated;
    }
    const [created] = await db
      .insert(menuCategory)
      .values({ ...input, restaurantId })
      .returning();
    return created;
  } catch (error) {
    if (code(error) === "23505")
      throw new HttpError(409, "A category with this name already exists.");
    throw error;
  }
}

export async function saveMeal(
  db: Database,
  actor: Actor,
  restaurantId: string,
  raw: unknown,
  id?: string,
) {
  verified(actor);
  await member(db, actor, restaurantId, "menu");
  const input = mealInput.parse(raw);
  if (id) z.string().uuid().parse(id);
  try {
    return await db.transaction(async (tx) => {
      const [category] = await tx
        .select({ id: menuCategory.id })
        .from(menuCategory)
        .where(
          and(
            eq(menuCategory.id, input.categoryId),
            eq(menuCategory.restaurantId, restaurantId),
          ),
        );
      if (!category)
        throw new HttpError(400, "Choose a category from this restaurant.");
      const values = {
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        priceMinor: input.priceMinor,
        available: input.available,
        featured: input.featured,
        sortOrder: input.sortOrder,
        updatedAt: new Date(),
      };
      let saved;
      if (id) {
        [saved] = await tx
          .update(meal)
          .set(values)
          .where(and(eq(meal.id, id), eq(meal.restaurantId, restaurantId)))
          .returning();
        if (!saved) throw new HttpError(404, "Meal not found.");
        await tx.delete(mealVariant).where(eq(mealVariant.mealId, id));
        await tx.delete(extraGroup).where(eq(extraGroup.mealId, id));
      } else {
        [saved] = await tx
          .insert(meal)
          .values({ ...values, restaurantId })
          .returning();
      }
      if (input.variants.length)
        await tx.insert(mealVariant).values(
          input.variants.map((variant, sortOrder) => ({
            ...variant,
            mealId: saved.id,
            sortOrder,
          })),
        );
      for (const [sortOrder, group] of input.extraGroups.entries()) {
        const [createdGroup] = await tx
          .insert(extraGroup)
          .values({
            mealId: saved.id,
            name: group.name,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder,
          })
          .returning();
        await tx.insert(extraOption).values(
          group.options.map((option, optionSort) => ({
            ...option,
            groupId: createdGroup.id,
            sortOrder: optionSort,
          })),
        );
      }
      return saved;
    });
  } catch (error) {
    if (code(error) === "23505")
      throw new HttpError(409, "A meal with this name already exists.");
    throw error;
  }
}

export async function saveZone(
  db: Database,
  actor: Actor,
  restaurantId: string,
  raw: unknown,
  id?: string,
) {
  verified(actor);
  await member(db, actor, restaurantId, "delivery");
  const input = zoneInput.parse(raw);
  if (id) z.string().uuid().parse(id);
  try {
    if (id) {
      const [updated] = await db
        .update(deliveryZone)
        .set({ ...input, updatedAt: new Date() })
        .where(
          and(
            eq(deliveryZone.id, id),
            eq(deliveryZone.restaurantId, restaurantId),
          ),
        )
        .returning();
      if (!updated) throw new HttpError(404, "Delivery zone not found.");
      return updated;
    }
    const [created] = await db
      .insert(deliveryZone)
      .values({ ...input, restaurantId })
      .returning();
    return created;
  } catch (error) {
    if (code(error) === "23505")
      throw new HttpError(
        409,
        "A delivery zone with this name already exists.",
      );
    throw error;
  }
}

export async function setAcceptingOrders(
  db: Database,
  actor: Actor,
  restaurantId: string,
  raw: unknown,
) {
  verified(actor);
  await member(db, actor, restaurantId, "availability");
  const input = orderingInput.parse(raw);
  const [current] = await db
    .select()
    .from(restaurant)
    .where(eq(restaurant.id, restaurantId));
  if (!current || current.status !== "approved")
    throw new HttpError(409, "The restaurant must be approved first.");
  const prepTimeMin = input.prepTimeMin ?? current.prepTimeMin;
  const prepTimeMax = input.prepTimeMax ?? current.prepTimeMax;
  if (prepTimeMin > prepTimeMax)
    throw new HttpError(
      400,
      "The minimum prep time cannot exceed the maximum.",
    );
  const acceptingOrders = input.acceptingOrders ?? current.acceptingOrders;
  const kitchenState =
    input.kitchenState ??
    (input.acceptingOrders === true
      ? "open"
      : input.acceptingOrders === false
        ? "paused"
        : current.kitchenState);
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(restaurant)
      .set({
        acceptingOrders: kitchenState === "paused" ? false : acceptingOrders,
        kitchenState,
        deliveryOrdersEnabled:
          input.deliveryOrdersEnabled ?? current.deliveryOrdersEnabled,
        pickupOrdersEnabled:
          input.pickupOrdersEnabled ?? current.pickupOrdersEnabled,
        prepTimeMin,
        prepTimeMax,
        availabilityNote: input.availabilityNote ?? current.availabilityNote,
        availabilityUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(restaurant.id, restaurantId), eq(restaurant.status, "approved")),
      )
      .returning();
    if (rows[0])
      await tx.insert(audit).values({
        actorId: actor.id,
        restaurantId,
        action: "kitchen_availability_updated",
        detail: `${kitchenState}:${prepTimeMin}-${prepTimeMax}`,
      });
    return rows;
  });
  if (!updated)
    throw new HttpError(409, "The restaurant must be approved first.");
  return {
    acceptingOrders: updated.acceptingOrders,
    kitchenState: updated.kitchenState,
    deliveryOrdersEnabled: updated.deliveryOrdersEnabled,
    pickupOrdersEnabled: updated.pickupOrdersEnabled,
    prepTimeMin: updated.prepTimeMin,
    prepTimeMax: updated.prepTimeMax,
    availabilityNote: updated.availabilityNote,
    availabilityUpdatedAt: updated.availabilityUpdatedAt,
  };
}

export async function setMealAvailability(
  db: Database,
  actor: Actor,
  restaurantId: string,
  mealId: string,
  raw: unknown,
) {
  verified(actor);
  await member(db, actor, restaurantId, "availability");
  z.string().uuid().parse(mealId);
  const input = z.object({ available: z.boolean() }).parse(raw);
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(meal)
      .set({ available: input.available, updatedAt: new Date() })
      .where(and(eq(meal.id, mealId), eq(meal.restaurantId, restaurantId)))
      .returning();
    if (!updated) throw new HttpError(404, "Meal not found.");
    await tx.insert(audit).values({
      actorId: actor.id,
      restaurantId,
      action: input.available ? "meal_available" : "meal_sold_out",
      detail: mealId,
    });
    return updated;
  });
}

export async function updateMealContent(
  db: Database,
  actor: Actor,
  restaurantId: string,
  mealId: string,
  raw: unknown,
) {
  verified(actor);
  await member(db, actor, restaurantId, "menu_content");
  z.string().uuid().parse(mealId);
  const input = z
    .object({
      name: z.string().trim().min(2).max(100),
      description: z.string().trim().max(800),
    })
    .parse(raw);
  const [updated] = await db
    .update(meal)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(meal.id, mealId), eq(meal.restaurantId, restaurantId)))
    .returning();
  if (!updated) throw new HttpError(404, "Meal not found.");
  return updated;
}
