import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  uuid,
  index,
  uniqueIndex,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
});
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: created(),
    updatedAt: updated(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("account_user_idx").on(t.userId),
    uniqueIndex("account_provider_idx").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
export const approval = pgEnum("approval_status", [
  "draft",
  "pending_review",
  "changes_requested",
  "approved",
  "suspended",
]);
export const memberRole = pgEnum("member_role", ["owner", "staff"]);
export const contributorPreset = pgEnum("contributor_preset", [
  "manager",
  "kitchen",
  "content_editor",
  "custom",
]);
export const kitchenState = pgEnum("kitchen_state", ["open", "busy", "paused"]);
export type OpeningDay = {
  day: number;
  closed: boolean;
  opens: string;
  closes: string;
};
export const restaurant = pgTable(
  "restaurant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    city: text("city").notNull(),
    area: text("area").notNull().default(""),
    address: text("address").notNull().default(""),
    phone: text("phone").notNull().default(""),
    cuisine: text("cuisine").notNull().default("Afghan"),
    deliveryAvailable: boolean("delivery_available").notNull().default(false),
    pickupAvailable: boolean("pickup_available").notNull().default(false),
    acceptingOrders: boolean("accepting_orders").notNull().default(false),
    kitchenState: kitchenState("kitchen_state").notNull().default("paused"),
    deliveryOrdersEnabled: boolean("delivery_orders_enabled")
      .notNull()
      .default(true),
    pickupOrdersEnabled: boolean("pickup_orders_enabled")
      .notNull()
      .default(true),
    prepTimeMin: integer("prep_time_min").notNull().default(20),
    prepTimeMax: integer("prep_time_max").notNull().default(40),
    availabilityNote: text("availability_note").notNull().default(""),
    availabilityUpdatedAt: timestamp("availability_updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    status: approval("status").notNull().default("draft"),
    reviewNote: text("review_note").notNull().default(""),
    hours: jsonb("hours").$type<OpeningDay[]>().notNull().default([]),
    version: integer("version").notNull().default(1),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("restaurant_status_city_idx").on(t.status, t.city)],
);
export const restaurantRevision = pgTable(
  "restaurant_revision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    city: text("city").notNull(),
    area: text("area").notNull(),
    address: text("address").notNull(),
    phone: text("phone").notNull(),
    cuisine: text("cuisine").notNull(),
    deliveryAvailable: boolean("delivery_available").notNull(),
    pickupAvailable: boolean("pickup_available").notNull(),
    hours: jsonb("hours").$type<OpeningDay[]>().notNull(),
    status: approval("status").notNull().default("draft"),
    reviewNote: text("review_note").notNull().default(""),
    version: integer("version").notNull().default(1),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("restaurant_revision_restaurant_idx").on(t.restaurantId),
    uniqueIndex("restaurant_revision_slug_idx").on(t.slug),
    index("restaurant_revision_status_idx").on(t.status, t.updatedAt),
  ],
);
export const membership = pgTable(
  "membership",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    permissionPreset: contributorPreset("permission_preset"),
    canManageOrders: boolean("can_manage_orders").notNull().default(false),
    canManageMenu: boolean("can_manage_menu").notNull().default(false),
    canEditMenuContent: boolean("can_edit_menu_content")
      .notNull()
      .default(false),
    canManagePosts: boolean("can_manage_posts").notNull().default(false),
    canManageDelivery: boolean("can_manage_delivery").notNull().default(false),
    canManageAvailability: boolean("can_manage_availability")
      .notNull()
      .default(false),
    canViewDeliveryAddresses: boolean("can_view_delivery_addresses")
      .notNull()
      .default(false),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("membership_user_restaurant_idx").on(t.userId, t.restaurantId),
  ],
);
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").unique(),
    pendingStorageKey: text("pending_storage_key"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("media_restaurant_kind_idx").on(t.restaurantId, t.kind)],
);
export const audit = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id),
    action: text("action").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: created(),
  },
  (t) => [index("audit_restaurant_time_idx").on(t.restaurantId, t.createdAt)],
);

export const postStatus = pgEnum("post_status", [
  "draft",
  "published",
  "archived",
  "removed",
]);
export const reportReason = pgEnum("report_reason", [
  "spam",
  "misleading",
  "inappropriate",
  "other",
]);
export const reportStatus = pgEnum("report_status", [
  "open",
  "resolved",
  "dismissed",
]);
export const post = pgTable(
  "post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    caption: text("caption").notNull(),
    status: postStatus("status").notNull().default("draft"),
    linkedMealId: uuid("linked_meal_id"),
    version: integer("version").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("post_restaurant_status_idx").on(
      t.restaurantId,
      t.status,
      t.publishedAt,
    ),
    index("post_feed_idx").on(t.status, t.publishedAt, t.id),
  ],
);
export const postMedia = pgTable(
  "post_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    position: integer("position").notNull().default(0),
    createdAt: created(),
  },
  (t) => [uniqueIndex("post_media_position_idx").on(t.postId, t.position)],
);
export const follow = pgTable(
  "follow",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("follow_user_restaurant_idx").on(t.userId, t.restaurantId),
  ],
);
export const postLike = pgTable(
  "post_like",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    createdAt: created(),
  },
  (t) => [uniqueIndex("post_like_user_post_idx").on(t.userId, t.postId)],
);
export const savedPost = pgTable(
  "saved_post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    createdAt: created(),
  },
  (t) => [uniqueIndex("saved_post_user_post_idx").on(t.userId, t.postId)],
);
export const favoriteRestaurant = pgTable(
  "favorite_restaurant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("favorite_restaurant_user_idx").on(t.userId, t.restaurantId),
  ],
);
export const report = pgTable(
  "report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    reason: reportReason("reason").notNull(),
    detail: text("detail").notNull().default(""),
    status: reportStatus("status").notNull().default("open"),
    resolutionNote: text("resolution_note").notNull().default(""),
    resolvedBy: text("resolved_by").references(() => user.id),
    createdAt: created(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("report_actor_post_idx").on(t.actorId, t.postId),
    index("report_status_created_idx").on(t.status, t.createdAt),
  ],
);

export const fulfillmentType = pgEnum("fulfillment_type", [
  "delivery",
  "pickup",
]);
export const orderStatus = pgEnum("order_status", [
  "awaiting_acceptance",
  "accepted",
  "preparing",
  "out_for_delivery",
  "ready_for_pickup",
  "delivered",
  "collected",
  "rejected",
  "cancelled",
]);
export const paymentStatus = pgEnum("payment_status", [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const menuCategory = pgTable(
  "menu_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("menu_category_restaurant_name_idx").on(t.restaurantId, t.name),
    index("menu_category_restaurant_sort_idx").on(
      t.restaurantId,
      t.active,
      t.sortOrder,
    ),
  ],
);

export const meal = pgTable(
  "meal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => menuCategory.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceMinor: integer("price_minor").notNull(),
    imageKey: text("image_key").unique(),
    available: boolean("available").notNull().default(true),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("meal_restaurant_name_idx").on(t.restaurantId, t.name),
    index("meal_restaurant_category_idx").on(
      t.restaurantId,
      t.categoryId,
      t.available,
      t.sortOrder,
    ),
  ],
);

export const freshOffer = pgTable(
  "fresh_offer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meal.id, { onDelete: "cascade" }),
    specialPriceMinor: integer("special_price_minor"),
    stockTotal: integer("stock_total").notNull(),
    stockRemaining: integer("stock_remaining").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    active: boolean("active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("fresh_offer_post_idx").on(t.postId),
    index("fresh_offer_live_idx").on(t.active, t.startsAt, t.endsAt),
    index("fresh_offer_restaurant_idx").on(t.restaurantId, t.updatedAt),
  ],
);

export const savedMeal = pgTable(
  "saved_meal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meal.id, { onDelete: "cascade" }),
    createdAt: created(),
  },
  (t) => [uniqueIndex("saved_meal_user_idx").on(t.userId, t.mealId)],
);

export const customerAddress = pgTable(
  "customer_address",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    recipient: text("recipient").notNull(),
    phone: text("phone").notNull(),
    city: text("city").notNull(),
    area: text("area").notNull(),
    address: text("address").notNull(),
    instructions: text("instructions").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("customer_address_user_idx").on(t.userId, t.createdAt)],
);

export const mealVariant = pgTable(
  "meal_variant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meal.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceMinor: integer("price_minor").notNull(),
    available: boolean("available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: created(),
  },
  (t) => [uniqueIndex("meal_variant_meal_name_idx").on(t.mealId, t.name)],
);

export const extraGroup = pgTable(
  "extra_group",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meal.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: created(),
  },
  (t) => [uniqueIndex("extra_group_meal_name_idx").on(t.mealId, t.name)],
);

export const extraOption = pgTable(
  "extra_option",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => extraGroup.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceMinor: integer("price_minor").notNull().default(0),
    available: boolean("available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: created(),
  },
  (t) => [uniqueIndex("extra_option_group_name_idx").on(t.groupId, t.name)],
);

export const deliveryZone = pgTable(
  "delivery_zone",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    feeMinor: integer("fee_minor").notNull(),
    minimumMinor: integer("minimum_minor").notNull().default(0),
    etaMin: integer("eta_min").notNull(),
    etaMax: integer("eta_max").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("delivery_zone_restaurant_name_idx").on(t.restaurantId, t.name),
    index("delivery_zone_restaurant_active_idx").on(t.restaurantId, t.active),
  ],
);

export type QuoteExtraSnapshot = {
  id: string;
  name: string;
  priceMinor: number;
};
export type QuoteItemSnapshot = {
  mealId: string;
  name: string;
  variantId: string | null;
  variantName: string | null;
  unitPriceMinor: number;
  extras: QuoteExtraSnapshot[];
  quantity: number;
  lineTotalMinor: number;
  offerId?: string | null;
  regularUnitPriceMinor?: number | null;
};
export type AddressSnapshot = {
  recipient: string;
  phone: string;
  city: string;
  area: string;
  address: string;
  instructions: string;
};

export const quote = pgTable(
  "order_quote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    fulfillment: fulfillmentType("fulfillment").notNull(),
    deliveryZoneId: uuid("delivery_zone_id").references(() => deliveryZone.id),
    items: jsonb("items").$type<QuoteItemSnapshot[]>().notNull(),
    address: jsonb("address").$type<AddressSnapshot>(),
    subtotalMinor: integer("subtotal_minor").notNull(),
    deliveryFeeMinor: integer("delivery_fee_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    currency: text("currency").notNull().default("AFN"),
    note: text("note").notNull().default(""),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    index("order_quote_customer_expiry_idx").on(t.customerId, t.expiresAt),
  ],
);

export const order = pgTable(
  "customer_order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quote.id),
    idempotencyKey: text("idempotency_key").notNull(),
    fulfillment: fulfillmentType("fulfillment").notNull(),
    deliveryZoneId: uuid("delivery_zone_id").references(() => deliveryZone.id),
    status: orderStatus("status").notNull().default("awaiting_acceptance"),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    items: jsonb("items").$type<QuoteItemSnapshot[]>().notNull(),
    address: jsonb("address").$type<AddressSnapshot>(),
    subtotalMinor: integer("subtotal_minor").notNull(),
    deliveryFeeMinor: integer("delivery_fee_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    currency: text("currency").notNull().default("AFN"),
    customerNote: text("customer_note").notNull().default(""),
    restaurantNote: text("restaurant_note").notNull().default(""),
    inventoryRestoredAt: timestamp("inventory_restored_at", {
      withTimezone: true,
    }),
    version: integer("version").notNull().default(1),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("customer_order_idempotency_idx").on(
      t.customerId,
      t.idempotencyKey,
    ),
    index("customer_order_customer_time_idx").on(t.customerId, t.createdAt),
    index("customer_order_restaurant_status_idx").on(
      t.restaurantId,
      t.status,
      t.createdAt,
    ),
  ],
);

export const orderEvent = pgTable(
  "order_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    previousStatus: orderStatus("previous_status"),
    nextStatus: orderStatus("next_status").notNull(),
    note: text("note").notNull().default(""),
    createdAt: created(),
  },
  (t) => [index("order_event_order_time_idx").on(t.orderId, t.createdAt)],
);
