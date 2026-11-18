-- Phase 30: first reported foreground kitchen display render.
-- This records a client-reported render receipt, NOT a proof of human sight or SLA compliance.
-- Existing historical tickets intentionally remain NULL.
ALTER TABLE "kitchen_tickets"
  ADD COLUMN "first_displayed_at" timestamptz;

CREATE INDEX IF NOT EXISTS "kitchen_display_observed_sample_idx"
  ON "kitchen_tickets" ("tenant_id", "location_id", "created_at")
  WHERE "first_displayed_at" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "kitchen_active_unobserved_idx"
  ON "kitchen_tickets" ("tenant_id", "location_id", "created_at")
  WHERE "first_displayed_at" IS NULL
    AND "status" IN ('new','preparing','ready','picked_up');
