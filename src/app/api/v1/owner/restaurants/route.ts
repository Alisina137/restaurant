import { api, sameOrigin, jsonBody } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { createRestaurant, owned } from "@/features/restaurants/service";
export async function GET() {
  return api(async () => owned(runtime().db, await requireUser()));
}
export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    return createRestaurant(
      runtime().db,
      await requireUser(),
      await jsonBody(request),
    );
  });
}
