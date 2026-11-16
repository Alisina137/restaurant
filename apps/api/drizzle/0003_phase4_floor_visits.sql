-- P04: additive sections/tables and collision-safe seating visits.
CREATE TABLE "dining_sections" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "location_id" text NOT NULL REFERENCES "locations"("id"),
  "name" text NOT NULL CHECK (char_length(trim("name")) BETWEEN 2 AND 40),
  "sort_order" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "version" integer NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "dining_sections_location_idx" ON "dining_sections"("tenant_id","location_id","sort_order");
CREATE UNIQUE INDEX "dining_section_label_active_unique" ON "dining_sections"("location_id", lower("name"))
 WHERE "archived_at" IS NULL;
CREATE TABLE "dining_tables" (
 "id" text PRIMARY KEY,
 "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "section_id" text NOT NULL REFERENCES "dining_sections"("id"),
 "label" text NOT NULL CHECK (char_length(trim("label")) BETWEEN 1 AND 12),
 "seats" integer NOT NULL DEFAULT 4 CHECK ("seats" BETWEEN 1 AND 30),
 "sort_order" integer NOT NULL DEFAULT 0,
 "notes" text NOT NULL DEFAULT '',
 "active" boolean NOT NULL DEFAULT true,
 "cleaning" boolean NOT NULL DEFAULT false,
 "assigned_waiter_id" text REFERENCES "user"("id"),
 "version" integer NOT NULL DEFAULT 1 CHECK ("version" > 0),
 "archived_at" timestamptz,
 "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "dining_tables_section_idx" ON "dining_tables"("tenant_id","location_id","section_id","sort_order");
CREATE INDEX "dining_tables_waiter_idx" ON "dining_tables"("tenant_id","assigned_waiter_id");
CREATE UNIQUE INDEX "dining_table_label_active_unique" ON "dining_tables"("location_id",lower("label"))
 WHERE "archived_at" IS NULL;
CREATE TABLE "dining_visits"(
 "id" text PRIMARY KEY,
 "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "table_id" text NOT NULL REFERENCES "dining_tables"("id"),
 "waiter_id" text NOT NULL REFERENCES "user"("id"),
 "party_size" integer NOT NULL CHECK ("party_size" BETWEEN 1 AND 30),
 "status" text NOT NULL DEFAULT 'open' CHECK ("status" IN ('open','closed')),
 "opened_by" text NOT NULL REFERENCES "user"("id"),
 "closed_by" text REFERENCES "user"("id"),
 "closed_reason" text,
 "opened_at" timestamptz NOT NULL DEFAULT now(),
 "closed_at" timestamptz,
 "updated_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "dining_visit_close_consistency" CHECK (
  ("status" = 'open' AND "closed_at" IS NULL AND "closed_by" IS NULL)
  OR ("status" = 'closed' AND "closed_at" IS NOT NULL AND "closed_by" IS NOT NULL)
 )
);
CREATE UNIQUE INDEX "dining_one_open_visit_per_table" ON "dining_visits"("table_id")
 WHERE "status"='open';
CREATE INDEX "dining_visits_tenant_idx" ON "dining_visits"("tenant_id","location_id","opened_at");
CREATE INDEX "dining_visits_table_idx" ON "dining_visits"("table_id","opened_at");
CREATE TABLE "floor_revisions" (
 "location_id" text PRIMARY KEY REFERENCES "locations"("id"),
 "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "version" integer NOT NULL DEFAULT 1 CHECK ("version">0),
 "changed_at" timestamptz NOT NULL DEFAULT now()
);
