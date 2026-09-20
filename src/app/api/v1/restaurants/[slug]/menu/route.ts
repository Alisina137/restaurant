import { api, HttpError } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { getPublic } from "@/features/restaurants/service";
import { publicMenu } from "@/features/catalog/service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return api(async () => {
    const { db } = runtime();
    const record = await getPublic(db, (await params).slug);
    if (!record) throw new HttpError(404, "Restaurant not found.");
    return publicMenu(db, record.id);
  });
}
