import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@/db/schema";
import type { Database } from "@/db";
import type { Environment } from "./env";
export type Mail = { to: string; subject: string; text: string };

function trustedOrigins(env: Environment) {
  return (request?: Request) => {
    const origins = new Set([env.BETTER_AUTH_URL]);
    // Next.js may choose another port when 3000 is occupied. Trust the actual
    // same-origin development request; secureAuthHandler still rejects a
    // foreign Origin header before Better Auth receives the request.
    if (process.env.NODE_ENV !== "production" && request) {
      try {
        origins.add(new URL(request.url).origin);
      } catch {
        // Better Auth will reject malformed request URLs.
      }
    }
    return [...origins];
  };
}

export function createAuth(
  db: Database,
  env: Environment,
  send: (mail: Mail) => Promise<void>,
) {
  return betterAuth({
    appName: "Restaurant Social",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    trustedOrigins: trustedOrigins(env),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await send({
          to: user.email,
          subject: "Reset your password",
          text: `Reset your Restaurant Social password:\n${url}\nIf you did not request this, ignore this email.`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        await send({
          to: user.email,
          subject: "Verify your email",
          text: `Verify your Restaurant Social email:\n${url}`,
        });
      },
    },
    user: {
      additionalFields: {
        isAdmin: { type: "boolean", defaultValue: false, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 300, max: 3 },
        "/send-verification-email": { window: 300, max: 3 },
      },
    },
    advanced: { ipAddress: { ipAddressHeaders: [env.TRUSTED_IP_HEADER] } },
  });
}
