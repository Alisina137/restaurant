import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Database } from "@/db";
import {
  audit,
  follow,
  media,
  meal,
  membership,
  post,
  postLike,
  postMedia,
  report,
  restaurant,
  savedPost,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/session";
import { HttpError } from "@/lib/http";
import { admin, member } from "@/features/restaurants/service";
import {
  captionInput,
  postActionInput,
  reportDecisionInput,
  reportInput,
  socialInput,
  updatePostInput,
} from "./validation";
import { z } from "zod";

type FeedMode = "discover" | "following" | "saved";
type Cursor = { publishedAt: string; id: string };

function verified(actor: Actor) {
  if (!actor.emailVerified)
    throw new HttpError(403, "Verify your email before continuing.");
}

function encodeCursor(value: Cursor) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(value?: string): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString());
    return z
      .object({ publishedAt: z.string().datetime(), id: z.string().uuid() })
      .parse(parsed);
  } catch {
    throw new HttpError(400, "This feed page is invalid. Start again.");
  }
}

export async function listFeed(
  db: Database,
  options: {
    mode?: FeedMode;
    city?: string;
    cursor?: string;
    actorId?: string;
    restaurantId?: string;
    limit?: number;
  } = {},
) {
  const mode = options.mode || "discover";
  const limit = Math.min(Math.max(options.limit || 10, 1), 24);
  const cursor = decodeCursor(options.cursor);
  if (mode !== "discover" && !options.actorId)
    return { items: [], nextCursor: null };

  const conditions: SQL[] = [
    eq(post.status, "published"),
    eq(restaurant.status, "approved"),
  ];
  if (options.city)
    conditions.push(eq(restaurant.city, options.city.trim().slice(0, 80)));
  if (options.restaurantId)
    conditions.push(eq(post.restaurantId, options.restaurantId));
  if (mode === "following")
    conditions.push(
      exists(
        db
          .select({ id: follow.id })
          .from(follow)
          .where(
            and(
              eq(follow.restaurantId, post.restaurantId),
              eq(follow.userId, options.actorId!),
            ),
          ),
      ),
    );
  if (mode === "saved")
    conditions.push(
      exists(
        db
          .select({ id: savedPost.id })
          .from(savedPost)
          .where(
            and(
              eq(savedPost.postId, post.id),
              eq(savedPost.userId, options.actorId!),
            ),
          ),
      ),
    );
  if (cursor) {
    const time = new Date(cursor.publishedAt);
    conditions.push(
      or(
        lt(post.publishedAt, time),
        and(eq(post.publishedAt, time), lt(post.id, cursor.id)),
      )!,
    );
  }

  const rows = await db
    .select({
      id: post.id,
      caption: post.caption,
      publishedAt: post.publishedAt,
      linkedMealId: post.linkedMealId,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      city: restaurant.city,
      area: restaurant.area,
      cuisine: restaurant.cuisine,
      deliveryAvailable: restaurant.deliveryAvailable,
      pickupAvailable: restaurant.pickupAvailable,
    })
    .from(post)
    .innerJoin(restaurant, eq(post.restaurantId, restaurant.id))
    .where(and(...conditions))
    .orderBy(desc(post.publishedAt), desc(post.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  if (!page.length) return { items: [], nextCursor: null };
  const ids = page.map((item) => item.id);
  const restaurantIds = [...new Set(page.map((item) => item.restaurantId))];
  const linkedMealIds = page
    .map((item) => item.linkedMealId)
    .filter((id): id is string => Boolean(id));
  const [
    images,
    logos,
    linkedMeals,
    likeCounts,
    viewerLikes,
    viewerSaves,
    viewerFollows,
  ] = await Promise.all([
    db
      .select({
        id: postMedia.id,
        postId: postMedia.postId,
        position: postMedia.position,
      })
      .from(postMedia)
      .where(inArray(postMedia.postId, ids))
      .orderBy(asc(postMedia.position)),
    db
      .select({ id: media.id, restaurantId: media.restaurantId })
      .from(media)
      .where(
        and(
          inArray(media.restaurantId, restaurantIds),
          eq(media.kind, "logo"),
          isNotNull(media.storageKey),
        ),
      ),
    linkedMealIds.length
      ? db
          .select({
            id: meal.id,
            restaurantId: meal.restaurantId,
            name: meal.name,
            priceMinor: meal.priceMinor,
            imageKey: meal.imageKey,
          })
          .from(meal)
          .where(and(inArray(meal.id, linkedMealIds), eq(meal.available, true)))
      : Promise.resolve([]),
    db
      .select({ postId: postLike.postId, value: count() })
      .from(postLike)
      .where(inArray(postLike.postId, ids))
      .groupBy(postLike.postId),
    options.actorId
      ? db
          .select({ postId: postLike.postId })
          .from(postLike)
          .where(
            and(
              eq(postLike.userId, options.actorId),
              inArray(postLike.postId, ids),
            ),
          )
      : Promise.resolve([]),
    options.actorId
      ? db
          .select({ postId: savedPost.postId })
          .from(savedPost)
          .where(
            and(
              eq(savedPost.userId, options.actorId),
              inArray(savedPost.postId, ids),
            ),
          )
      : Promise.resolve([]),
    options.actorId
      ? db
          .select({ restaurantId: follow.restaurantId })
          .from(follow)
          .where(
            and(
              eq(follow.userId, options.actorId),
              inArray(follow.restaurantId, restaurantIds),
            ),
          )
      : Promise.resolve([]),
  ]);

  const liked = new Set(viewerLikes.map((item) => item.postId));
  const saved = new Set(viewerSaves.map((item) => item.postId));
  const followed = new Set(viewerFollows.map((item) => item.restaurantId));
  const likes = new Map(
    likeCounts.map((item) => [item.postId, Number(item.value)]),
  );
  const logoByRestaurant = new Map(
    logos.map((item) => [item.restaurantId, item.id]),
  );
  const mealById = new Map(linkedMeals.map((item) => [item.id, item]));
  const mediaByPost = new Map<string, { id: string; position: number }[]>();
  for (const image of images) {
    const current = mediaByPost.get(image.postId) || [];
    current.push({ id: image.id, position: image.position });
    mediaByPost.set(image.postId, current);
  }

  const items = page.map((item) => ({
    ...item,
    publishedAt: item.publishedAt!,
    images: mediaByPost.get(item.id) || [],
    logoId: logoByRestaurant.get(item.restaurantId) || null,
    likeCount: likes.get(item.id) || 0,
    liked: liked.has(item.id),
    saved: saved.has(item.id),
    following: followed.has(item.restaurantId),
    linkedMeal:
      item.linkedMealId &&
      mealById.get(item.linkedMealId)?.restaurantId === item.restaurantId
        ? mealById.get(item.linkedMealId)!
        : null,
  }));
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({
            publishedAt: last.publishedAt.toISOString(),
            id: last.id,
          })
        : null,
  };
}

export async function listOwnedPosts(
  db: Database,
  actor: Actor,
  restaurantId: string,
) {
  await member(db, actor, restaurantId);
  const rows = await db
    .select()
    .from(post)
    .where(eq(post.restaurantId, restaurantId))
    .orderBy(desc(post.createdAt));
  if (!rows.length) return [];
  const images = await db
    .select({
      id: postMedia.id,
      postId: postMedia.postId,
      position: postMedia.position,
    })
    .from(postMedia)
    .where(
      inArray(
        postMedia.postId,
        rows.map((item) => item.id),
      ),
    )
    .orderBy(asc(postMedia.position));
  return rows.map((item) => ({
    ...item,
    images: images.filter((image) => image.postId === item.id),
  }));
}

export async function createPost(
  db: Database,
  actor: Actor,
  restaurantId: string,
  raw: unknown,
) {
  verified(actor);
  await member(db, actor, restaurantId);
  const input = captionInput.parse(raw);
  const [r] = await db
    .select({ status: restaurant.status })
    .from(restaurant)
    .where(eq(restaurant.id, restaurantId));
  if (!r || r.status === "suspended")
    throw new HttpError(409, "This restaurant cannot create posts right now.");
  if (input.linkedMealId) {
    const [linked] = await db
      .select({ id: meal.id })
      .from(meal)
      .where(
        and(
          eq(meal.id, input.linkedMealId),
          eq(meal.restaurantId, restaurantId),
        ),
      );
    if (!linked)
      throw new HttpError(400, "Choose a meal from this restaurant.");
  }
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(post)
      .values({
        restaurantId,
        caption: input.caption,
        linkedMealId: input.linkedMealId || null,
      })
      .returning();
    await tx.insert(audit).values({
      actorId: actor.id,
      restaurantId,
      action: "post_created",
      detail: created.id,
    });
    return created;
  });
}

export async function updatePost(
  db: Database,
  actor: Actor,
  restaurantId: string,
  postId: string,
  raw: unknown,
) {
  verified(actor);
  await member(db, actor, restaurantId);
  z.string().uuid().parse(postId);
  const input = updatePostInput.parse(raw);
  if (input.linkedMealId) {
    const [linked] = await db
      .select({ id: meal.id })
      .from(meal)
      .where(
        and(
          eq(meal.id, input.linkedMealId),
          eq(meal.restaurantId, restaurantId),
        ),
      );
    if (!linked)
      throw new HttpError(400, "Choose a meal from this restaurant.");
  }
  const [updated] = await db
    .update(post)
    .set({
      caption: input.caption,
      linkedMealId: input.linkedMealId || null,
      version: input.version + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(post.id, postId),
        eq(post.restaurantId, restaurantId),
        eq(post.version, input.version),
        sql`${post.status} <> 'removed'`,
      ),
    )
    .returning();
  if (!updated)
    throw new HttpError(409, "This post changed. Refresh before editing it.");
  return updated;
}

export async function changePostStatus(
  db: Database,
  actor: Actor,
  restaurantId: string,
  postId: string,
  raw: unknown,
) {
  verified(actor);
  await member(db, actor, restaurantId);
  z.string().uuid().parse(postId);
  const input = postActionInput.parse(raw);
  const [r] = await db
    .select({ status: restaurant.status })
    .from(restaurant)
    .where(eq(restaurant.id, restaurantId));
  if (!r || r.status === "suspended")
    throw new HttpError(409, "This restaurant cannot publish posts right now.");
  if (input.action === "publish" && r.status !== "approved")
    throw new HttpError(
      409,
      "The restaurant must be approved before publishing.",
    );
  const next =
    input.action === "publish"
      ? "published"
      : input.action === "archive"
        ? "archived"
        : "draft";
  const allowed =
    input.action === "publish"
      ? sql`${post.status} in ('draft', 'archived')`
      : input.action === "unpublish"
        ? eq(post.status, "published")
        : sql`${post.status} <> 'removed'`;
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(post)
      .set({
        status: next,
        publishedAt: next === "published" ? new Date() : null,
        version: input.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(post.id, postId),
          eq(post.restaurantId, restaurantId),
          eq(post.version, input.version),
          allowed,
        ),
      )
      .returning();
    if (!updated)
      throw new HttpError(409, "This post changed. Refresh and try again.");
    await tx.insert(audit).values({
      actorId: actor.id,
      restaurantId,
      action: `post_${next}`,
      detail: postId,
    });
    return updated;
  });
}

async function ensurePublicPost(db: Database, postId: string) {
  z.string().uuid().parse(postId);
  const [record] = await db
    .select({ id: post.id, restaurantId: post.restaurantId })
    .from(post)
    .innerJoin(restaurant, eq(post.restaurantId, restaurant.id))
    .where(
      and(
        eq(post.id, postId),
        eq(post.status, "published"),
        eq(restaurant.status, "approved"),
      ),
    );
  if (!record) throw new HttpError(404, "This post is no longer available.");
  return record;
}

export async function setFollow(
  db: Database,
  actor: Actor,
  restaurantId: string,
  raw: unknown,
) {
  verified(actor);
  z.string().uuid().parse(restaurantId);
  const { active } = socialInput.parse(raw);
  const [r] = await db
    .select({ id: restaurant.id })
    .from(restaurant)
    .where(
      and(eq(restaurant.id, restaurantId), eq(restaurant.status, "approved")),
    );
  if (!r) throw new HttpError(404, "This restaurant is not available.");
  if (active)
    await db
      .insert(follow)
      .values({ userId: actor.id, restaurantId })
      .onConflictDoNothing();
  else
    await db
      .delete(follow)
      .where(
        and(eq(follow.userId, actor.id), eq(follow.restaurantId, restaurantId)),
      );
  const [total] = await db
    .select({ value: count() })
    .from(follow)
    .where(eq(follow.restaurantId, restaurantId));
  return { active, count: Number(total.value) };
}

export async function setLike(
  db: Database,
  actor: Actor,
  postId: string,
  raw: unknown,
) {
  verified(actor);
  await ensurePublicPost(db, postId);
  const { active } = socialInput.parse(raw);
  if (active)
    await db
      .insert(postLike)
      .values({ userId: actor.id, postId })
      .onConflictDoNothing();
  else
    await db
      .delete(postLike)
      .where(and(eq(postLike.userId, actor.id), eq(postLike.postId, postId)));
  const [total] = await db
    .select({ value: count() })
    .from(postLike)
    .where(eq(postLike.postId, postId));
  return { active, count: Number(total.value) };
}

export async function setSave(
  db: Database,
  actor: Actor,
  postId: string,
  raw: unknown,
) {
  verified(actor);
  await ensurePublicPost(db, postId);
  const { active } = socialInput.parse(raw);
  if (active)
    await db
      .insert(savedPost)
      .values({ userId: actor.id, postId })
      .onConflictDoNothing();
  else
    await db
      .delete(savedPost)
      .where(and(eq(savedPost.userId, actor.id), eq(savedPost.postId, postId)));
  return { active };
}

export async function createReport(db: Database, actor: Actor, raw: unknown) {
  verified(actor);
  const input = reportInput.parse(raw);
  await ensurePublicPost(db, input.postId);
  const [created] = await db
    .insert(report)
    .values({
      actorId: actor.id,
      postId: input.postId,
      reason: input.reason,
      detail: input.detail,
    })
    .onConflictDoNothing()
    .returning({ id: report.id });
  if (!created) throw new HttpError(409, "You already reported this post.");
  return created;
}

export async function listReports(db: Database, actor: Actor) {
  await admin(db, actor);
  return db
    .select({
      id: report.id,
      reason: report.reason,
      detail: report.detail,
      status: report.status,
      createdAt: report.createdAt,
      reporterName: user.name,
      reporterEmail: user.email,
      postId: post.id,
      caption: post.caption,
      postStatus: post.status,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
    })
    .from(report)
    .innerJoin(user, eq(report.actorId, user.id))
    .innerJoin(post, eq(report.postId, post.id))
    .innerJoin(restaurant, eq(post.restaurantId, restaurant.id))
    .orderBy(
      sql`case when ${report.status} = 'open' then 0 else 1 end`,
      desc(report.createdAt),
    )
    .limit(200);
}

export async function moderateReport(
  db: Database,
  actor: Actor,
  reportId: string,
  raw: unknown,
) {
  await admin(db, actor);
  z.string().uuid().parse(reportId);
  const input = reportDecisionInput.parse(raw);
  return db.transaction(async (tx) => {
    const [record] = await tx
      .select({
        postId: report.postId,
        restaurantId: post.restaurantId,
      })
      .from(report)
      .innerJoin(post, eq(report.postId, post.id))
      .where(and(eq(report.id, reportId), eq(report.status, "open")));
    if (!record) throw new HttpError(409, "This report was already handled.");
    const [resolved] = await tx
      .update(report)
      .set({
        status: input.action === "remove" ? "resolved" : "dismissed",
        resolutionNote: input.note,
        resolvedBy: actor.id,
        resolvedAt: new Date(),
      })
      .where(and(eq(report.id, reportId), eq(report.status, "open")))
      .returning();
    if (!resolved) throw new HttpError(409, "This report was already handled.");
    if (input.action === "remove")
      await tx
        .update(post)
        .set({
          status: "removed",
          updatedAt: new Date(),
          version: sql`${post.version}+1`,
        })
        .where(eq(post.id, record.postId));
    await tx.insert(audit).values({
      actorId: actor.id,
      restaurantId: record.restaurantId,
      action:
        input.action === "remove"
          ? "reported_post_removed"
          : "report_dismissed",
      detail: `${reportId}: ${input.note}`,
    });
    return resolved;
  });
}

export async function canReadPostMedia(
  db: Database,
  actor: Actor | null,
  mediaId: string,
) {
  z.string().uuid().parse(mediaId);
  const [record] = await db
    .select({
      key: postMedia.storageKey,
      postStatus: post.status,
      restaurantStatus: restaurant.status,
      restaurantId: restaurant.id,
    })
    .from(postMedia)
    .innerJoin(post, eq(postMedia.postId, post.id))
    .innerJoin(restaurant, eq(post.restaurantId, restaurant.id))
    .where(eq(postMedia.id, mediaId));
  if (!record) return null;
  if (
    record.postStatus === "published" &&
    record.restaurantStatus === "approved"
  )
    return record.key;
  if (!actor) return null;
  if (actor.isAdmin) return record.key;
  const [access] = await db
    .select({ id: membership.id })
    .from(membership)
    .where(
      and(
        eq(membership.restaurantId, record.restaurantId),
        eq(membership.userId, actor.id),
      ),
    );
  return access ? record.key : null;
}
