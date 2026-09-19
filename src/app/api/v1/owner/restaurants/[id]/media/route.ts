import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { api, sameOrigin, boundedBody, HttpError } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { member } from "@/features/restaurants/service";
import { media, restaurant, audit } from "@/db/schema";
import { putImage, deleteImage, sanitizeImage } from "@/lib/storage";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const actor = await requireUser();
    const { id } = await params;
    const { db } = runtime();
    await member(db, actor, id, true);
    if (!actor.emailVerified)
      throw new HttpError(403, "Verify your email first.");
    const kind = z
      .enum(["cover", "logo"])
      .parse(new URL(request.url).searchParams.get("kind"));
    const image = await sanitizeImage(
      await boundedBody(request, 5 * 1024 * 1024),
    );
    const key = `restaurants/${id}/${randomUUID()}.webp`;
    await putImage(key, image);
    let oldKey: string | undefined;
    try {
      await db.transaction(async (tx) => {
        const [r] = await tx
          .update(restaurant)
          .set({
            status: "draft",
            reviewNote: "",
            version: sql`${restaurant.version}+1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(restaurant.id, id),
              sql`${restaurant.status} <> 'suspended'`,
            ),
          )
          .returning();
        if (!r)
          throw new HttpError(
            409,
            "This restaurant is suspended. Contact support.",
          );
        const [old] = await tx
          .select()
          .from(media)
          .where(and(eq(media.restaurantId, id), eq(media.kind, kind)));
        oldKey = old?.storageKey;
        await tx
          .insert(media)
          .values({ restaurantId: id, kind, storageKey: key })
          .onConflictDoUpdate({
            target: [media.restaurantId, media.kind],
            set: { storageKey: key },
          });
        await tx
          .insert(audit)
          .values({
            actorId: actor.id,
            restaurantId: id,
            action: "photo_updated_requires_review",
          });
      });
    } catch (e) {
      await deleteImage(key).catch(() => {});
      throw e;
    }
    if (oldKey)
      await deleteImage(oldKey).catch(() =>
        console.error("media_cleanup_failed"),
      );
    return { uploaded: true };
  });
}
