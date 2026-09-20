import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { saveZone } from "@/features/catalog/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; zoneId: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const value = await params;
    return saveZone(
      runtime().db,
      await requireUser(),
      value.id,
      await jsonBody(request),
      value.zoneId,
    );
  });
}
