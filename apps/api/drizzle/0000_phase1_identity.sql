CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY, "name" text NOT NULL, "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false, "image" text,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY, "expires_at" timestamptz NOT NULL, "token" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
  "ip_address" text, "user_agent" text, "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_user_idx" ON "session"("user_id");
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY, "account_id" text NOT NULL, "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text, "refresh_token" text, "id_token" text,
  "access_token_expires_at" timestamptz, "refresh_token_expires_at" timestamptz,
  "scope" text, "password" text,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "account_user_idx" ON "account"("user_id");
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY, "identifier" text NOT NULL, "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");
CREATE TABLE IF NOT EXISTS "tenants" (
  "id" text PRIMARY KEY, "slug" text NOT NULL UNIQUE, "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active', "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "tenant_memberships" (
  "id" text PRIMARY KEY, "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "user_id" text NOT NULL REFERENCES "user"("id"),
  "role" text NOT NULL CHECK ("role" IN ('owner','manager','waiter','kitchen','cashier')),
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','disabled')),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_member_unique" ON "tenant_memberships"("tenant_id","user_id");
CREATE INDEX IF NOT EXISTS "tenant_member_user_idx" ON "tenant_memberships"("user_id");
CREATE TABLE IF NOT EXISTS "platform_admins" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id"), "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "locale" text NOT NULL DEFAULT 'fa-AF' CHECK ("locale" IN ('fa-AF','ps-AF','en')),
  "active_tenant_id" text REFERENCES "tenants"("id"),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" text PRIMARY KEY, "user_id" text REFERENCES "user"("id"),
  "tenant_id" text REFERENCES "tenants"("id"), "action" text NOT NULL,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "audit_tenant_idx" ON "audit_events"("tenant_id","created_at");
