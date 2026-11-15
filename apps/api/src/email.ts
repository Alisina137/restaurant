import "dotenv/config";
export class MailDeliveryError extends Error {
  constructor(message: string) { super(message); }
}
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (key && from) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text: body }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new MailDeliveryError("Email provider did not accept the message");
    return;
  }
  if (process.env.NODE_ENV !== "production" && process.env.DEV_EMAIL_DELIVERY === "console") {
    console.warn("[DEVELOPMENT EMAIL ONLY] To " + to + "\nSubject: " + subject + "\n" + body);
    return;
  }
  throw new MailDeliveryError("Email provider is not configured. Set RESEND_API_KEY and MAIL_FROM.");
}
export function publicWebURL(path: string): string {
  const base = process.env.PUBLIC_WEB_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}
