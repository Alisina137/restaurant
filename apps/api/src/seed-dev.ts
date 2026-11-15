import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db, pool } from "./db";
import { platformAdmin, tenant, tenantMembership, user, userPreference } from "./schema";
import type { StaffRole } from "@dineflow/shared";

if (process.env.NODE_ENV === "production") throw new Error("Development seed is forbidden in production");
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) throw new Error("Set DEMO_PASSWORD to at least 12 characters in your local apps/api/.env");
const demoTenantId = "dev-restaurant";
async function ensureUser(name: string, email: string) {
  const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing[0]) return existing[0].id;
  const signedUp = await auth.api.signUpEmail({ body: { name, email, password: password! } });
  if (!signedUp?.user?.id) throw new Error("Unable to create development user: " + email);
  await db.update(user).set({ emailVerified: true }).where(eq(user.id, signedUp.user.id));
  return signedUp.user.id;
}
async function main() {
  await db.insert(tenant).values({ id: demoTenantId, slug: "demo-restaurant", name: "Demo Restaurant" }).onConflictDoNothing();
  const users: { env: string; name: string; role: StaffRole | "platform_admin" }[] = [
    { env: "DEMO_OWNER_EMAIL", name: "Demo Owner", role: "owner" },
    { env: "DEMO_WAITER_EMAIL", name: "Demo Waiter", role: "waiter" },
    { env: "DEMO_KITCHEN_EMAIL", name: "Demo Kitchen", role: "kitchen" },
    { env: "DEMO_CASHIER_EMAIL", name: "Demo Cashier", role: "cashier" },
    { env: "DEMO_PLATFORM_EMAIL", name: "Demo Platform", role: "platform_admin" }
  ];
  for (const entry of users) {
    const email = process.env[entry.env];
    if (!email) continue;
    const userId = await ensureUser(entry.name, email.toLowerCase());
    await db.insert(userPreference).values({ userId }).onConflictDoNothing();
    if (entry.role === "platform_admin") {
      await db.insert(platformAdmin).values({ userId }).onConflictDoNothing();
    } else {
      await db.insert(tenantMembership).values({ id: randomUUID(), tenantId: demoTenantId, userId, role: entry.role })
        .onConflictDoNothing();
    }
    console.info("Created/verified " + entry.role + " development account: " + email);
  }
  console.info("Development seed complete. Do not use these credentials in production.");
}
main().then(async () => { await pool.end(); }).catch(async (error) => { console.error(error); await pool.end(); process.exitCode = 1; });
