import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { transitionOrder } from "@/features/orders/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const value = await params;
    return transitionOrder(
      runtime().db,
      await requireUser(),
      value.id,
      value.orderId,
      await jsonBody(request),
    );
  });
}
