CREATE TYPE "public"."fulfillment_type" AS ENUM('delivery', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('awaiting_acceptance', 'accepted', 'preparing', 'out_for_delivery', 'ready_for_pickup', 'delivered', 'collected', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TABLE "delivery_zone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"fee_minor" integer NOT NULL,
	"minimum_minor" integer DEFAULT 0 NOT NULL,
	"eta_min" integer NOT NULL,
	"eta_max" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extra_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extra_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_minor" integer DEFAULT 0 NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_minor" integer NOT NULL,
	"image_key" text,
	"available" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_image_key_unique" UNIQUE("image_key")
);
--> statement-breakpoint
CREATE TABLE "meal_variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_minor" integer NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"customer_id" text NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"fulfillment" "fulfillment_type" NOT NULL,
	"status" "order_status" DEFAULT 'awaiting_acceptance' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"items" jsonb NOT NULL,
	"address" jsonb,
	"subtotal_minor" integer NOT NULL,
	"delivery_fee_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer NOT NULL,
	"currency" text DEFAULT 'AFN' NOT NULL,
	"customer_note" text DEFAULT '' NOT NULL,
	"restaurant_note" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_order_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "order_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"previous_status" "order_status",
	"next_status" "order_status" NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"fulfillment" "fulfillment_type" NOT NULL,
	"delivery_zone_id" uuid,
	"items" jsonb NOT NULL,
	"address" jsonb,
	"subtotal_minor" integer NOT NULL,
	"delivery_fee_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer NOT NULL,
	"currency" text DEFAULT 'AFN' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"city" text NOT NULL,
	"area" text NOT NULL,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"cuisine" text NOT NULL,
	"delivery_available" boolean NOT NULL,
	"pickup_available" boolean NOT NULL,
	"hours" jsonb NOT NULL,
	"status" "approval_status" DEFAULT 'draft' NOT NULL,
	"review_note" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "storage_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "pending_storage_key" text;--> statement-breakpoint
ALTER TABLE "restaurant" ADD COLUMN "accepting_orders" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_zone" ADD CONSTRAINT "delivery_zone_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_group" ADD CONSTRAINT "extra_group_meal_id_meal_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_option" ADD CONSTRAINT "extra_option_group_id_extra_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."extra_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal" ADD CONSTRAINT "meal_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal" ADD CONSTRAINT "meal_category_id_menu_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_variant" ADD CONSTRAINT "meal_variant_meal_id_meal_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_category" ADD CONSTRAINT "menu_category_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_quote_id_order_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."order_quote"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_order_id_customer_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_quote" ADD CONSTRAINT "order_quote_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_quote" ADD CONSTRAINT "order_quote_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_quote" ADD CONSTRAINT "order_quote_delivery_zone_id_delivery_zone_id_fk" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."delivery_zone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_revision" ADD CONSTRAINT "restaurant_revision_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_zone_restaurant_name_idx" ON "delivery_zone" USING btree ("restaurant_id","name");--> statement-breakpoint
CREATE INDEX "delivery_zone_restaurant_active_idx" ON "delivery_zone" USING btree ("restaurant_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "extra_group_meal_name_idx" ON "extra_group" USING btree ("meal_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "extra_option_group_name_idx" ON "extra_option" USING btree ("group_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_restaurant_name_idx" ON "meal" USING btree ("restaurant_id","name");--> statement-breakpoint
CREATE INDEX "meal_restaurant_category_idx" ON "meal" USING btree ("restaurant_id","category_id","available","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_variant_meal_name_idx" ON "meal_variant" USING btree ("meal_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_category_restaurant_name_idx" ON "menu_category" USING btree ("restaurant_id","name");--> statement-breakpoint
CREATE INDEX "menu_category_restaurant_sort_idx" ON "menu_category" USING btree ("restaurant_id","active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_order_idempotency_idx" ON "customer_order" USING btree ("customer_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "customer_order_customer_time_idx" ON "customer_order" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_order_restaurant_status_idx" ON "customer_order" USING btree ("restaurant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "order_event_order_time_idx" ON "order_event" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_quote_customer_expiry_idx" ON "order_quote" USING btree ("customer_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_revision_restaurant_idx" ON "restaurant_revision" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_revision_slug_idx" ON "restaurant_revision" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "restaurant_revision_status_idx" ON "restaurant_revision" USING btree ("status","updated_at");