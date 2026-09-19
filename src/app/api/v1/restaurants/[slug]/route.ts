import { api, HttpError } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { getPublic } from "@/features/restaurants/service";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return api(async () => {
    const r = await getPublic(runtime().db, (await params).slug);
    if (!r) throw new HttpError(404, "Restaurant not found.");
    return r;
  });
}
