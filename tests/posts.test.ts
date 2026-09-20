import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { testDatabase } from "./database";
import { post, user } from "../src/db/schema";
import {
  createRestaurant,
  reviewRestaurant,
  submitRestaurant,
} from "../src/features/restaurants/service";
import {
  changePostStatus,
  createPost,
  createReport,
  listFeed,
  listReports,
  moderateReport,
  setFollow,
  setLike,
  setSave,
  updatePost,
} from "../src/features/posts/service";
import { searchRestaurants } from "../src/features/discovery/service";
import type { Actor } from "../src/lib/session";

let state: Awaited<ReturnType<typeof testDatabase>>;
let restaurantId: string;

const owner: Actor = {
  id: "post-owner",
  email: "post-owner@example.test",
  name: "Post Owner",
  emailVerified: true,
};
const customer: Actor = {
  id: "post-customer",
  email: "post-customer@example.test",
  name: "Customer",
  emailVerified: true,
};
const outsider: Actor = {
  id: "post-outsider",
  email: "post-outsider@example.test",
  name: "Outsider",
  emailVerified: true,
};
const moderator: Actor = {
  id: "post-admin",
  email: "post-admin@example.test",
  name: "Moderator",
  emailVerified: true,
  isAdmin: true,
};

const profile = {
  name: "Kabul Kitchen",
  slug: "kabul-kitchen",
  description: "Fresh Afghan meals prepared every day for local families.",
  city: "Kabul" as const,
  area: "Shahr-e-Naw",
  address: "Street 4, Shahr-e-Naw, Kabul",
  phone: "+93700123456",
  cuisine: "Afghan" as const,
  deliveryAvailable: true,
  pickupAvailable: true,
  hours: Array.from({ length: 7 }, (_, day) => ({
    day,
    closed: false,
    opens: "00:00",
    closes: "23:59",
  })),
};

beforeAll(async () => {
  state = await testDatabase();
  await state.db.insert(user).values([owner, customer, outsider, moderator]);
  const restaurant = await createRestaurant(state.db, owner, profile);
  const pending = await submitRestaurant(
    state.db,
    owner,
    restaurant.id,
    restaurant.version,
  );
  const approved = await reviewRestaurant(state.db, moderator, restaurant.id, {
    decision: "approved",
    version: pending.version,
    note: "",
  });
  restaurantId = approved.id;
});

afterAll(async () => {
  await state.client.close();
});

describe("Phase 3 publishing and discovery", () => {
  it("keeps drafts private and requires restaurant approval before publishing", async () => {
    const draftRestaurant = await createRestaurant(state.db, owner, {
      ...profile,
      name: "Unreviewed Cafe",
      slug: "unreviewed-cafe",
    });
    const draft = await createPost(state.db, owner, draftRestaurant.id, {
      caption: "A private preview from our kitchen.",
    });

    expect((await listFeed(state.db)).items).toHaveLength(0);
    await expect(
      changePostStatus(state.db, owner, draftRestaurant.id, draft.id, {
        action: "publish",
        version: draft.version,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("enforces tenant boundaries and returns a stable cursor feed", async () => {
    const first = await createPost(state.db, owner, restaurantId, {
      caption: "Fresh mantu is ready for lunch today.",
    });
    await expect(
      updatePost(state.db, outsider, restaurantId, first.id, {
        caption: "An unauthorized edit must never work.",
        version: first.version,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const publishedFirst = await changePostStatus(
      state.db,
      owner,
      restaurantId,
      first.id,
      { action: "publish", version: first.version },
    );
    const second = await createPost(state.db, owner, restaurantId, {
      caption: "Warm bolani is coming out of the kitchen.",
    });
    await changePostStatus(state.db, owner, restaurantId, second.id, {
      action: "publish",
      version: second.version,
    });

    await state.db
      .update(post)
      .set({ linkedMealId: "48b6ea1d-b008-4355-83a1-762d644ab553" })
      .where(eq(post.id, publishedFirst.id));

    const pageOne = await listFeed(state.db, { limit: 1 });
    const pageTwo = await listFeed(state.db, {
      limit: 1,
      cursor: pageOne.nextCursor || undefined,
    });
    expect(pageOne.items).toHaveLength(1);
    expect(pageOne.nextCursor).toBeTruthy();
    expect(pageTwo.items).toHaveLength(1);
    expect(pageTwo.items[0].id).not.toBe(pageOne.items[0].id);
    expect(
      [...pageOne.items, ...pageTwo.items].find(
        (item) => item.id === publishedFirst.id,
      )?.linkedMeal,
    ).toBeNull();
  });

  it("makes follows, likes and saves reversible and idempotent", async () => {
    const [published] = (await listFeed(state.db)).items;
    expect(published).toBeTruthy();

    expect(
      (await setFollow(state.db, customer, restaurantId, { active: true }))
        .count,
    ).toBe(1);
    expect(
      (await setFollow(state.db, customer, restaurantId, { active: true }))
        .count,
    ).toBe(1);
    expect(
      (await listFeed(state.db, { mode: "following", actorId: customer.id }))
        .items.length,
    ).toBeGreaterThan(0);

    expect(
      (await setLike(state.db, customer, published.id, { active: true })).count,
    ).toBe(1);
    expect(
      (await setLike(state.db, customer, published.id, { active: true })).count,
    ).toBe(1);
    await setSave(state.db, customer, published.id, { active: true });
    expect(
      (
        await listFeed(state.db, { mode: "saved", actorId: customer.id })
      ).items.map((item) => item.id),
    ).toContain(published.id);

    expect(
      (await setLike(state.db, customer, published.id, { active: false }))
        .count,
    ).toBe(0);
    await setSave(state.db, customer, published.id, { active: false });
    await setFollow(state.db, customer, restaurantId, { active: false });
    expect(
      (await listFeed(state.db, { mode: "following", actorId: customer.id }))
        .items,
    ).toHaveLength(0);
    expect(
      (await listFeed(state.db, { mode: "saved", actorId: customer.id })).items,
    ).toHaveLength(0);
  });

  it("supports useful restaurant filters without exposing drafts", async () => {
    const results = await searchRestaurants(state.db, {
      q: "Afghan",
      city: "Kabul",
      cuisine: "Afghan",
      delivery: true,
      pickup: true,
      open: true,
      actorId: customer.id,
    });
    expect(results.map((item) => item.id)).toContain(restaurantId);
    expect(
      await searchRestaurants(state.db, { city: "Herat", delivery: true }),
    ).toHaveLength(0);
  });

  it("deduplicates reports and lets an admin remove reported content", async () => {
    const created = await createPost(state.db, owner, restaurantId, {
      caption: "This post will be reviewed by the moderation team.",
    });
    const published = await changePostStatus(
      state.db,
      owner,
      restaurantId,
      created.id,
      { action: "publish", version: created.version },
    );
    const reported = await createReport(state.db, customer, {
      postId: published.id,
      reason: "misleading",
      detail: "The details need verification.",
    });
    await expect(
      createReport(state.db, customer, {
        postId: published.id,
        reason: "spam",
        detail: "Duplicate report",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await listReports(state.db, moderator))[0].status).toBe("open");

    await moderateReport(state.db, moderator, reported.id, {
      action: "remove",
      note: "Confirmed policy violation.",
    });
    expect(
      (await listFeed(state.db)).items.map((item) => item.id),
    ).not.toContain(published.id);
    await expect(
      moderateReport(state.db, moderator, reported.id, {
        action: "dismiss",
        note: "Already reviewed.",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
