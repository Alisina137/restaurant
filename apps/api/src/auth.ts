import "dotenv/config";
import pg from "pg";
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
const secret=process.env.BETTER_AUTH_SECRET;
if(!secret||secret.length<32)throw Error("BETTER_AUTH_SECRET must be at least 32 characters.");
if(!process.env.DATABASE_URL)throw Error("DATABASE_URL is required");
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:8});
export const auth=betterAuth({database:pool,secret,baseURL:process.env.BETTER_AUTH_URL??"http://localhost:4000",basePath:"/api/auth",trustedOrigins:[process.env.WEB_ORIGIN??"http://localhost:3000","dineflow://"],emailAndPassword:{enabled:true,minPasswordLength:12},plugins:[expo()]});
