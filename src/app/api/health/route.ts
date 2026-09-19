import { sql } from "drizzle-orm";
import { runtime } from "@/lib/runtime";
import { configured } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!configured())
    return Response.json({ status: "unavailable" }, { status: 503 });
  try {
    await runtime().db.execute(sql`select 1`);
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
