CREATE TYPE "public"."contributor_preset" AS ENUM('manager', 'kitchen', 'content_editor', 'custom');--> statement-breakpoint
CREATE TYPE "public"."kitchen_state" AS ENUM('open', 'busy', 'paused');--> statement-breakpoint
CREATE TABLE "customer_address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"recipient" text NOT NULL,
	"phone" text NOT NULL,
	"city" text NOT NULL,
	"area" text NOT NULL,
	"address" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite_restaurant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fresh_offer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"meal_id" uuid NOT NULL,
	"special_price_minor" integer,
	"stock_total" integer NOT NULL,
	"stock_remaining" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_meal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"meal_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "permission_preset" "contributor_preset";--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "can_manage_orders" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "can_manage_menu" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "can_edit_menu_content" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "can_manage_posts" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "can_manage_delivery" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "can_manage_availability" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "can_view_delivery_addresses" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "delivery_zone_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "inventory_restored_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "restaurant" ADD COLUMN "kitchen_state" "kitchen_state" DEFAULT 'paused' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant" ADD COLUMN "delivery_orders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant" ADD COLUMN "pickup_orders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant" ADD COLUMN "prep_time_min" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant" ADD COLUMN "prep_time_max" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant" ADD COLUMN "availability_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant" ADD COLUMN "availability_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_restaurant" ADD CONSTRAINT "favorite_restaurant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_restaurant" ADD CONSTRAINT "favorite_restaurant_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fresh_offer" ADD CONSTRAINT "fresh_offer_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fresh_offer" ADD CONSTRAINT "fresh_offer_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fresh_offer" ADD CONSTRAINT "fresh_offer_meal_id_meal_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_meal" ADD CONSTRAINT "saved_meal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_meal" ADD CONSTRAINT "saved_meal_meal_id_meal_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_address_user_idx" ON "customer_address" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_restaurant_user_idx" ON "favorite_restaurant" USING btree ("user_id","restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fresh_offer_post_idx" ON "fresh_offer" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "fresh_offer_live_idx" ON "fresh_offer" USING btree ("active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "fresh_offer_restaurant_idx" ON "fresh_offer" USING btree ("restaurant_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_meal_user_idx" ON "saved_meal" USING btree ("user_id","meal_id");--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_delivery_zone_id_delivery_zone_id_fk" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."delivery_zone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "membership" SET
	"permission_preset" = 'manager',
	"can_manage_orders" = true,
	"can_manage_menu" = true,
	"can_edit_menu_content" = true,
	"can_manage_posts" = true,
	"can_manage_delivery" = true,
	"can_manage_availability" = true,
	"can_view_delivery_addresses" = true
WHERE "role" = 'staff';--> statement-breakpoint
UPDATE "restaurant" SET
	"kitchen_state" = CASE WHEN "accepting_orders" THEN 'open'::"kitchen_state" ELSE 'paused'::"kitchen_state" END,
	"delivery_orders_enabled" = "delivery_available",
	"pickup_orders_enabled" = "pickup_available";--> statement-breakpoint
UPDATE "customer_order" AS "o" SET "delivery_zone_id" = "q"."delivery_zone_id"
FROM "order_quote" AS "q" WHERE "o"."quote_id" = "q"."id";--> statement-breakpoint
ALTER TABLE "restaurant" ADD CONSTRAINT "restaurant_prep_range_check" CHECK ("prep_time_min" >= 5 AND "prep_time_max" >= "prep_time_min" AND "prep_time_max" <= 360);--> statement-breakpoint
ALTER TABLE "fresh_offer" ADD CONSTRAINT "fresh_offer_stock_check" CHECK ("stock_total" > 0 AND "stock_remaining" >= 0 AND "stock_remaining" <= "stock_total");--> statement-breakpoint
ALTER TABLE "fresh_offer" ADD CONSTRAINT "fresh_offer_time_check" CHECK ("ends_at" > "starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_address_one_default_idx" ON "customer_address" USING btree ("user_id") WHERE "is_default" = true;
