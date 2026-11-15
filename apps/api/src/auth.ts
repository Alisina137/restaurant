import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { db } from "./db";
import * as schema from "./schema";
import { publicWebURL, sendEmail } from "./email";

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
  emailAndPassword: { enabled: true, minPasswordLength: 12, requireEmailVerification: true },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // The callback goes to the public web entry. No account is promoted without verified email.
      await sendEmail(user.email, "Verify your DineFlow email",
        "Use this one-time link to verify your email:\n" + url +
        "\n\nAfter verifying, return to " + publicWebURL("/onboarding/restaurant") + "."
      );
    }
  },
  plugins: [expo()],
  rateLimit: { enabled: true, window: 60, max: 30 }
});
