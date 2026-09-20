import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { changePostStatus, updatePost } from "@/features/posts/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const actor = await requireUser();
    const { id, postId } = await params;
    return updatePost(runtime().db, actor, id, postId, await jsonBody(request));
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const actor = await requireUser();
    const { id, postId } = await params;
    return changePostStatus(
      runtime().db,
      actor,
      id,
      postId,
      await jsonBody(request),
    );
  });
}
