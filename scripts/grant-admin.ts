import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { createDatabase } from "../src/db/index";
import { user } from "../src/db/schema";
config({ path: ".env.local" });
config();
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !process.env.DATABASE_URL)
  throw new Error(
    "Usage: npm run admin:grant -- verified-email@example.com. Configure DATABASE_URL first.",
  );
const { db, pool } = createDatabase(process.env.DATABASE_URL);
try {
  const [u] = await db.select().from(user).where(eq(user.email, email));
  if (!u?.emailVerified)
    throw new Error("Register and verify this account first.");
  await db
    .update(user)
    .set({ isAdmin: true, updatedAt: new Date() })
    .where(eq(user.id, u.id));
  console.log("Administrator access granted to the verified account.");
} finally {
  await pool.end();
}
