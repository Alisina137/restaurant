import { api, sameOrigin, jsonBody } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { addStaff, removeStaff } from "@/features/restaurants/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const b = await jsonBody(request);
    return addStaff(
      runtime().db,
      await requireUser(),
      (await params).id,
      b.email,
    );
  });
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    sameOrigin(request);
    const b = await jsonBody(request);
    return removeStaff(
      runtime().db,
      await requireUser(),
      (await params).id,
      b.id,
    );
  });
}
