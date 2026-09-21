import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { api, boundedBody, HttpError, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { member } from "@/features/restaurants/service";
import { post, postMedia } from "@/db/schema";
import { deleteImage, putImage, sanitizeImage } from "@/lib/storage";
import { z } from "zod";

async function access(restaurantId: string, postId: string) {
  z.string().uuid().parse(postId);
  const actor = await requireUser();
  if (!actor.emailVerified)
    throw new HttpError(403, "Verify your email first.");
  const { db } = runtime();
  await member(db, actor, restaurantId, "posts");
  const [record] = await db
    .select({ id: post.id, status: post.status })
    .from(post)
    .where(and(eq(post.id, postId), eq(post.restaurantId, restaurantId)));
  if (!record || record.status === "removed")
    throw new HttpError(404, "Post not found.");
  return { db };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const { id, postId } = await params;
    const { db } = await access(id, postId);
    const current = await db
      .select({ position: postMedia.position })
      .from(postMedia)
      .where(eq(postMedia.postId, postId))
      .orderBy(asc(postMedia.position));
    if (current.length >= 4)
      throw new HttpError(409, "A post can contain up to four photos.");
    const usedPositions = new Set(current.map((item) => item.position));
    const position = [0, 1, 2, 3].find((item) => !usedPositions.has(item));
    if (position === undefined)
      throw new HttpError(409, "Photos changed. Refresh and try again.");
    const image = await sanitizeImage(
      await boundedBody(request, 5 * 1024 * 1024),
    );
    const key = `posts/${postId}/${randomUUID()}.webp`;
    await putImage(key, image);
    try {
      const [created] = await db
        .insert(postMedia)
        .values({ postId, storageKey: key, position })
        .returning({ id: postMedia.id });
      return created;
    } catch (error) {
      await deleteImage(key).catch(() => {});
      const databaseError = error as {
        code?: string;
        cause?: { code?: string };
      };
      if (
        databaseError.code === "23505" ||
        databaseError.cause?.code === "23505"
      )
        throw new HttpError(409, "Photos changed. Refresh and try again.");
      throw error;
    }
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const { id, postId } = await params;
    const { db } = await access(id, postId);
    const mediaId = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("mediaId"));
    const [removed] = await db
      .delete(postMedia)
      .where(and(eq(postMedia.id, mediaId), eq(postMedia.postId, postId)))
      .returning({ key: postMedia.storageKey });
    if (!removed) throw new HttpError(404, "Photo not found.");
    await deleteImage(removed.key).catch(() =>
      console.error("post_media_cleanup_failed"),
    );
    return { removed: true };
  });
}
