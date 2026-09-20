import { api } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { restaurantOrders } from "@/features/orders/service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () =>
    restaurantOrders(runtime().db, await requireUser(), (await params).id),
  );
}
