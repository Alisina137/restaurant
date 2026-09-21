import { api, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { previewReorder } from "@/features/orders/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    return previewReorder(
      runtime().db,
      await requireUser(),
      (await params).orderId,
    );
  });
}
