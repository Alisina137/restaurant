import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { api, sameOrigin, boundedBody, HttpError } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { member } from "@/features/restaurants/service";
import { media, restaurant, restaurantRevision, audit } from "@/db/schema";
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
    let oldKey: string | null | undefined;
    try {
      await db.transaction(async (tx) => {
        const [[base], [revision]] = await Promise.all([
          tx.select().from(restaurant).where(eq(restaurant.id, id)),
          tx
            .select()
            .from(restaurantRevision)
            .where(eq(restaurantRevision.restaurantId, id)),
        ]);
        if (!base || base.status === "suspended")
          throw new HttpError(
            409,
            "This restaurant is suspended. Contact support.",
          );
        if (revision?.status === "pending_review")
          throw new HttpError(
            409,
            "This update is already under review. Wait for a decision first.",
          );
        const [old] = await tx
          .select()
          .from(media)
          .where(and(eq(media.restaurantId, id), eq(media.kind, kind)));
        if (base.status === "approved") {
          if (!revision) {
            await tx.insert(restaurantRevision).values({
              restaurantId: id,
              slug: base.slug,
              name: base.name,
              description: base.description,
              city: base.city,
              area: base.area,
              address: base.address,
              phone: base.phone,
              cuisine: base.cuisine,
              deliveryAvailable: base.deliveryAvailable,
              pickupAvailable: base.pickupAvailable,
              hours: base.hours,
            });
          } else {
            await tx
              .update(restaurantRevision)
              .set({
                status: "draft",
                reviewNote: "",
                version: sql`${restaurantRevision.version}+1`,
                updatedAt: new Date(),
              })
              .where(eq(restaurantRevision.id, revision.id));
          }
          oldKey = old?.pendingStorageKey;
          await tx
            .insert(media)
            .values({ restaurantId: id, kind, pendingStorageKey: key })
            .onConflictDoUpdate({
              target: [media.restaurantId, media.kind],
              set: { pendingStorageKey: key },
            });
        } else {
          await tx
            .update(restaurant)
            .set({
              status: "draft",
              reviewNote: "",
              version: sql`${restaurant.version}+1`,
              updatedAt: new Date(),
            })
            .where(eq(restaurant.id, id));
          oldKey = old?.storageKey;
          await tx
            .insert(media)
            .values({ restaurantId: id, kind, storageKey: key })
            .onConflictDoUpdate({
              target: [media.restaurantId, media.kind],
              set: { storageKey: key },
            });
        }
        await tx.insert(audit).values({
          actorId: actor.id,
          restaurantId: id,
          action:
            base.status === "approved"
              ? "profile_revision_photo_updated"
              : "photo_updated_requires_review",
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
