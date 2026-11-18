-- P28: explicit waiter receipt is distinct from kitchen handoff and final table service.
-- Historical handoffs are left unacknowledged; do not manufacture past receipt evidence.
ALTER TABLE "kitchen_tickets"
 ADD COLUMN "pickup_acknowledged_at" timestamptz,
 ADD COLUMN "pickup_acknowledged_by" text REFERENCES "user"("id");
CREATE INDEX "kitchen_ticket_pickup_ack_idx"
 ON "kitchen_tickets" ("tenant_id","location_id","status","pickup_acknowledged_at")
 WHERE "status"='picked_up';
