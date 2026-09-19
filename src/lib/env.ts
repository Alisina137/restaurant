import { z } from "zod";
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((s) => s.startsWith("postgres"), "Use a PostgreSQL connection URL"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  MAIL_MODE: z.enum(["file", "smtp"]).default("file"),
  MAIL_FROM: z
    .string()
    .min(3)
    .default("Restaurant Social <noreply@example.com>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  TRUSTED_IP_HEADER: z.string().default("x-real-ip"),
});
export type Environment = z.infer<typeof envSchema>;
export function readEnvironment(
  input: Record<string, string | undefined> = process.env,
): Environment {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      "Configure DATABASE_URL, BETTER_AUTH_SECRET and BETTER_AUTH_URL in .env.local.",
    );
  const env = parsed.data;
  if (
    input.NODE_ENV === "production" &&
    (env.MAIL_MODE !== "smtp" || !env.BETTER_AUTH_URL.startsWith("https://"))
  )
    throw new Error("Production requires SMTP delivery and an HTTPS auth URL.");
  if (env.MAIL_MODE === "smtp" && !env.SMTP_HOST)
    throw new Error("Configure SMTP_HOST for email delivery.");
  return env;
}
export function configured() {
  try {
    readEnvironment();
    return true;
  } catch {
    return false;
  }
}
