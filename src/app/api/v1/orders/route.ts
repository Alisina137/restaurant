import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { customerOrders, placeOrder } from "@/features/orders/service";

export async function GET() {
  return api(async () => customerOrders(runtime().db, await requireUser()));
}

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    return placeOrder(
      runtime().db,
      await requireUser(),
      await jsonBody(request),
    );
  });
}
