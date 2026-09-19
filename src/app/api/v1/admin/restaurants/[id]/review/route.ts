import { api, sameOrigin, jsonBody } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { reviewRestaurant } from "@/features/restaurants/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    return reviewRestaurant(
      runtime().db,
      await requireUser(),
      (await params).id,
      await jsonBody(request),
    );
  });
}
