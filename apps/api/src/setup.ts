import "dotenv/config";import {pool} from "./auth.js";
await pool.query(`CREATE TABLE IF NOT EXISTS restaurants(id text PRIMARY KEY,name text NOT NULL,slug text UNIQUE NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS memberships(user_id text NOT NULL,restaurant_id text NOT NULL REFERENCES restaurants(id),role text NOT NULL CHECK(role IN('OWNER','MANAGER','WAITER','KITCHEN','CASHIER')),status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','DISABLED')),PRIMARY KEY(user_id,restaurant_id));
CREATE TABLE IF NOT EXISTS platform_admins(user_id text PRIMARY KEY,granted_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_events(id text PRIMARY KEY,actor_id text,action text NOT NULL,restaurant_id text,occurred_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_memberships_restaurant ON memberships(restaurant_id,status);`);
console.log("Phase-01 tables ready");await pool.end();
