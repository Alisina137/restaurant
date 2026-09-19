import "server-only";
import { createDatabase } from "@/db";
import { readEnvironment } from "./env";
import { createAuth } from "./auth-factory";
import { mailer } from "./mail";
function makeRuntime() {
  const env = readEnvironment();
  const { db } = createDatabase(env.DATABASE_URL);
  return { db, auth: createAuth(db, env, mailer(env)) };
}
const globalRuntime = globalThis as typeof globalThis & {
  restaurantRuntime?: ReturnType<typeof makeRuntime>;
};
export function runtime() {
  return (globalRuntime.restaurantRuntime ??= makeRuntime());
}
