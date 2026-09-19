import { cookies } from "next/headers";
import { api, sameOrigin, jsonBody } from "@/lib/http";
import { z } from "zod";
export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const locale = z
      .enum(["en", "fa", "ps"])
      .parse((await jsonBody(request)).locale);
    (await cookies()).set("locale", locale, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 31536000,
    });
    return { locale };
  });
}
