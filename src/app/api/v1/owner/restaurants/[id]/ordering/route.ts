import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { setAcceptingOrders } from "@/features/catalog/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    return setAcceptingOrders(
      runtime().db,
      await requireUser(),
      (await params).id,
      await jsonBody(request),
    );
  });
}
