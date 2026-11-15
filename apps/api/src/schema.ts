import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
}, (table) => [index("session_user_idx").on(table.userId)]);
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("account_user_idx").on(table.userId)]);
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const tenant = pgTable("tenants", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const tenantMembership = pgTable("tenant_memberships", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenant.id),
  userId: text("user_id").notNull().references(() => user.id),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("tenant_member_unique").on(table.tenantId, table.userId), index("tenant_member_user_idx").on(table.userId)]);
export const platformAdmin = pgTable("platform_admins", {
  userId: text("user_id").primaryKey().references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const userPreference = pgTable("user_preferences", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  locale: text("locale").notNull().default("fa-AF"),
  activeTenantId: text("active_tenant_id").references(() => tenant.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
export const auditEvent = pgTable("audit_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id),
  tenantId: text("tenant_id").references(() => tenant.id),
  action: text("action").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("audit_tenant_idx").on(table.tenantId, table.createdAt)]);
