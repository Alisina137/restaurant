import { defineConfig } from "drizzle-kit";
import "dotenv/config";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set before running migrations");
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true
});
