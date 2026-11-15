CREATE TABLE IF NOT EXISTS "locations" (
  "id" text PRIMARY KEY, "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "name" text NOT NULL, "city" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "one_location_per_tenant_p02" ON "locations"("tenant_id");
CREATE TABLE IF NOT EXISTS "restaurant_settings" (
  "tenant_id" text PRIMARY KEY REFERENCES "tenants"("id"), "phone" text,
  "address" text, "timezone" text NOT NULL DEFAULT 'Asia/Kabul',
  "locale" text NOT NULL DEFAULT 'fa-AF' CHECK ("locale" IN ('fa-AF','ps-AF','en')),
  "currency" text NOT NULL DEFAULT 'AFN', "opening_hours" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ordering_policy" text NOT NULL DEFAULT 'waiter_approval' CHECK ("ordering_policy" IN ('waiter_approval','direct_to_kitchen')),
  "receipt_footer" text NOT NULL DEFAULT '', "manager_can_invite" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "onboarding_drafts" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb, "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "onboarding_claims" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id"),
  "tenant_id" text NOT NULL UNIQUE REFERENCES "tenants"("id"), "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "tenant_trials" (
  "tenant_id" text PRIMARY KEY REFERENCES "tenants"("id"),
  "started_at" timestamptz NOT NULL DEFAULT now(), "expires_at" timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS "staff_invitations" (
  "id" text PRIMARY KEY, "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "email" text NOT NULL, "role" text NOT NULL CHECK ("role" IN ('manager','waiter','kitchen','cashier','owner')),
  "token_hash" text NOT NULL UNIQUE, "status" text NOT NULL DEFAULT 'pending'
    CHECK ("status" IN ('pending','accepted','revoked')),
  "delivery_status" text NOT NULL DEFAULT 'pending'
    CHECK ("delivery_status" IN ('pending','sent','failed')),
  "expires_at" timestamptz NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_sent_at" timestamptz, "accepted_at" timestamptz,
  "invited_by" text NOT NULL REFERENCES "user"("id"),
  "accepted_by" text REFERENCES "user"("id"), "message" text NOT NULL DEFAULT '',
  "send_attempts" integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "invitation_tenant_created_idx" ON "staff_invitations"("tenant_id","created_at");
CREATE INDEX IF NOT EXISTS "invitation_email_status_idx" ON "staff_invitations"("tenant_id","email","status");
