import { randomInt } from "node:crypto";
import { and, desc, eq, gt, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "@/db";
import {
  deliveryZone,
  extraGroup,
  extraOption,
  freshOffer,
  meal,
  mealVariant,
  order,
  orderEvent,
  quote,
  restaurant,
  type QuoteItemSnapshot,
} from "@/db/schema";
import type { Actor } from "@/lib/session";
import { HttpError } from "@/lib/http";
import { member } from "@/features/restaurants/service";
import { createOrderInput, quoteInput, transitionInput } from "./validation";
import { z } from "zod";

function requireVerified(actor: Actor) {
  if (!actor.emailVerified)
    throw new HttpError(403, "Verify your email before placing an order.");
}

export async function createQuote(db: Database, actor: Actor, raw: unknown) {
  requireVerified(actor);
  const input = quoteInput.parse(raw);
  const [place] = await db
    .select()
    .from(restaurant)
    .where(eq(restaurant.id, input.restaurantId));
  if (!place || place.status !== "approved" || !place.acceptingOrders)
    throw new HttpError(409, "This restaurant is not accepting orders now.");
  if (place.kitchenState === "paused")
    throw new HttpError(409, "This kitchen has temporarily paused ordering.");
  if (
    input.fulfillment === "delivery" &&
    (!place.deliveryAvailable || !place.deliveryOrdersEnabled)
  )
    throw new HttpError(400, "Delivery is not available from this restaurant.");
  if (
    input.fulfillment === "pickup" &&
    (!place.pickupAvailable || !place.pickupOrdersEnabled)
  )
    throw new HttpError(400, "Pickup is not available from this restaurant.");

  const requestedMealIds = [...new Set(input.items.map((item) => item.mealId))];
  const meals = await db
    .select()
    .from(meal)
    .where(
      and(
        inArray(meal.id, requestedMealIds),
        eq(meal.restaurantId, place.id),
        eq(meal.available, true),
      ),
    );
  if (meals.length !== requestedMealIds.length)
    throw new HttpError(409, "One or more meals are no longer available.");
  const requestedOfferIds = input.items
    .map((item) => item.offerId)
    .filter((id): id is string => Boolean(id));
  const [variants, groups, offers] = await Promise.all([
    db
      .select()
      .from(mealVariant)
      .where(inArray(mealVariant.mealId, requestedMealIds)),
    db
      .select()
      .from(extraGroup)
      .where(inArray(extraGroup.mealId, requestedMealIds)),
    requestedOfferIds.length
      ? db
          .select()
          .from(freshOffer)
          .where(
            and(
              inArray(freshOffer.id, requestedOfferIds),
              eq(freshOffer.restaurantId, place.id),
              eq(freshOffer.active, true),
              lte(freshOffer.startsAt, new Date()),
              gt(freshOffer.endsAt, new Date()),
              gt(freshOffer.stockRemaining, 0),
            ),
          )
      : Promise.resolve([]),
  ]);
  if (offers.length !== new Set(requestedOfferIds).size)
    throw new HttpError(409, "A Fresh Today offer is no longer available.");
  const groupIds = groups.map((group) => group.id);
  const options = groupIds.length
    ? await db
        .select()
        .from(extraOption)
        .where(inArray(extraOption.groupId, groupIds))
    : [];
  const snapshots: QuoteItemSnapshot[] = [];
  for (const requested of input.items) {
    const selectedMeal = meals.find((item) => item.id === requested.mealId)!;
    const availableVariants = variants.filter(
      (variant) => variant.mealId === selectedMeal.id && variant.available,
    );
    const selectedVariant = requested.variantId
      ? availableVariants.find((variant) => variant.id === requested.variantId)
      : undefined;
    if (availableVariants.length && !selectedVariant)
      throw new HttpError(
        400,
        `Choose an available size for ${selectedMeal.name}.`,
      );
    if (!availableVariants.length && requested.variantId)
      throw new HttpError(
        400,
        `That size is not available for ${selectedMeal.name}.`,
      );
    const selectedOptionIds = new Set(requested.extraOptionIds);
    if (selectedOptionIds.size !== requested.extraOptionIds.length)
      throw new HttpError(400, "The same extra cannot be selected twice.");
    const mealGroups = groups.filter(
      (group) => group.mealId === selectedMeal.id,
    );
    const chosenOptions = options.filter(
      (option) => selectedOptionIds.has(option.id) && option.available,
    );
    if (chosenOptions.length !== selectedOptionIds.size)
      throw new HttpError(
        400,
        "One or more extras are invalid or unavailable.",
      );
    for (const option of chosenOptions) {
      if (!mealGroups.some((group) => group.id === option.groupId))
        throw new HttpError(
          400,
          "An extra does not belong to the selected meal.",
        );
    }
    for (const group of mealGroups) {
      const count = chosenOptions.filter(
        (option) => option.groupId === group.id,
      ).length;
      if (count < group.minSelect || count > group.maxSelect)
        throw new HttpError(
          400,
          `Choose ${group.minSelect}–${group.maxSelect} options for ${group.name}.`,
        );
    }
    const selectedOffer = requested.offerId
      ? offers.find(
          (offer) =>
            offer.id === requested.offerId && offer.mealId === selectedMeal.id,
        )
      : undefined;
    if (requested.offerId && !selectedOffer)
      throw new HttpError(400, "That offer does not match the selected meal.");
    const extrasMinor = chosenOptions.reduce(
      (total, option) => total + option.priceMinor,
      0,
    );
    const regularUnitPriceMinor =
      (selectedVariant?.priceMinor ?? selectedMeal.priceMinor) + extrasMinor;
    const unitPriceMinor =
      (selectedOffer?.specialPriceMinor ??
        selectedVariant?.priceMinor ??
        selectedMeal.priceMinor) + extrasMinor;
    snapshots.push({
      mealId: selectedMeal.id,
      name: selectedMeal.name,
      variantId: selectedVariant?.id || null,
      variantName: selectedVariant?.name || null,
      unitPriceMinor,
      extras: chosenOptions.map((option) => ({
        id: option.id,
        name: option.name,
        priceMinor: option.priceMinor,
      })),
      quantity: requested.quantity,
      lineTotalMinor: unitPriceMinor * requested.quantity,
      offerId: selectedOffer?.id || null,
      regularUnitPriceMinor: selectedOffer ? regularUnitPriceMinor : null,
    });
  }
  for (const offer of offers) {
    const quantity = snapshots
      .filter((item) => item.offerId === offer.id)
      .reduce((total, item) => total + item.quantity, 0);
    if (quantity > offer.stockRemaining)
      throw new HttpError(
        409,
        `Only ${offer.stockRemaining} are left for this Fresh Today offer.`,
      );
  }
  const subtotalMinor = snapshots.reduce(
    (total, item) => total + item.lineTotalMinor,
    0,
  );
  let zone = null;
  if (input.fulfillment === "delivery") {
    [zone] = await db
      .select()
      .from(deliveryZone)
      .where(
        and(
          eq(deliveryZone.id, input.deliveryZoneId!),
          eq(deliveryZone.restaurantId, place.id),
          eq(deliveryZone.active, true),
        ),
      );
    if (!zone) throw new HttpError(400, "Choose an active delivery area.");
    if (subtotalMinor < zone.minimumMinor)
      throw new HttpError(
        400,
        `This area requires a minimum food subtotal of ${zone.minimumMinor / 100} AFN.`,
      );
  }
  const deliveryFeeMinor = zone?.feeMinor || 0;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const [created] = await db
    .insert(quote)
    .values({
      customerId: actor.id,
      restaurantId: place.id,
      fulfillment: input.fulfillment,
      deliveryZoneId: zone?.id,
      items: snapshots,
      address: input.fulfillment === "delivery" ? input.address : null,
      subtotalMinor,
      deliveryFeeMinor,
      totalMinor: subtotalMinor + deliveryFeeMinor,
      note: input.note,
      expiresAt,
    })
    .returning();
  return { ...created, restaurantName: place.name, zone };
}

function orderCode() {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  return `RS-${date}-${randomInt(1000, 10000)}`;
}

export async function placeOrder(db: Database, actor: Actor, raw: unknown) {
  requireVerified(actor);
  const input = createOrderInput.parse(raw);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(order)
      .where(
        and(
          eq(order.customerId, actor.id),
          eq(order.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (existing) return existing;
    const [quoted] = await tx
      .select()
      .from(quote)
      .where(
        and(
          eq(quote.id, input.quoteId),
          eq(quote.customerId, actor.id),
          isNull(quote.consumedAt),
          gt(quote.expiresAt, new Date()),
        ),
      );
    if (!quoted)
      throw new HttpError(
        409,
        "This price quote expired. Review your cart again.",
      );
    const [place] = await tx
      .select({
        acceptingOrders: restaurant.acceptingOrders,
        kitchenState: restaurant.kitchenState,
        deliveryAvailable: restaurant.deliveryAvailable,
        pickupAvailable: restaurant.pickupAvailable,
        deliveryOrdersEnabled: restaurant.deliveryOrdersEnabled,
        pickupOrdersEnabled: restaurant.pickupOrdersEnabled,
        status: restaurant.status,
      })
      .from(restaurant)
      .where(eq(restaurant.id, quoted.restaurantId));
    if (
      !place?.acceptingOrders ||
      place.kitchenState === "paused" ||
      place.status !== "approved"
    )
      throw new HttpError(409, "This restaurant stopped accepting orders.");
    if (
      quoted.fulfillment === "delivery" &&
      (!place.deliveryAvailable || !place.deliveryOrdersEnabled)
    )
      throw new HttpError(409, "Restaurant delivery is temporarily paused.");
    if (
      quoted.fulfillment === "pickup" &&
      (!place.pickupAvailable || !place.pickupOrdersEnabled)
    )
      throw new HttpError(409, "Restaurant pickup is temporarily paused.");
    const offerQuantities = new Map<string, number>();
    for (const item of quoted.items) {
      if (!item.offerId) continue;
      offerQuantities.set(
        item.offerId,
        (offerQuantities.get(item.offerId) || 0) + item.quantity,
      );
    }
    for (const [offerId, quantity] of offerQuantities) {
      const [reserved] = await tx
        .update(freshOffer)
        .set({
          stockRemaining: sql`${freshOffer.stockRemaining}-${quantity}`,
          version: sql`${freshOffer.version}+1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(freshOffer.id, offerId),
            eq(freshOffer.active, true),
            lte(freshOffer.startsAt, new Date()),
            gt(freshOffer.endsAt, new Date()),
            gte(freshOffer.stockRemaining, quantity),
          ),
        )
        .returning({ id: freshOffer.id });
      if (!reserved)
        throw new HttpError(
          409,
          "A Fresh Today item just sold out. Review your cart again.",
        );
    }
    const [consumed] = await tx
      .update(quote)
      .set({ consumedAt: new Date() })
      .where(and(eq(quote.id, quoted.id), isNull(quote.consumedAt)))
      .returning();
    if (!consumed) throw new HttpError(409, "This quote was already used.");
    const [created] = await tx
      .insert(order)
      .values({
        code: orderCode(),
        customerId: actor.id,
        restaurantId: quoted.restaurantId,
        quoteId: quoted.id,
        idempotencyKey: input.idempotencyKey,
        fulfillment: quoted.fulfillment,
        deliveryZoneId: quoted.deliveryZoneId,
        items: quoted.items,
        address: quoted.address,
        subtotalMinor: quoted.subtotalMinor,
        deliveryFeeMinor: quoted.deliveryFeeMinor,
        totalMinor: quoted.totalMinor,
        currency: quoted.currency,
        customerNote: quoted.note,
      })
      .returning();
    await tx.insert(orderEvent).values({
      orderId: created.id,
      actorId: actor.id,
      previousStatus: null,
      nextStatus: "awaiting_acceptance",
      note: "Order placed",
    });
    return created;
  });
}

export async function customerOrders(db: Database, actor: Actor) {
  const rows = await db
    .select({
      order,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
    })
    .from(order)
    .innerJoin(restaurant, eq(restaurant.id, order.restaurantId))
    .where(eq(order.customerId, actor.id))
    .orderBy(desc(order.createdAt));
  return rows;
}

export async function restaurantOrders(
  db: Database,
  actor: Actor,
  restaurantId: string,
) {
  requireVerified(actor);
  const access = await member(db, actor, restaurantId, "orders");
  const rows = await db
    .select()
    .from(order)
    .where(eq(order.restaurantId, restaurantId))
    .orderBy(desc(order.createdAt));
  const canSeeAddresses =
    access.role === "owner" || access.canViewDeliveryAddresses;
  return rows.map((item) => ({
    ...item,
    address: canSeeAddresses ? item.address : null,
  }));
}

async function restoreFreshInventory(
  tx: Database,
  current: typeof order.$inferSelect,
) {
  if (current.inventoryRestoredAt) return;
  const quantities = new Map<string, number>();
  for (const item of current.items) {
    if (!item.offerId) continue;
    quantities.set(
      item.offerId,
      (quantities.get(item.offerId) || 0) + item.quantity,
    );
  }
  for (const [offerId, quantity] of quantities)
    await tx
      .update(freshOffer)
      .set({
        stockRemaining: sql`least(${freshOffer.stockTotal}, ${freshOffer.stockRemaining}+${quantity})`,
        version: sql`${freshOffer.version}+1`,
        updatedAt: new Date(),
      })
      .where(eq(freshOffer.id, offerId));
}

const transitions: Record<string, string[]> = {
  awaiting_acceptance: ["accepted", "rejected"],
  accepted: ["preparing"],
  preparing: ["out_for_delivery", "ready_for_pickup"],
  out_for_delivery: ["delivered"],
  ready_for_pickup: ["collected"],
};

export async function transitionOrder(
  db: Database,
  actor: Actor,
  restaurantId: string,
  orderId: string,
  raw: unknown,
) {
  requireVerified(actor);
  await member(db, actor, restaurantId, "orders");
  z.string().uuid().parse(orderId);
  const input = transitionInput.parse(raw);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(order)
      .where(and(eq(order.id, orderId), eq(order.restaurantId, restaurantId)));
    if (!current) throw new HttpError(404, "Order not found.");
    if (!transitions[current.status]?.includes(input.status))
      throw new HttpError(409, "That order status change is not allowed.");
    if (
      current.status === "preparing" &&
      ((current.fulfillment === "delivery" &&
        input.status !== "out_for_delivery") ||
        (current.fulfillment === "pickup" &&
          input.status !== "ready_for_pickup"))
    )
      throw new HttpError(
        409,
        "That status does not match the fulfillment method.",
      );
    const [updated] = await tx
      .update(order)
      .set({
        status: input.status,
        restaurantNote: input.note,
        version: input.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(order.id, orderId),
          eq(order.restaurantId, restaurantId),
          eq(order.version, input.version),
          eq(order.status, current.status),
        ),
      )
      .returning();
    if (!updated)
      throw new HttpError(409, "This order changed. Refresh and try again.");
    if (input.status === "rejected") {
      await restoreFreshInventory(tx as unknown as Database, current);
      await tx
        .update(order)
        .set({ inventoryRestoredAt: new Date() })
        .where(eq(order.id, orderId));
    }
    await tx.insert(orderEvent).values({
      orderId,
      actorId: actor.id,
      previousStatus: current.status,
      nextStatus: input.status,
      note: input.note,
    });
    return updated;
  });
}

export async function cancelOrder(db: Database, actor: Actor, orderId: string) {
  z.string().uuid().parse(orderId);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(order)
      .where(
        and(
          eq(order.id, orderId),
          eq(order.customerId, actor.id),
          eq(order.status, "awaiting_acceptance"),
        ),
      );
    if (!current)
      throw new HttpError(409, "This order can no longer be cancelled online.");
    const [cancelled] = await tx
      .update(order)
      .set({
        status: "cancelled",
        version: sql`${order.version}+1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(order.id, orderId),
          eq(order.customerId, actor.id),
          eq(order.status, "awaiting_acceptance"),
        ),
      )
      .returning();
    if (!cancelled)
      throw new HttpError(409, "This order can no longer be cancelled online.");
    await restoreFreshInventory(tx as unknown as Database, current);
    await tx
      .update(order)
      .set({ inventoryRestoredAt: new Date() })
      .where(eq(order.id, orderId));
    await tx.insert(orderEvent).values({
      orderId,
      actorId: actor.id,
      previousStatus: "awaiting_acceptance",
      nextStatus: "cancelled",
      note: "Cancelled by customer",
    });
    return cancelled;
  });
}

export async function previewReorder(
  db: Database,
  actor: Actor,
  orderId: string,
) {
  requireVerified(actor);
  z.string().uuid().parse(orderId);
  const [previous] = await db
    .select()
    .from(order)
    .where(and(eq(order.id, orderId), eq(order.customerId, actor.id)));
  if (!previous) throw new HttpError(404, "Order not found.");
  const issues: string[] = [];
  if (previous.items.some((item) => item.offerId))
    issues.push(
      "The previous Fresh Today price is not reused; current menu prices apply.",
    );
  try {
    const current = await createQuote(db, actor, {
      restaurantId: previous.restaurantId,
      fulfillment: previous.fulfillment,
      deliveryZoneId: previous.deliveryZoneId || undefined,
      items: previous.items.map((item) => ({
        mealId: item.mealId,
        variantId: item.variantId || undefined,
        extraOptionIds: item.extras.map((extra) => extra.id),
        quantity: item.quantity,
      })),
      address: previous.address || undefined,
      note: previous.customerNote,
    });
    if (current.totalMinor !== previous.totalMinor)
      issues.push(
        `The total changed from ${previous.totalMinor / 100} AFN to ${current.totalMinor / 100} AFN.`,
      );
    for (const item of current.items) {
      const old = previous.items.find(
        (value) =>
          value.mealId === item.mealId && value.variantId === item.variantId,
      );
      if (old && old.unitPriceMinor !== item.unitPriceMinor)
        issues.push(`${item.name} now has a different price.`);
    }
    return { available: true as const, quote: current, issues };
  } catch (error) {
    if (error instanceof HttpError)
      return {
        available: false as const,
        quote: null,
        issues: [...issues, error.message],
      };
    throw error;
  }
}
