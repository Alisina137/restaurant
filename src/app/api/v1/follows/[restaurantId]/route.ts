import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { setFollow } from "@/features/posts/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ restaurantId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    return setFollow(
      runtime().db,
      await requireUser(),
      (await params).restaurantId,
      await jsonBody(request),
    );
  });
}
