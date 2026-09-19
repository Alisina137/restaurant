import { api, sameOrigin, jsonBody } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { submitRestaurant } from "@/features/restaurants/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const body = await jsonBody(request);
    return submitRestaurant(
      runtime().db,
      await requireUser(),
      (await params).id,
      body.version,
    );
  });
}
