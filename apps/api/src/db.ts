import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
export const pool = new pg.Pool({
 connectionString,max:10,connectionTimeoutMillis:15_000,keepAlive:true
});
/**
 * node-postgres emits 'error' on the Pool (not on the Express request)
 * when an *idle* connection is closed by Neon, PgBouncer or the network.
 * Without a listener Node treats EventEmitter 'error' as an uncaught
 * exception and kills the entire API. pg removes that broken idle client,
 * and the pool may open a fresh connection for the next request.
 */
pool.on("error",(error:Error & {code?:string})=>{
 const raw=typeof error.code==="string"?error.code:"UNKNOWN";
 const code=/^[A-Z0-9]{2,18}$/.test(raw)?raw:"UNKNOWN";
 // Never log connection strings, SQL or request bodies here.
 console.error(JSON.stringify({kind:"postgres_idle_connection_error",code,
  action:"connection discarded; next request may reconnect"}));
});
export const db = drizzle(pool, { schema });
