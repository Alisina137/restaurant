import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { deleteAddress, saveAddress } from "@/features/customers/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    return saveAddress(
      runtime().db,
      await requireUser(),
      await jsonBody(request),
      (await params).id,
    );
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    return deleteAddress(runtime().db, await requireUser(), (await params).id);
  });
}
