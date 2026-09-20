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
    status: approval("status").notNull().default("draft"),
    reviewNote: text("review_note").notNull().default(""),
    hours: jsonb("hours").$type<OpeningDay[]>().notNull().default([]),
    version: integer("version").notNull().default(1),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("restaurant_status_city_idx").on(t.status, t.city)],
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
    createdAt: created(),
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
    storageKey: text("storage_key").notNull().unique(),
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
