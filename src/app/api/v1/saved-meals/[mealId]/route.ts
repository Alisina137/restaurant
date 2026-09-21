import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { setSavedMeal } from "@/features/customers/service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ mealId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    return setSavedMeal(
      runtime().db,
      await requireUser(),
      (await params).mealId,
      await jsonBody(request),
    );
  });
}
