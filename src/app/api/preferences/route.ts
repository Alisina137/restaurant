import { cookies } from "next/headers";
import { z } from "zod";
import { api, jsonBody, sameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { workspaceContext } from "@/features/workspaces/service";
import { HttpError } from "@/lib/http";

const input = z
  .object({
    workspace: z.string().max(80).optional(),
    lowData: z.boolean().optional(),
  })
  .refine(
    (value) => value.workspace !== undefined || value.lowData !== undefined,
  );

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const body = input.parse(await jsonBody(request));
    const store = await cookies();
    if (body.workspace !== undefined) {
      const actor = await requireUser();
      const context = await workspaceContext(runtime().db, actor);
      const allowed = [
        "personal",
        ...(actor.isAdmin ? ["admin"] : []),
        ...context.workspaces.map((item) => item.key),
      ];
      if (!allowed.includes(body.workspace))
        throw new HttpError(403, "That workspace is not available.");
      store.set("active_workspace", body.workspace, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 31536000,
      });
    }
    if (body.lowData !== undefined)
      store.set("low_data", body.lowData ? "1" : "0", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 31536000,
      });
    return body;
  });
}
