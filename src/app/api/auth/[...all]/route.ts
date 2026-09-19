import { secureAuthHandler } from "@/lib/auth-handler";
import { runtime } from "@/lib/runtime";
import { configured } from "@/lib/env";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  if (!configured())
    return Response.json(
      { message: "Accounts are not configured yet. Please try again later." },
      { status: 503 },
    );
  return secureAuthHandler(runtime().auth, request);
}
export { handler as GET, handler as POST };
