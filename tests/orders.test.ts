import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabase } from "./database";
import { user } from "../src/db/schema";
import type { Actor } from "../src/lib/session";
import {
  createRestaurant,
  reviewRestaurant,
  submitRestaurant,
} from "../src/features/restaurants/service";
import {
  ownerCatalog,
  saveCategory,
  saveMeal,
  saveZone,
  setAcceptingOrders,
} from "../src/features/catalog/service";
import {
  createQuote,
  placeOrder,
  transitionOrder,
} from "../src/features/orders/service";

let state: Awaited<ReturnType<typeof testDatabase>>;
const owner: Actor = {
  id: "order-owner",
  name: "Owner",
  email: "order-owner@example.test",
  emailVerified: true,
};
const customer: Actor = {
  id: "customer",
  name: "Customer",
  email: "customer@example.test",
  emailVerified: true,
};
const outsider: Actor = {
  id: "outsider-owner",
  name: "Outsider",
  email: "outsider@example.test",
  emailVerified: true,
};
const admin: Actor = {
  id: "order-admin",
  name: "Admin",
  email: "order-admin@example.test",
  emailVerified: true,
  isAdmin: true,
};
const profile = {
  name: "Order Kitchen",
  slug: "order-kitchen",
  description: "A local restaurant with delivery and pickup ordering.",
  city: "Kabul",
  area: "Karte Seh",
  address: "Main road, near the park",
  phone: "+93700123456",
  cuisine: "Afghan",
  deliveryAvailable: true,
  pickupAvailable: true,
  hours: Array.from({ length: 7 }, (_, day) => ({
    day,
    closed: false,
    opens: "09:00",
    closes: "22:00",
  })),
};

beforeAll(async () => {
  state = await testDatabase();
  await state.db.insert(user).values([owner, customer, outsider, admin]);
});
afterAll(async () => state.client.close());

describe("Phase 4 ordering", () => {
  it("uses server prices, prevents duplicate orders and enforces status transitions", async () => {
    const created = await createRestaurant(state.db, owner, profile);
    const pending = await submitRestaurant(
      state.db,
      owner,
      created.id,
      created.version,
    );
    await reviewRestaurant(state.db, admin, created.id, {
      decision: "approved",
      note: "",
      version: pending.version,
    });
    const category = await saveCategory(state.db, owner, created.id, {
      name: "Mains",
      description: "",
      sortOrder: 0,
      active: true,
    });
    await saveMeal(state.db, owner, created.id, {
      categoryId: category.id,
      name: "Kabuli Pulao",
      description: "Rice, raisins, carrots and tender meat.",
      priceMinor: 45_000,
      available: true,
      featured: true,
      sortOrder: 0,
      variants: [
        { name: "Regular", priceMinor: 45_000, available: true },
        { name: "Family", priceMinor: 85_000, available: true },
      ],
      extraGroups: [
        {
          name: "Sides",
          minSelect: 0,
          maxSelect: 1,
          options: [{ name: "Salad", priceMinor: 5_000, available: true }],
        },
      ],
    });
    const zone = await saveZone(state.db, owner, created.id, {
      name: "Karte Seh",
      feeMinor: 10_000,
      minimumMinor: 40_000,
      etaMin: 30,
      etaMax: 50,
      active: true,
    });
    await setAcceptingOrders(state.db, owner, created.id, {
      acceptingOrders: true,
    });
    const catalog = await ownerCatalog(state.db, owner, created.id);
    const dish = catalog.categories[0].meals[0];
    const quote = await createQuote(state.db, customer, {
      restaurantId: created.id,
      fulfillment: "delivery",
      deliveryZoneId: zone.id,
      items: [
        {
          mealId: dish.id,
          variantId: dish.variants[0].id,
          extraOptionIds: [dish.extraGroups[0].options[0].id],
          quantity: 2,
          clientPrice: 1,
        },
      ],
      address: {
        recipient: "Customer",
        phone: "+93700123457",
        city: "Kabul",
        area: "Karte Seh",
        address: "House 2, Main road",
        instructions: "Call at the gate",
      },
      note: "Less oil",
    });
    expect(quote.subtotalMinor).toBe(100_000);
    expect(quote.totalMinor).toBe(110_000);
    const key = "f6acae00-6f21-4c36-a0b2-80adc5894a3c";
    const first = await placeOrder(state.db, customer, {
      quoteId: quote.id,
      idempotencyKey: key,
    });
    const duplicate = await placeOrder(state.db, customer, {
      quoteId: quote.id,
      idempotencyKey: key,
    });
    expect(duplicate.id).toBe(first.id);
    await expect(
      transitionOrder(state.db, outsider, created.id, first.id, {
        status: "accepted",
        version: first.version,
        note: "",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      transitionOrder(state.db, owner, created.id, first.id, {
        status: "delivered",
        version: first.version,
        note: "",
      }),
    ).rejects.toMatchObject({ status: 409 });
    const accepted = await transitionOrder(
      state.db,
      owner,
      created.id,
      first.id,
      { status: "accepted", version: first.version, note: "" },
    );
    const preparing = await transitionOrder(
      state.db,
      owner,
      created.id,
      first.id,
      { status: "preparing", version: accepted.version, note: "" },
    );
    await expect(
      transitionOrder(state.db, owner, created.id, first.id, {
        status: "ready_for_pickup",
        version: preparing.version,
        note: "",
      }),
    ).rejects.toMatchObject({ status: 409 });
    const travelling = await transitionOrder(
      state.db,
      owner,
      created.id,
      first.id,
      { status: "out_for_delivery", version: preparing.version, note: "" },
    );
    const delivered = await transitionOrder(
      state.db,
      owner,
      created.id,
      first.id,
      { status: "delivered", version: travelling.version, note: "" },
    );
    expect(delivered.status).toBe("delivered");
    expect(delivered.paymentStatus).toBe("unpaid");
  });
});
