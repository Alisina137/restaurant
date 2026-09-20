import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { setLike } from "@/features/posts/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    return setLike(
      runtime().db,
      await requireUser(),
      (await params).postId,
      await jsonBody(request),
    );
  });
}
