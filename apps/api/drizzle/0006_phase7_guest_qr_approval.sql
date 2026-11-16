-- P07: one opaque QR locator per table; no authorization from QR without visit PIN.
CREATE TABLE "table_qrs" (
 "table_id" text PRIMARY KEY REFERENCES "dining_tables"("id"),
 "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "code" text NOT NULL UNIQUE CHECK (length("code") BETWEEN 24 AND 128),
 "version" integer NOT NULL DEFAULT 1 CHECK ("version">0),
 "issued_by" text NOT NULL REFERENCES "user"("id"),
 "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "table_qrs_tenant_idx" ON "table_qrs"("tenant_id","location_id");
CREATE TABLE "guest_visit_pins" (
 "visit_id" text PRIMARY KEY REFERENCES "dining_visits"("id"),
 "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "generation" integer NOT NULL DEFAULT 1 CHECK ("generation">0),
 "rotated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "guest_pin_attempts" (
 "id" text PRIMARY KEY,
 "visit_id" text NOT NULL REFERENCES "dining_visits"("id"),
 "fingerprint" text NOT NULL,
 "failures" integer NOT NULL DEFAULT 0 CHECK ("failures">=0),
 "window_started" timestamptz NOT NULL DEFAULT now(),
 "locked_until" timestamptz
);
CREATE UNIQUE INDEX "guest_pin_attempt_visit_fingerprint"
 ON "guest_pin_attempts"("visit_id","fingerprint");
CREATE TABLE "guest_visit_sessions" (
 "id" text PRIMARY KEY, "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "table_id" text NOT NULL REFERENCES "dining_tables"("id"),
 "visit_id" text NOT NULL REFERENCES "dining_visits"("id"),
 "token_hash" text NOT NULL UNIQUE,
 "pin_generation" integer NOT NULL CHECK ("pin_generation">0),
 "qr_version" integer NOT NULL CHECK ("qr_version">0),
 "expires_at" timestamptz NOT NULL, "revoked_at" timestamptz,
 "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "guest_session_visit_idx" ON "guest_visit_sessions"("visit_id","expires_at");
CREATE TABLE "guest_submissions" (
 "id" text PRIMARY KEY,
 "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "visit_id" text NOT NULL REFERENCES "dining_visits"("id"),
 "table_id" text NOT NULL REFERENCES "dining_tables"("id"),
 "guest_session_id" text NOT NULL REFERENCES "guest_visit_sessions"("id"),
 "idempotency_key" text NOT NULL CHECK (length("idempotency_key") BETWEEN 12 AND 100),
 "request_hash" text NOT NULL,
 "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','approved','rejected')),
 "version" integer NOT NULL DEFAULT 1 CHECK ("version">0),
 "policy" text NOT NULL CHECK ("policy" IN ('waiter_approval','direct_to_kitchen')),
 "order_note" text NOT NULL DEFAULT '',
 "cart" jsonb NOT NULL DEFAULT '[]'::jsonb,
 "preview" jsonb NOT NULL DEFAULT '[]'::jsonb,
 "estimated_minor" integer NOT NULL CHECK ("estimated_minor">=0),
 "round_id" text REFERENCES "order_rounds"("id"),
 "rejection_reason" text, "decided_by" text REFERENCES "user"("id"),
 "decided_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "guest_submission_decision_consistency" CHECK (
 ("status"='pending' AND "round_id" IS NULL AND "decided_at" IS NULL)
 OR ("status"='approved' AND "round_id" IS NOT NULL AND "decided_at" IS NOT NULL)
 OR ("status"='rejected' AND "round_id" IS NULL AND "decided_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "guest_submissions_session_idem_idx" ON "guest_submissions"("guest_session_id","idempotency_key");
CREATE INDEX "guest_submissions_pending_idx" ON "guest_submissions"("tenant_id","location_id","status","created_at");
CREATE INDEX "guest_submissions_visit_idx" ON "guest_submissions"("visit_id","created_at");
CREATE TABLE "guest_revisions" (
 "location_id" text PRIMARY KEY REFERENCES "locations"("id"),
 "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "version" integer NOT NULL DEFAULT 1,
 "changed_at" timestamptz NOT NULL DEFAULT now()
);
-- Allow genuine account-free orders while keeping who/what created them auditable by guest session.
ALTER TABLE "order_rounds" ALTER COLUMN "submitted_by" DROP NOT NULL;
ALTER TABLE "order_rounds" ADD COLUMN "guest_session_id" text REFERENCES "guest_visit_sessions"("id");
ALTER TABLE "order_rounds" DROP CONSTRAINT "order_rounds_source_check";
ALTER TABLE "order_rounds" ADD CONSTRAINT "order_rounds_source_check" CHECK ("source" IN ('waiter','guest_qr'));
ALTER TABLE "order_activities" ALTER COLUMN "actor_id" DROP NOT NULL;
