import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { testDatabase } from "./database";
import { user, membership, audit } from "../src/db/schema";
import {
  createRestaurant,
  getPublic,
  submitRestaurant,
  reviewRestaurant,
  updateRestaurant,
  addStaff,
  removeStaff,
  member,
  listPublic,
} from "../src/features/restaurants/service";
import type { Actor } from "../src/lib/session";
let state: Awaited<ReturnType<typeof testDatabase>>;
const owner: Actor = {
  id: "owner",
  email: "owner@example.test",
  name: "Owner",
  emailVerified: true,
};
const outsider: Actor = {
  id: "other",
  email: "other@example.test",
  name: "Other",
  emailVerified: true,
};
const reviewer: Actor = {
  id: "admin",
  email: "admin@example.test",
  name: "Admin",
  emailVerified: true,
  isAdmin: true,
};
const profile = {
  name: "Test Kitchen",
  slug: "test-kitchen",
  description: "Fresh food prepared by our local kitchen.",
  city: "Kabul",
  area: "Test Area",
  address: "Street 1, Test Landmark",
  phone: "+93700123456",
  cuisine: "Afghan",
  hours: Array.from({ length: 7 }, (_, day) => ({
    day,
    closed: false,
    opens: "09:00",
    closes: "22:00",
  })),
};
beforeAll(async () => {
  state = await testDatabase();
  await state.db.insert(user).values([owner, outsider, reviewer]);
});
afterAll(async () => {
  await state.client.close();
});
describe("restaurant ownership and review lifecycle", () => {
  it("keeps drafts private, blocks cross-tenant writes and prevents self-approval", async () => {
    const r = await createRestaurant(state.db, owner, profile);
    expect(await getPublic(state.db, r.slug)).toBeNull();
    expect(await listPublic(state.db)).toHaveLength(0);
    await expect(
      updateRestaurant(state.db, outsider, r.id, {
        ...profile,
        version: r.version,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const submitted = await submitRestaurant(state.db, owner, r.id, r.version);
    await expect(
      reviewRestaurant(state.db, owner, r.id, {
        decision: "approved",
        version: submitted.version,
        note: "",
      }),
    ).rejects.toMatchObject({ status: 403 });
    const approved = await reviewRestaurant(state.db, reviewer, r.id, {
      decision: "approved",
      version: submitted.version,
      note: "",
    });
    const visible = await getPublic(state.db, r.slug);
    expect(visible?.name).toBe(profile.name);
    expect(visible).not.toHaveProperty("reviewNote");
    expect(visible).not.toHaveProperty("version");
    const changed = await updateRestaurant(state.db, owner, r.id, {
      ...profile,
      description: "Updated identity requires a new review.",
      version: approved.version,
    });
    expect(changed.status).toBe("draft");
    expect(await getPublic(state.db, r.slug)).toBeNull();
    await expect(
      updateRestaurant(state.db, owner, r.id, {
        ...profile,
        version: approved.version,
      }),
    ).rejects.toMatchObject({ status: 409 });
    const events = await state.db
      .select()
      .from(audit)
      .where(eq(audit.restaurantId, r.id));
    expect(events.length).toBe(4);
  });
  it("validates uniqueness and never leaves orphan owners after failed creation", async () => {
    await expect(
      createRestaurant(state.db, owner, profile),
    ).rejects.toMatchObject({ status: 409 });
    const memberships = await state.db
      .select()
      .from(membership)
      .where(eq(membership.userId, owner.id));
    expect(memberships).toHaveLength(1);
  });
  it("restricts staff and revokes access immediately", async () => {
    const r = await createRestaurant(state.db, owner, {
      ...profile,
      slug: "second-kitchen",
    });
    const staff = await addStaff(state.db, owner, r.id, outsider.email);
    expect((await member(state.db, outsider, r.id)).role).toBe("staff");
    await expect(
      updateRestaurant(state.db, outsider, r.id, {
        ...profile,
        version: r.version,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      addStaff(state.db, outsider, r.id, reviewer.email),
    ).rejects.toMatchObject({ status: 403 });
    await removeStaff(state.db, owner, r.id, staff.id);
    await expect(member(state.db, outsider, r.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      removeStaff(
        state.db,
        owner,
        r.id,
        (await member(state.db, owner, r.id)).id,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("blocks privileged self-review even if owner is also an administrator", async () => {
    const r = await createRestaurant(state.db, reviewer, {
      ...profile,
      slug: "admin-kitchen",
    });
    const pending = await submitRestaurant(state.db, reviewer, r.id, r.version);
    await expect(
      reviewRestaurant(state.db, reviewer, r.id, {
        version: pending.version,
        decision: "approved",
        note: "",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("enforces suspension and stale-review protection", async () => {
    const r = await createRestaurant(state.db, owner, {
      ...profile,
      slug: "suspended-kitchen",
    });
    const p = await submitRestaurant(state.db, owner, r.id, r.version);
    const a = await reviewRestaurant(state.db, reviewer, r.id, {
      version: p.version,
      decision: "approved",
      note: "",
    });
    await expect(
      reviewRestaurant(state.db, reviewer, r.id, {
        version: p.version,
        decision: "changes_requested",
        note: "Old decision",
      }),
    ).rejects.toMatchObject({ status: 409 });
    const s = await reviewRestaurant(state.db, reviewer, r.id, {
      version: a.version,
      decision: "suspended",
      note: "Verify business address.",
    });
    expect(await getPublic(state.db, r.slug)).toBeNull();
    await expect(
      updateRestaurant(state.db, owner, r.id, {
        ...profile,
        version: s.version,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects unverified owners and malicious client role/status fields", async () => {
    await expect(
      createRestaurant(
        state.db,
        { ...owner, emailVerified: false },
        { ...profile, slug: "unverified" },
      ),
    ).rejects.toMatchObject({ status: 403 });
    const r = await createRestaurant(state.db, owner, {
      ...profile,
      slug: "injected",
      status: "approved",
      isAdmin: true,
    });
    expect(r.status).toBe("draft");
  });
});
