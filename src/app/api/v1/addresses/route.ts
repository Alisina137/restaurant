import { api, jsonBody, sameOrigin } from "@/lib/http";
import { runtime } from "@/lib/runtime";
import { requireUser } from "@/lib/session";
import { listAddresses, saveAddress } from "@/features/customers/service";

export async function GET() {
  return api(async () => listAddresses(runtime().db, await requireUser()));
}

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    return saveAddress(
      runtime().db,
      await requireUser(),
      await jsonBody(request),
    );
  });
}
