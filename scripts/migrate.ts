import { config } from "dotenv";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { createDatabase } from "../src/db/index";
config({ path: ".env.local" });
config();
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL in .env.local first.");
const { db, pool } = createDatabase(process.env.DATABASE_URL);
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied.");
} finally {
  await pool.end();
}
