import { api, HttpError } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { currentUser } from "@/lib/session";
import { canReadPostMedia } from "@/features/posts/service";
import { getImage } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const key = await canReadPostMedia(
      runtime().db,
      await currentUser(),
      (await params).id,
    );
    if (!key) throw new HttpError(404, "Photo not found.");
    const bytes = await getImage(key);
    if (!bytes) throw new HttpError(404, "Photo not found.");
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return api(async () => {
      throw error;
    });
  }
}
