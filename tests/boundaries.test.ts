import { expect, it } from "vitest";
import sharp from "sharp";
import { sameOrigin, boundedBody } from "../src/lib/http";
import { sanitizeImage } from "../src/lib/storage";
import { readEnvironment } from "../src/lib/env";
import { isOpen } from "../src/features/restaurants/hours";
it("rejects missing/foreign origins and oversized request streams", async () => {
  expect(() =>
    sameOrigin(new Request("http://localhost:3000/api", { method: "POST" })),
  ).toThrow();
  expect(() =>
    sameOrigin(
      new Request("http://127.0.0.1:3001/api", {
        method: "POST",
        headers: { origin: "http://127.0.0.1:3001" },
      }),
    ),
  ).not.toThrow();
  expect(() =>
    sameOrigin(
      new Request("http://localhost:3000/api", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    ),
  ).toThrow();
  await expect(
    boundedBody(
      new Request("http://localhost/api", { method: "POST", body: "12345" }),
      4,
    ),
  ).rejects.toMatchObject({ status: 413 });
});
it("rejects SVG payloads and re-encodes image bytes", async () => {
  await expect(
    sanitizeImage(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
    ),
  ).rejects.toMatchObject({ status: 400 });
  const png = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#123456" },
  })
    .png()
    .toBuffer();
  const out = await sanitizeImage(png);
  expect((await sharp(out).metadata()).format).toBe("webp");
});
it("does not allow local email or HTTP auth in production", () => {
  expect(() =>
    readEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://a:b@localhost/db",
      BETTER_AUTH_SECRET: "x".repeat(40),
      BETTER_AUTH_URL: "http://localhost:3000",
      MAIL_MODE: "file",
    }),
  ).toThrow();
});
it("handles overnight hours in Afghanistan time and midnight boundaries", () => {
  const hours = [{ day: 0, closed: false, opens: "22:00", closes: "02:00" }];
  expect(isOpen(hours, new Date("2026-09-20T18:00:00Z"))).toBe(true);
  expect(isOpen(hours, new Date("2026-09-20T21:00:00Z"))).toBe(true);
  expect(isOpen(hours, new Date("2026-09-20T21:30:00Z"))).toBe(false);
  expect(
    isOpen([{ ...hours[0], closed: true }], new Date("2026-09-20T18:00:00Z")),
  ).toBe(false);
});
