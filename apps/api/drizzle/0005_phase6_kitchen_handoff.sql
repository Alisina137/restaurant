-- P06 additive kitchen lifecycle, item progress, durable alert inbox and ordered event cursor.
ALTER TABLE "order_outbox" ADD COLUMN "seq" bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX "order_outbox_seq_unique" ON "order_outbox"("seq");
CREATE INDEX "order_outbox_scope_cursor_idx" ON "order_outbox"("tenant_id","location_id","seq");
ALTER TABLE "order_lines" ADD COLUMN "kitchen_status" text NOT NULL DEFAULT 'new';
ALTER TABLE "order_lines" ADD COLUMN "ready_at" timestamptz;
ALTER TABLE "order_lines" ADD COLUMN "picked_up_at" timestamptz;
ALTER TABLE "order_lines" ADD COLUMN "served_at" timestamptz;
ALTER TABLE "order_lines" ADD COLUMN "served_by" text REFERENCES "user"("id");
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_kitchen_status_valid"
 CHECK ("kitchen_status" IN ('new','preparing','ready','picked_up','served'));
CREATE INDEX "order_lines_kitchen_status_idx" ON "order_lines"("round_id","kitchen_status");
ALTER TABLE "kitchen_tickets" ADD COLUMN "picked_up_at" timestamptz;
ALTER TABLE "kitchen_tickets" ADD COLUMN "picked_up_by" text REFERENCES "user"("id");
ALTER TABLE "kitchen_tickets" ADD COLUMN "served_at" timestamptz;
ALTER TABLE "kitchen_tickets" ADD COLUMN "served_by" text REFERENCES "user"("id");
ALTER TABLE "kitchen_tickets" ADD COLUMN "last_notified_at" timestamptz;
ALTER TABLE "kitchen_tickets" ADD COLUMN "notify_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "kitchen_tickets" DROP CONSTRAINT "kitchen_ticket_status_times";
ALTER TABLE "kitchen_tickets" DROP CONSTRAINT "kitchen_tickets_status_check";
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_status_check"
 CHECK ("status" IN ('new','preparing','ready','picked_up','served'));
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_ticket_status_times" CHECK (
 ("status"='new' AND "started_at" IS NULL AND "ready_at" IS NULL AND "picked_up_at" IS NULL AND "served_at" IS NULL)
 OR ("status"='preparing' AND "started_at" IS NOT NULL AND "ready_at" IS NULL AND "picked_up_at" IS NULL AND "served_at" IS NULL)
 OR ("status"='ready' AND "started_at" IS NOT NULL AND "ready_at" IS NOT NULL AND "served_at" IS NULL)
 OR ("status"='picked_up' AND "started_at" IS NOT NULL AND "ready_at" IS NOT NULL AND "picked_up_at" IS NOT NULL AND "served_at" IS NULL)
 OR ("status"='served' AND "started_at" IS NOT NULL AND "ready_at" IS NOT NULL AND "served_at" IS NOT NULL)
);
-- Migrate old P05 tickets: line statuses match their parent status.
UPDATE "order_lines" AS l SET "kitchen_status"=t."status", "ready_at"=t."ready_at"
 FROM "kitchen_tickets" AS t
 WHERE l."round_id"=t."round_id";
CREATE TABLE "staff_notifications" (
 "id" text PRIMARY KEY,
 "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "recipient_id" text NOT NULL REFERENCES "user"("id"),
 "visit_id" text NOT NULL REFERENCES "dining_visits"("id"),
 "round_id" text NOT NULL REFERENCES "order_rounds"("id"),
 "ticket_id" text NOT NULL REFERENCES "kitchen_tickets"("id"),
 "type" text NOT NULL DEFAULT 'ticket_ready' CHECK ("type" IN ('ticket_ready')),
 "read_at" timestamptz,
 "last_notified_at" timestamptz NOT NULL DEFAULT now(),
 "notify_count" integer NOT NULL DEFAULT 1 CHECK ("notify_count">0),
 "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "staff_notification_recipient_round_type_unique"
 ON "staff_notifications"("recipient_id","round_id","type");
CREATE INDEX "staff_notification_inbox_idx"
 ON "staff_notifications"("tenant_id","location_id","recipient_id","created_at");
-- Existing P05 ready tickets were already prepared prior to P06; seed their alerts for assigned waiters.
INSERT INTO "staff_notifications"("id","tenant_id","location_id","recipient_id","visit_id","round_id","ticket_id")
 SELECT gen_random_uuid()::text,t."tenant_id",t."location_id",v."waiter_id",v."id",t."round_id",t."id"
 FROM "kitchen_tickets" t JOIN "dining_visits" v ON v."id"=t."visit_id"
 WHERE t."status"='ready'
 ON CONFLICT ("recipient_id","round_id","type") DO NOTHING;
