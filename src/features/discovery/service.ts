import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Database } from "@/db";
import { follow, meal, media, menuCategory, restaurant } from "@/db/schema";
import { isOpen } from "@/features/restaurants/hours";

export type DiscoveryFilters = {
  q?: string;
  city?: string;
  area?: string;
  cuisine?: string;
  open?: boolean;
  delivery?: boolean;
  pickup?: boolean;
  actorId?: string;
};

export async function searchRestaurants(
  db: Database,
  filters: DiscoveryFilters = {},
) {
  const conditions: SQL[] = [eq(restaurant.status, "approved")];
  const q = filters.q?.trim().slice(0, 100);
  const city = filters.city?.trim().slice(0, 80);
  const area = filters.area?.trim().slice(0, 100);
  const cuisine = filters.cuisine?.trim().slice(0, 80);
  if (q)
    conditions.push(
      or(
        ilike(restaurant.name, `%${q}%`),
        ilike(restaurant.description, `%${q}%`),
        ilike(restaurant.area, `%${q}%`),
        ilike(restaurant.cuisine, `%${q}%`),
      )!,
    );
  if (city) conditions.push(eq(restaurant.city, city));
  if (area) conditions.push(ilike(restaurant.area, `%${area}%`));
  if (cuisine) conditions.push(eq(restaurant.cuisine, cuisine));
  if (filters.delivery) conditions.push(eq(restaurant.deliveryAvailable, true));
  if (filters.pickup) conditions.push(eq(restaurant.pickupAvailable, true));

  const rows = await db
    .select({
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      description: restaurant.description,
      city: restaurant.city,
      area: restaurant.area,
      cuisine: restaurant.cuisine,
      hours: restaurant.hours,
      deliveryAvailable: restaurant.deliveryAvailable,
      pickupAvailable: restaurant.pickupAvailable,
      createdAt: restaurant.createdAt,
    })
    .from(restaurant)
    .where(and(...conditions))
    .orderBy(desc(restaurant.createdAt), desc(restaurant.id))
    .limit(80);
  const filtered = filters.open
    ? rows.filter((item) => isOpen(item.hours))
    : rows;
  if (!filtered.length) return [];
  const ids = filtered.map((item) => item.id);
  const [images, followerCounts, viewerFollows] = await Promise.all([
    db
      .select({
        id: media.id,
        restaurantId: media.restaurantId,
        kind: media.kind,
      })
      .from(media)
      .where(
        and(inArray(media.restaurantId, ids), isNotNull(media.storageKey)),
      ),
    db
      .select({ restaurantId: follow.restaurantId, value: count() })
      .from(follow)
      .where(inArray(follow.restaurantId, ids))
      .groupBy(follow.restaurantId),
    filters.actorId
      ? db
          .select({ restaurantId: follow.restaurantId })
          .from(follow)
          .where(
            and(
              eq(follow.userId, filters.actorId),
              inArray(follow.restaurantId, ids),
            ),
          )
      : Promise.resolve([]),
  ]);
  const counts = new Map(
    followerCounts.map((item) => [item.restaurantId, Number(item.value)]),
  );
  const followed = new Set(viewerFollows.map((item) => item.restaurantId));
  return filtered.map((item) => ({
    ...item,
    isOpen: isOpen(item.hours),
    images: images.filter((image) => image.restaurantId === item.id),
    followerCount: counts.get(item.id) || 0,
    following: followed.has(item.id),
  }));
}

export async function restaurantSocial(
  db: Database,
  restaurantId: string,
  actorId?: string,
) {
  const [total, viewer] = await Promise.all([
    db
      .select({ value: count() })
      .from(follow)
      .where(eq(follow.restaurantId, restaurantId)),
    actorId
      ? db
          .select({ id: follow.id })
          .from(follow)
          .where(
            and(
              eq(follow.restaurantId, restaurantId),
              eq(follow.userId, actorId),
            ),
          )
      : Promise.resolve([]),
  ]);
  return {
    followerCount: Number(total[0].value),
    following: viewer.length > 0,
  };
}

export async function searchMeals(db: Database, query?: string) {
  const q = query?.trim().slice(0, 100);
  if (!q) return [];
  return db
    .select({
      id: meal.id,
      name: meal.name,
      description: meal.description,
      priceMinor: meal.priceMinor,
      imageKey: meal.imageKey,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      cuisine: restaurant.cuisine,
    })
    .from(meal)
    .innerJoin(restaurant, eq(restaurant.id, meal.restaurantId))
    .innerJoin(menuCategory, eq(menuCategory.id, meal.categoryId))
    .where(
      and(
        eq(restaurant.status, "approved"),
        eq(meal.available, true),
        eq(menuCategory.active, true),
        or(
          ilike(meal.name, `%${q}%`),
          ilike(meal.description, `%${q}%`),
          ilike(restaurant.name, `%${q}%`),
        ),
      ),
    )
    .orderBy(desc(meal.featured), desc(meal.createdAt))
    .limit(24);
}
