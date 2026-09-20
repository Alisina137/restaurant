import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { api, boundedBody, HttpError, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { member } from "@/features/restaurants/service";
import { meal } from "@/db/schema";
import { deleteImage, putImage, sanitizeImage } from "@/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; mealId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const actor = await requireUser();
    const { id, mealId } = await params;
    const { db } = runtime();
    await member(db, actor, id);
    if (!actor.emailVerified)
      throw new HttpError(403, "Verify your email before uploading images.");
    const image = await sanitizeImage(
      await boundedBody(request, 5 * 1024 * 1024),
    );
    const key = `meals/${id}/${randomUUID()}.webp`;
    await putImage(key, image);
    let oldKey: string | null = null;
    try {
      const [existing] = await db
        .select({ imageKey: meal.imageKey })
        .from(meal)
        .where(and(eq(meal.id, mealId), eq(meal.restaurantId, id)));
      if (!existing) throw new HttpError(404, "Meal not found.");
      oldKey = existing.imageKey;
      const [updated] = await db
        .update(meal)
        .set({ imageKey: key, updatedAt: new Date() })
        .where(and(eq(meal.id, mealId), eq(meal.restaurantId, id)))
        .returning({ id: meal.id });
      if (!updated) throw new HttpError(404, "Meal not found.");
    } catch (error) {
      await deleteImage(key).catch(() => {});
      throw error;
    }
    if (oldKey)
      await deleteImage(oldKey).catch(() =>
        console.error("media_cleanup_failed"),
      );
    return { uploaded: true };
  });
}
