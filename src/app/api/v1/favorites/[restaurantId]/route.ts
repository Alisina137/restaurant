import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { setFavorite } from "@/features/customers/service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ restaurantId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    return setFavorite(
      runtime().db,
      await requireUser(),
      (await params).restaurantId,
      await jsonBody(request),
    );
  });
}
