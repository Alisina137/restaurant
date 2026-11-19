-- Phase 36: reduce heap/index scanning of the durable internal outbox.
-- The reconciliation worker selects undelivered entries ORDER BY created_at,id.
-- This partial index also helps MIN(created_at) for operator diagnostics.
-- Safe additive migration; does not mutate order, ticket, payment or audit rows.
-- A busy production table may require a supervised maintenance window.
CREATE INDEX IF NOT EXISTS "order_outbox_pending_order_idx"
 ON "order_outbox" ("created_at", "id")
 WHERE "delivered_at" IS NULL;
