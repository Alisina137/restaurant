import { api, HttpError } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { currentUser } from "@/lib/session";
import { listFeed } from "@/features/posts/service";

export async function GET(request: Request) {
  return api(async () => {
    const query = new URL(request.url).searchParams;
    const mode = query.get("mode") || "discover";
    if (!["discover", "following"].includes(mode))
      throw new HttpError(400, "Unknown feed mode.");
    const actor = await currentUser();
    return listFeed(runtime().db, {
      mode: mode as "discover" | "following",
      city: query.get("city") || undefined,
      cursor: query.get("cursor") || undefined,
      actorId: actor?.id,
    });
  });
}
