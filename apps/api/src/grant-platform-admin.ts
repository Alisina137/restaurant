import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { auditEvent, platformAdmin, user } from "./schema";

async function main() {
  const candidate = process.argv[2]?.trim().toLowerCase();
  if (process.env.ALLOW_PLATFORM_BOOTSTRAP !== "true" ||
      !candidate || candidate !== process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase()) {
    throw new Error("Bootstrap blocked: set ALLOW_PLATFORM_BOOTSTRAP=true and exact PLATFORM_ADMIN_BOOTSTRAP_EMAIL, then pass that email.");
  }
  const [person] = await db.select({ id: user.id, verified: user.emailVerified })
    .from(user).where(eq(user.email, candidate)).limit(1);
  if (!person || !person.verified) throw new Error("User must exist and have a verified email address.");
  await db.transaction(async tx => {
    await tx.insert(platformAdmin).values({ userId: person.id }).onConflictDoNothing();
    await tx.insert(auditEvent).values({ id: randomUUID(), userId: person.id, action: "platform.admin_bootstrap",
      details: { method: "explicit_cli_bootstrap" } });
  });
  console.info("Platform administrator access granted to verified existing user: " + candidate);
}
main().then(async()=>{await pool.end();}).catch(async error=>{console.error(error);await pool.end();process.exitCode=1;});
