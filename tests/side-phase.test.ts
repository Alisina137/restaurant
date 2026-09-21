import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { testDatabase } from "./database";
import { freshOffer, meal, user } from "../src/db/schema";
import type { Actor } from "../src/lib/session";
import {
  addStaff,
  createRestaurant,
  reviewRestaurant,
  submitRestaurant,
  updateContributor,
} from "../src/features/restaurants/service";
import {
  ownerCatalog,
  publicMenu,
  saveCategory,
  saveMeal,
  setAcceptingOrders,
  updateMealContent,
} from "../src/features/catalog/service";
import { changePostStatus, createPost } from "../src/features/posts/service";
import {
  createQuote,
  placeOrder,
  previewReorder,
  restaurantOrders,
  transitionOrder,
} from "../src/features/orders/service";
import {
  listAddresses,
  saveAddress,
  savedCollection,
  setFavorite,
  setSavedMeal,
} from "../src/features/customers/service";

let state: Awaited<ReturnType<typeof testDatabase>>;
const owner: Actor = {
  id: "side-owner",
  name: "Side Owner",
  email: "side-owner@example.test",
  emailVerified: true,
};
const manager: Actor = {
  id: "side-manager",
  name: "Manager",
  email: "manager@example.test",
  emailVerified: true,
};
const kitchen: Actor = {
  id: "side-kitchen",
  name: "Kitchen",
  email: "kitchen@example.test",
  emailVerified: true,
};
const editor: Actor = {
  id: "side-editor",
  name: "Editor",
  email: "editor@example.test",
  emailVerified: true,
};
const customer: Actor = {
  id: "side-customer",
  name: "Customer",
  email: "side-customer@example.test",
  emailVerified: true,
};
const otherCustomer: Actor = {
  id: "side-other-customer",
  name: "Other Customer",
  email: "other-customer@example.test",
  emailVerified: true,
};
const administrator: Actor = {
  id: "side-admin",
  name: "Administrator",
  email: "side-admin@example.test",
  emailVerified: true,
  isAdmin: true,
};

function profile(slug: string) {
  return {
    name: `Kitchen ${slug}`,
    slug,
    description: "A local restaurant testing adaptive marketplace tools.",
    city: "Kabul",
    area: "Shahr-e-Naw",
    address: "Main road, building 10",
    phone: "+93700123456",
    cuisine: "Afghan",
    deliveryAvailable: true,
    pickupAvailable: true,
    hours: Array.from({ length: 7 }, (_, day) => ({
      day,
      closed: false,
      opens: "08:00",
      closes: "22:00",
    })),
  };
}

async function approvedRestaurant(slug: string) {
  const created = await createRestaurant(state.db, owner, profile(slug));
  const submitted = await submitRestaurant(
    state.db,
    owner,
    created.id,
    created.version,
  );
  await reviewRestaurant(state.db, administrator, created.id, {
    decision: "approved",
    note: "",
    version: submitted.version,
  });
  return created;
}

beforeAll(async () => {
  state = await testDatabase();
  await state.db
    .insert(user)
    .values([
      owner,
      manager,
      kitchen,
      editor,
      customer,
      otherCustomer,
      administrator,
    ]);
});
afterAll(async () => state.client.close());

describe("Side Phase contributor security", () => {
  it("enforces manager, kitchen, content and custom permissions on the server", async () => {
    const place = await approvedRestaurant("role-kitchen");
    const managerMembership = await addStaff(state.db, owner, place.id, {
      email: manager.email,
      preset: "manager",
    });
    await addStaff(state.db, owner, place.id, {
      email: kitchen.email,
      preset: "kitchen",
    });
    await addStaff(state.db, owner, place.id, {
      email: editor.email,
      preset: "content_editor",
    });

    const category = await saveCategory(state.db, manager, place.id, {
      name: "Mains",
      description: "",
      sortOrder: 0,
      active: true,
    });
    const dish = await saveMeal(state.db, manager, place.id, {
      categoryId: category.id,
      name: "Mantu",
      description: "Afghan dumplings",
      priceMinor: 35_000,
      available: true,
      featured: true,
      sortOrder: 0,
      variants: [],
      extraGroups: [],
    });
    await expect(
      saveCategory(state.db, kitchen, place.id, {
        name: "Forbidden",
        description: "",
        sortOrder: 1,
        active: true,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      createPost(state.db, kitchen, place.id, {
        caption: "Kitchen should not publish content.",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await updateMealContent(state.db, editor, place.id, dish.id, {
      name: "Classic Mantu",
      description: "Hand-folded Afghan dumplings.",
    });
    await expect(
      saveMeal(state.db, editor, place.id, {
        categoryId: category.id,
        name: "Changed price",
        description: "",
        priceMinor: 1,
        available: true,
        featured: false,
        sortOrder: 0,
        variants: [],
        extraGroups: [],
      }),
    ).rejects.toMatchObject({ status: 403 });

    await updateContributor(state.db, owner, place.id, {
      membershipId: managerMembership.id,
      preset: "custom",
      permissions: {
        orders: false,
        menu: true,
        menuContent: true,
        posts: false,
        delivery: false,
        availability: false,
        deliveryAddresses: false,
      },
    });
    await expect(
      restaurantOrders(state.db, manager, place.id),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      ownerCatalog(state.db, administrator, place.id),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("Side Phase Fresh Today and repeat ordering", () => {
  it("uses live offer prices, prevents overselling, restores rejected stock and re-quotes", async () => {
    const place = await approvedRestaurant("fresh-kitchen");
    const category = await saveCategory(state.db, owner, place.id, {
      name: "Today",
      description: "",
      sortOrder: 0,
      active: true,
    });
    const dish = await saveMeal(state.db, owner, place.id, {
      categoryId: category.id,
      name: "Kabuli Pulao",
      description: "Fresh from the kitchen",
      priceMinor: 50_000,
      available: true,
      featured: true,
      sortOrder: 0,
      variants: [],
      extraGroups: [],
    });
    await setAcceptingOrders(state.db, owner, place.id, {
      acceptingOrders: true,
      kitchenState: "open",
      pickupOrdersEnabled: true,
      prepTimeMin: 20,
      prepTimeMax: 35,
    });
    const createdPost = await createPost(state.db, owner, place.id, {
      caption: "Only two portions are available today.",
      linkedMealId: dish.id,
      freshOffer: {
        availableQuantity: 2,
        specialPriceMinor: 40_000,
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
    await changePostStatus(state.db, owner, place.id, createdPost.id, {
      action: "publish",
      version: createdPost.version,
    });
    const menu = await publicMenu(state.db, place.id, customer.id);
    const offer = menu.categories[0].meals[0].freshOffer!;
    const quoteBody = {
      restaurantId: place.id,
      fulfillment: "pickup" as const,
      items: [
        {
          mealId: dish.id,
          offerId: offer.id,
          extraOptionIds: [],
          quantity: 2,
        },
      ],
      note: "",
    };
    const firstQuote = await createQuote(state.db, customer, quoteBody);
    const competingQuote = await createQuote(
      state.db,
      otherCustomer,
      quoteBody,
    );
    expect(firstQuote.totalMinor).toBe(80_000);
    const placed = await placeOrder(state.db, customer, {
      quoteId: firstQuote.id,
      idempotencyKey: "32450b00-6c0f-4406-bcd0-5216808bb4bc",
    });
    await expect(
      placeOrder(state.db, otherCustomer, {
        quoteId: competingQuote.id,
        idempotencyKey: "4ea2797a-3743-4a8b-ab1f-b06e35ab7d44",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await state.db
        .select()
        .from(freshOffer)
        .where(eq(freshOffer.id, offer.id))
        .then((rows) => rows[0].stockRemaining),
    ).toBe(0);
    const rejected = await transitionOrder(
      state.db,
      owner,
      place.id,
      placed.id,
      { status: "rejected", version: placed.version, note: "Sold by phone" },
    );
    expect(rejected.status).toBe("rejected");
    expect(
      await state.db
        .select()
        .from(freshOffer)
        .where(eq(freshOffer.id, offer.id))
        .then((rows) => rows[0].stockRemaining),
    ).toBe(2);

    await state.db
      .update(meal)
      .set({ priceMinor: 55_000 })
      .where(eq(meal.id, dish.id));
    const reorder = await previewReorder(state.db, customer, placed.id);
    expect(reorder.available).toBe(true);
    expect(reorder.quote?.totalMinor).toBe(110_000);
    expect(reorder.issues.join(" ")).toContain("Fresh Today");
    expect(reorder.issues.join(" ")).toContain("total changed");
  });
});

describe("Side Phase private customer conveniences", () => {
  it("keeps saved addresses tenant-safe and builds real saved collections", async () => {
    const place = await approvedRestaurant("saved-kitchen");
    const category = await saveCategory(state.db, owner, place.id, {
      name: "Meals",
      description: "",
      sortOrder: 0,
      active: true,
    });
    const dish = await saveMeal(state.db, owner, place.id, {
      categoryId: category.id,
      name: "Bolani",
      description: "Stuffed flatbread",
      priceMinor: 15_000,
      available: true,
      featured: false,
      sortOrder: 0,
      variants: [],
      extraGroups: [],
    });
    const first = await saveAddress(state.db, customer, {
      label: "Home",
      recipient: "Customer",
      phone: "+93700123457",
      city: "Kabul",
      area: "Shahr-e-Naw",
      address: "House 8, Main road",
      instructions: "Call at the gate",
      isDefault: true,
    });
    await saveAddress(state.db, customer, {
      label: "Office",
      recipient: "Customer",
      phone: "+93700123457",
      city: "Kabul",
      area: "Wazir Akbar Khan",
      address: "Office 3, Street 5",
      instructions: "Reception",
      isDefault: true,
    });
    expect(
      (await listAddresses(state.db, customer)).filter(
        (item) => item.isDefault,
      ),
    ).toHaveLength(1);
    await expect(
      saveAddress(
        state.db,
        otherCustomer,
        {
          label: "Stolen",
          recipient: "Other",
          phone: "+93700123458",
          city: "Kabul",
          area: "Karte Seh",
          address: "Another address",
          instructions: "",
          isDefault: false,
          version: first.version,
        },
        first.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await setFavorite(state.db, customer, place.id, { active: true });
    await setSavedMeal(state.db, customer, dish.id, { active: true });
    const collection = await savedCollection(state.db, customer);
    expect(collection.restaurants.map((item) => item.id)).toContain(place.id);
    expect(collection.meals.map((item) => item.id)).toContain(dish.id);
  });
});
