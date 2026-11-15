import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { db } from "./db";
import * as schema from "./schema";

if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
}
const origins = (process.env.TRUSTED_ORIGINS ?? "http://localhost:3000")
  .split(",").map((entry) => entry.trim()).filter(Boolean);
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:4000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [...origins, "dineflow://", ...(process.env.NODE_ENV === "production" ? [] : ["exp://", "exp://**"])],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  plugins: [expo()],
  rateLimit: { enabled: true, window: 60, max: 30 }
});
