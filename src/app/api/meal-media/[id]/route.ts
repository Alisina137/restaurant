import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { runtime } from "@/lib/runtime";
import { getImage } from "@/lib/storage";
import { currentUser } from "@/lib/session";
import { meal, membership, restaurant } from "@/db/schema";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return new Response("Not found", { status: 404 });
  try {
    const { db } = runtime();
    const [record] = await db
      .select({
        imageKey: meal.imageKey,
        available: meal.available,
        restaurantId: meal.restaurantId,
        restaurantStatus: restaurant.status,
      })
      .from(meal)
      .innerJoin(restaurant, eq(restaurant.id, meal.restaurantId))
      .where(eq(meal.id, id));
    if (!record?.imageKey) return new Response("Not found", { status: 404 });
    const ownerView = new URL(request.url).searchParams.get("owner") === "1";
    if (!record.available || record.restaurantStatus !== "approved") {
      if (!ownerView) return new Response("Not found", { status: 404 });
      const actor = await currentUser();
      if (!actor) return new Response("Not found", { status: 404 });
      const [access] = await db
        .select({ id: membership.id })
        .from(membership)
        .where(
          and(
            eq(membership.restaurantId, record.restaurantId),
            eq(membership.userId, actor.id),
          ),
        );
      if (!access && !actor.isAdmin)
        return new Response("Not found", { status: 404 });
    }
    const bytes = await getImage(record.imageKey);
    if (!bytes) return new Response("Not found", { status: 404 });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Image unavailable", { status: 503 });
  }
}
