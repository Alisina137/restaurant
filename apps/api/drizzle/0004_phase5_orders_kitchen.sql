-- P05 transactional immutable orders, snapshot lines and one ticket per round.
CREATE TABLE "order_rounds"(
 "id" text PRIMARY KEY, "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "visit_id" text NOT NULL REFERENCES "dining_visits"("id"),
 "table_id" text NOT NULL REFERENCES "dining_tables"("id"),
 "round_number" integer NOT NULL CHECK ("round_number">=1),
 "submitted_by" text NOT NULL REFERENCES "user"("id"),
 "idempotency_key" text NOT NULL CHECK (char_length("idempotency_key") BETWEEN 12 AND 100),
 "request_hash" text NOT NULL, "source" text NOT NULL DEFAULT 'waiter' CHECK ("source"='waiter'),
 "status" text NOT NULL DEFAULT 'accepted' CHECK ("status"='accepted'),
 "currency" text NOT NULL DEFAULT 'AFN' CHECK ("currency"='AFN'),
 "subtotal_minor" integer NOT NULL CHECK ("subtotal_minor">=0),
 "tax_minor" integer NOT NULL DEFAULT 0 CHECK ("tax_minor">=0),
 "service_minor" integer NOT NULL DEFAULT 0 CHECK ("service_minor">=0),
 "total_minor" integer NOT NULL CHECK ("total_minor">=0),
 "order_note" text NOT NULL DEFAULT '',"created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "order_round_actor_idem_idx" ON "order_rounds"("tenant_id","submitted_by","idempotency_key");
CREATE UNIQUE INDEX "order_round_visit_seq_idx" ON "order_rounds"("visit_id","round_number");
CREATE INDEX "order_round_tenant_visit_idx" ON "order_rounds"("tenant_id","location_id","visit_id");
CREATE INDEX "order_round_tenant_recent_idx" ON "order_rounds"("tenant_id","location_id","created_at");
CREATE TABLE "order_lines"(
 "id" text PRIMARY KEY,"tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "round_id" text NOT NULL REFERENCES "order_rounds"("id"),
 "item_id" text NOT NULL REFERENCES "menu_items"("id"),
 "line_index" integer NOT NULL CHECK ("line_index">=0),
 "quantity" integer NOT NULL CHECK ("quantity" BETWEEN 1 AND 99),
 "item_name_fa" text NOT NULL,"item_name_ps" text NOT NULL DEFAULT '',
 "item_name_en" text NOT NULL DEFAULT '',
 "base_price_minor" integer NOT NULL CHECK ("base_price_minor">=0),
 "addons_minor" integer NOT NULL CHECK ("addons_minor">=0),
 "unit_price_minor" integer NOT NULL CHECK ("unit_price_minor">=0),
 "line_total_minor" integer NOT NULL CHECK ("line_total_minor">=0),
 "item_version" integer NOT NULL CHECK ("item_version">0),
 "allergens" jsonb NOT NULL DEFAULT '[]'::jsonb,
 "modifier_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
 "note" text NOT NULL DEFAULT '',"created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "order_line_round_position_idx" ON "order_lines"("round_id","line_index");
CREATE INDEX "order_line_round_idx" ON "order_lines"("round_id","line_index");
CREATE TABLE "kitchen_tickets"(
 "id" text PRIMARY KEY,"tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "round_id" text NOT NULL UNIQUE REFERENCES "order_rounds"("id"),
 "visit_id" text NOT NULL REFERENCES "dining_visits"("id"),
 "table_id" text NOT NULL REFERENCES "dining_tables"("id"),
 "table_label" text NOT NULL,
 "status" text NOT NULL DEFAULT 'new' CHECK ("status" IN ('new','preparing','ready')),
 "version" integer NOT NULL DEFAULT 1 CHECK ("version">0),
 "started_at" timestamptz,"ready_at" timestamptz,
 "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "kitchen_ticket_status_times" CHECK (
   ("status"='new' AND "started_at" IS NULL AND "ready_at" IS NULL) OR
   ("status"='preparing' AND "started_at" IS NOT NULL AND "ready_at" IS NULL) OR
   ("status"='ready' AND "started_at" IS NOT NULL AND "ready_at" IS NOT NULL)
 )
);
CREATE INDEX "kitchen_ticket_queue_idx" ON "kitchen_tickets"("tenant_id","location_id","status","created_at");
CREATE INDEX "kitchen_ticket_visit_idx" ON "kitchen_tickets"("visit_id");
CREATE TABLE "order_activities"(
 "id" text PRIMARY KEY,"tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "round_id" text NOT NULL REFERENCES "order_rounds"("id"),
 "actor_id" text NOT NULL REFERENCES "user"("id"),
 "action" text NOT NULL,"details" jsonb NOT NULL DEFAULT '{}'::jsonb,
 "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "order_activity_round_idx" ON "order_activities"("round_id","created_at");
CREATE TABLE "order_outbox"(
 "id" text PRIMARY KEY,"tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "round_id" text NOT NULL REFERENCES "order_rounds"("id"),
 "event_type" text NOT NULL,"payload" jsonb NOT NULL,
 "created_at" timestamptz NOT NULL DEFAULT now(),"delivered_at" timestamptz
);
CREATE INDEX "order_outbox_tenant_idx" ON "order_outbox"("tenant_id","location_id","created_at");
CREATE TABLE "order_revisions"(
 "location_id" text PRIMARY KEY REFERENCES "locations"("id"),
 "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "version" integer NOT NULL DEFAULT 1 CHECK ("version">0),
 "changed_at" timestamptz NOT NULL DEFAULT now()
);
