-- P03: additive, non-destructive menu catalog schema.
CREATE TABLE "catalog_revisions" (
 "location_id" text PRIMARY KEY REFERENCES "locations"("id"),
 "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "version" integer NOT NULL DEFAULT 1 CHECK ("version">0),
 "changed_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "menu_categories" (
 "id" text PRIMARY KEY, "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"), "name_fa" text NOT NULL,
 "name_ps" text NOT NULL DEFAULT '', "name_en" text NOT NULL DEFAULT '',
 "description" text NOT NULL DEFAULT '', "sort_order" integer NOT NULL DEFAULT 0,
 "published" boolean NOT NULL DEFAULT false, "version" integer NOT NULL DEFAULT 1 CHECK ("version">0),
 "archived_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "menu_categories_tenant_order_idx" ON "menu_categories"("tenant_id","location_id","sort_order");
CREATE UNIQUE INDEX "menu_category_active_name_unique"
 ON "menu_categories"("location_id", lower("name_fa")) WHERE "archived_at" IS NULL;
CREATE TABLE "menu_images" (
 "id" text PRIMARY KEY, "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"), "storage_key" text NOT NULL UNIQUE,
 "content_type" text NOT NULL CHECK ("content_type" = 'image/webp'),
 "byte_length" integer NOT NULL CHECK ("byte_length">0),
 "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "menu_items" (
 "id" text PRIMARY KEY, "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "category_id" text NOT NULL REFERENCES "menu_categories"("id"),
 "name_fa" text NOT NULL, "name_ps" text NOT NULL DEFAULT '', "name_en" text NOT NULL DEFAULT '',
 "description" text NOT NULL DEFAULT '', "sku" text, "price_minor" integer NOT NULL CHECK ("price_minor">=0),
 "image_id" text REFERENCES "menu_images"("id"), "allergens" jsonb NOT NULL DEFAULT '[]'::jsonb,
 "preparation_minutes" integer CHECK ("preparation_minutes" IS NULL OR ("preparation_minutes">=1 AND "preparation_minutes"<=240)),
 "sort_order" integer NOT NULL DEFAULT 0,
 "published" boolean NOT NULL DEFAULT false, "sold_out" boolean NOT NULL DEFAULT false,
 "sold_out_reason" text NOT NULL DEFAULT '', "version" integer NOT NULL DEFAULT 1 CHECK ("version">0),
 "archived_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "menu_items_tenant_cat_idx" ON "menu_items"("tenant_id","location_id","category_id","sort_order");
CREATE INDEX "menu_items_tenant_published_idx" ON "menu_items"("tenant_id","published","sold_out");
CREATE UNIQUE INDEX "menu_item_active_sku_unique" ON "menu_items"("location_id", lower("sku"))
 WHERE "sku" IS NOT NULL AND "archived_at" IS NULL;
CREATE TABLE "menu_modifier_groups" (
 "id" text PRIMARY KEY, "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
 "location_id" text NOT NULL REFERENCES "locations"("id"),
 "name_fa" text NOT NULL, "name_ps" text NOT NULL DEFAULT '', "name_en" text NOT NULL DEFAULT '',
 "selection_mode" text NOT NULL DEFAULT 'single' CHECK ("selection_mode" IN ('single','multiple')),
 "min_selections" integer NOT NULL DEFAULT 0 CHECK ("min_selections">=0 AND "min_selections"<=10),
 "max_selections" integer NOT NULL DEFAULT 1 CHECK ("max_selections">=0 AND "max_selections"<=10),
 "version" integer NOT NULL DEFAULT 1 CHECK ("version">0),
 "archived_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now(),
 CHECK ("min_selections"<="max_selections"), CHECK ("selection_mode"!='single' OR "max_selections"<=1)
);
CREATE INDEX "menu_groups_tenant_idx" ON "menu_modifier_groups"("tenant_id","location_id");
CREATE TABLE "menu_modifier_options" (
 "id" text PRIMARY KEY, "group_id" text NOT NULL REFERENCES "menu_modifier_groups"("id"),
 "name_fa" text NOT NULL, "name_ps" text NOT NULL DEFAULT '', "name_en" text NOT NULL DEFAULT '',
 "delta_minor" integer NOT NULL DEFAULT 0 CHECK ("delta_minor">=0),
 "active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT 0
);
CREATE INDEX "menu_options_group_idx" ON "menu_modifier_options"("group_id","sort_order");
CREATE TABLE "menu_item_groups" (
 "item_id" text NOT NULL REFERENCES "menu_items"("id"),
 "group_id" text NOT NULL REFERENCES "menu_modifier_groups"("id")
);
CREATE UNIQUE INDEX "menu_item_group_unique" ON "menu_item_groups"("item_id","group_id");
CREATE INDEX "menu_item_group_group_idx" ON "menu_item_groups"("group_id");
