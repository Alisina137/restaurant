import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { media, restaurant, membership } from "@/db/schema";
import { runtime } from "@/lib/runtime";
import { currentUser } from "@/lib/session";
import { getImage } from "@/lib/storage";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return new Response("Not found", { status: 404 });
  try {
    const { db } = runtime();
    const [r] = await db
      .select({ media, status: restaurant.status })
      .from(media)
      .innerJoin(restaurant, eq(media.restaurantId, restaurant.id))
      .where(eq(media.id, id));
    if (!r) return new Response("Not found", { status: 404 });
    const draft = new URL(request.url).searchParams.get("draft") === "1";
    if (draft || r.status !== "approved") {
      const actor = await currentUser();
      if (!actor) return new Response("Not found", { status: 404 });
      const [m] = await db
        .select()
        .from(membership)
        .where(
          and(
            eq(membership.restaurantId, r.media.restaurantId),
            eq(membership.userId, actor.id),
          ),
        );
      if ((!m || m.role !== "owner") && !actor.isAdmin)
        return new Response("Not found", { status: 404 });
    }
    const key = draft
      ? r.media.pendingStorageKey || r.media.storageKey
      : r.status === "approved"
        ? r.media.storageKey
        : null;
    if (!key) return new Response("Not found", { status: 404 });
    const bytes = await getImage(key);
    if (!bytes) return new Response("Not found", { status: 404 });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Image unavailable", { status: 503 });
  }
}
