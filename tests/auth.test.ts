import { secureAuthHandler } from "../src/lib/auth-handler";
import { beforeAll, afterAll, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { testDatabase } from "./database";
import { createAuth, type Mail } from "../src/lib/auth-factory";
import { readEnvironment } from "../src/lib/env";
import { user, account } from "../src/db/schema";
let state: Awaited<ReturnType<typeof testDatabase>>,
  auth: ReturnType<typeof createAuth>;
const mails: Mail[] = [];
const origin = "http://localhost:3000";
const email = "customer@example.test",
  password = "Correct-Horse-42!";
function request(path: string, body: unknown, ip = "192.0.2.10") {
  return secureAuthHandler(
    auth,
    new Request(origin + "/api/auth/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin, "x-real-ip": ip },
      body: JSON.stringify(body),
    }),
  );
}
beforeAll(async () => {
  state = await testDatabase();
  auth = createAuth(
    state.db,
    readEnvironment({
      DATABASE_URL: "postgresql://test:test@localhost/test",
      BETTER_AUTH_SECRET: "test-secret-only-0000000000000000000000000000",
      BETTER_AUTH_URL: origin,
      MAIL_MODE: "file",
    }),
    async (mail) => {
      mails.push(mail);
    },
  );
});
afterAll(async () => {
  await state.client.close();
});
it("verifies email, protects admin fields, resets passwords once and revokes sessions", async () => {
  let response = await request("sign-up/email", {
    name: "Customer",
    email,
    password,
    isAdmin: true,
    callbackURL: "/sign-in",
  });
  expect(response.status).toBe(200);
  const [u] = await state.db.select().from(user).where(eq(user.email, email));
  expect(u.isAdmin).toBe(false);
  expect(u.emailVerified).toBe(false);
  const [a] = await state.db
    .select()
    .from(account)
    .where(eq(account.userId, u.id));
  expect(a.password).not.toBe(password);
  expect(a.password?.length).toBeGreaterThan(30);
  expect((await request("sign-in/email", { email, password })).status).toBe(
    403,
  );
  const link = mails[0].text.match(/http[^\s]+/)![0];
  response = await secureAuthHandler(auth, new Request(link));
  expect(response.status).toBeLessThan(400);
  response = await request("sign-in/email", { email, password });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  expect(cookie).toContain("session_token");
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  expect(session?.user.id).toBe(u.id);
  expect(
    (
      await request("request-password-reset", {
        email,
        redirectTo: "/reset-password",
      })
    ).status,
  ).toBe(200);
  const resetLink = mails
    .findLast((m) => m.subject === "Reset your password")!
    .text.match(/http[^\s]+/)![0];
  const resetResponse = await secureAuthHandler(auth, new Request(resetLink));
  const location = resetResponse.headers.get("location")!;
  const token = new URL(location, origin).searchParams.get("token")!;
  expect(token).toBeTruthy();
  expect(
    (
      await request("reset-password", {
        token,
        newPassword: "Different-Password-42!",
      })
    ).status,
  ).toBe(200);
  expect(
    await auth.api.getSession({ headers: new Headers({ cookie }) }),
  ).toBeNull();
  expect(
    (
      await request("reset-password", {
        token,
        newPassword: "Another-Password-42!",
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  expect(
    (await request("sign-in/email", { email, password })).status,
  ).toBeGreaterThanOrEqual(400);
  expect(
    (
      await request("sign-in/email", {
        email,
        password: "Different-Password-42!",
      })
    ).status,
  ).toBe(200);
});
it("allows sign-out from the actual development origin when Next changes port", async () => {
  const alternateOrigin = "http://localhost:3001";
  const signIn = await secureAuthHandler(
    auth,
    new Request(alternateOrigin + "/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: alternateOrigin,
        "x-real-ip": "192.0.2.13",
      },
      body: JSON.stringify({
        email,
        password: "Different-Password-42!",
      }),
    }),
  );
  expect(signIn.status).toBe(200);
  const cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  expect(cookie).toContain("session_token");
  const signOut = await secureAuthHandler(
    auth,
    new Request(alternateOrigin + "/api/auth/sign-out", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: alternateOrigin,
        cookie,
        "x-real-ip": "192.0.2.13",
      },
      body: JSON.stringify({}),
    }),
  );
  expect(signOut.status).toBe(200);
});
it("rejects cross-origin auth and enforces rate limits", async () => {
  const response = await secureAuthHandler(
    auth,
    new Request(origin + "/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://evil.example",
        "x-real-ip": "192.0.2.11",
      },
      body: JSON.stringify({ email, password }),
    }),
  );
  expect(response.status).toBe(403);
  let last: Response | undefined;
  for (let i = 0; i < 7; i++)
    last = await request(
      "sign-in/email",
      { email: "unknown@example.test", password },
      "192.0.2.12",
    );
  expect(last?.status).toBe(429);
});
