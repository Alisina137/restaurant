import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { createReport } from "@/features/posts/service";

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    return createReport(
      runtime().db,
      await requireUser(),
      await jsonBody(request),
    );
  });
}
