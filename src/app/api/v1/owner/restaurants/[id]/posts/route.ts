import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { createPost } from "@/features/posts/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const actor = await requireUser();
    return createPost(
      runtime().db,
      actor,
      (await params).id,
      await jsonBody(request),
    );
  });
}
