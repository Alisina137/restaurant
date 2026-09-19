import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Environment } from "./env";
import type { Mail } from "./auth-factory";
export function mailer(env: Environment) {
  const transport =
    env.MAIL_MODE === "smtp"
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          requireTLS: env.SMTP_PORT !== 465,
          auth: env.SMTP_USER
            ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
            : undefined,
        })
      : null;
  return async (mail: Mail) => {
    if (transport) {
      await transport.sendMail({ from: env.MAIL_FROM, ...mail });
      return;
    }
    if (process.env.NODE_ENV === "production")
      throw new Error("Local mail is disabled in production.");
    await mkdir(".local-mail", { recursive: true, mode: 0o700 });
    await writeFile(
      `.local-mail/${Date.now()}-${randomUUID()}.json`,
      JSON.stringify(mail, null, 2),
      { mode: 0o600 },
    );
  };
}
