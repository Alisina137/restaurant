import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { saveMeal } from "@/features/catalog/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    return saveMeal(
      runtime().db,
      await requireUser(),
      (await params).id,
      await jsonBody(request),
    );
  });
}
