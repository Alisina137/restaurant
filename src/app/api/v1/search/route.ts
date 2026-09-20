import { api } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { currentUser } from "@/lib/session";
import { searchRestaurants } from "@/features/discovery/service";

export async function GET(request: Request) {
  return api(async () => {
    const query = new URL(request.url).searchParams;
    const actor = await currentUser();
    return searchRestaurants(runtime().db, {
      q: query.get("q") || undefined,
      city: query.get("city") || undefined,
      area: query.get("area") || undefined,
      cuisine: query.get("cuisine") || undefined,
      open: query.get("open") === "1",
      delivery: query.get("delivery") === "1",
      pickup: query.get("pickup") === "1",
      actorId: actor?.id,
    });
  });
}
