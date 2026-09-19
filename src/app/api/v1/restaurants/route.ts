import { api } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { listPublic } from "@/features/restaurants/service";
export const dynamic = "force-dynamic";
export async function GET() {
  return api(() => listPublic(runtime().db));
}
