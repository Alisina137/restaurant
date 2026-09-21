import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { setMealAvailability } from "@/features/catalog/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; mealId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const values = await params;
    return setMealAvailability(
      runtime().db,
      await requireUser(),
      values.id,
      values.mealId,
      await jsonBody(request),
    );
  });
}
