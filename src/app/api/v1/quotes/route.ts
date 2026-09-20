import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { createQuote } from "@/features/orders/service";

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    return createQuote(
      runtime().db,
      await requireUser(),
      await jsonBody(request),
    );
  });
}
