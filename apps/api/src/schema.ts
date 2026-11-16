import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false), image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
export const session = pgTable("session", {
  id: text("id").primaryKey(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"), userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
}, (table) => [index("session_user_idx").on(table.userId)]);
export const account = pgTable("account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"), password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("account_user_idx").on(table.userId)]);
export const verification = pgTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const tenant = pgTable("tenants", {
  id: text("id").primaryKey(), slug: text("slug").notNull().unique(), name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const tenantMembership = pgTable("tenant_memberships", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull().references(() => tenant.id),
  userId: text("user_id").notNull().references(() => user.id), role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("tenant_member_unique").on(table.tenantId, table.userId), index("tenant_member_user_idx").on(table.userId)]);
export const platformAdmin = pgTable("platform_admins", {
  userId: text("user_id").primaryKey().references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const userPreference = pgTable("user_preferences", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  locale: text("locale").notNull().default("fa-AF"),
  activeTenantId: text("active_tenant_id").references(() => tenant.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
export const auditEvent = pgTable("audit_events", {
  id: text("id").primaryKey(), userId: text("user_id").references(() => user.id),
  tenantId: text("tenant_id").references(() => tenant.id), action: text("action").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("audit_tenant_idx").on(table.tenantId, table.createdAt)]);

export const location = pgTable("locations", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull().references(() => tenant.id),
  name: text("name").notNull(), city: text("city").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("one_location_per_tenant_p02").on(table.tenantId)]);
export const restaurantSetting = pgTable("restaurant_settings", {
  tenantId: text("tenant_id").primaryKey().references(() => tenant.id),
  phone: text("phone"), address: text("address"), timezone: text("timezone").notNull().default("Asia/Kabul"),
  locale: text("locale").notNull().default("fa-AF"), currency: text("currency").notNull().default("AFN"),
  openingHours: jsonb("opening_hours").notNull().default({}),
  orderingPolicy: text("ordering_policy").notNull().default("waiter_approval"),
  receiptFooter: text("receipt_footer").notNull().default(""),
  managerCanInvite: boolean("manager_can_invite").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
export const onboardingDraft = pgTable("onboarding_drafts", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
export const onboardingClaim = pgTable("onboarding_claims", {
  userId: text("user_id").primaryKey().references(() => user.id),
  tenantId: text("tenant_id").notNull().unique().references(() => tenant.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const tenantTrial = pgTable("tenant_trials", {
  tenantId: text("tenant_id").primaryKey().references(() => tenant.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
});
export const staffInvitation = pgTable("staff_invitations", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull().references(() => tenant.id),
  email: text("email").notNull(), role: text("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(), status: text("status").notNull().default("pending"),
  deliveryStatus: text("delivery_status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  invitedBy: text("invited_by").notNull().references(() => user.id),
  acceptedBy: text("accepted_by").references(() => user.id),
  message: text("message").notNull().default(""),
  sendAttempts: integer("send_attempts").notNull().default(0)
}, (table) => [index("invitation_tenant_created_idx").on(table.tenantId, table.createdAt),
  index("invitation_email_status_idx").on(table.tenantId, table.email, table.status)]);

/** P03 — tenant and single-location scoped menu catalog. All archive operations preserve records. */
export const catalogRevision = pgTable("catalog_revisions", {
  locationId: text("location_id").primaryKey().references(() => location.id),
  tenantId: text("tenant_id").notNull().references(() => tenant.id),
  version: integer("version").notNull().default(1),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow()
});
export const menuCategory = pgTable("menu_categories", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenant.id),
  locationId: text("location_id").notNull().references(() => location.id),
  nameFa: text("name_fa").notNull(), namePs: text("name_ps").notNull().default(""),
  nameEn: text("name_en").notNull().default(""), description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0), published: boolean("published").notNull().default(false),
  version: integer("version").notNull().default(1),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [index("menu_categories_tenant_order_idx").on(t.tenantId,t.locationId,t.sortOrder)]);
export const menuImage = pgTable("menu_images", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenant.id),
  locationId: text("location_id").notNull().references(() => location.id),
  storageKey: text("storage_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  byteLength: integer("byte_length").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const menuItem = pgTable("menu_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenant.id),
  locationId: text("location_id").notNull().references(() => location.id),
  categoryId: text("category_id").notNull().references(() => menuCategory.id),
  nameFa: text("name_fa").notNull(), namePs: text("name_ps").notNull().default(""),
  nameEn: text("name_en").notNull().default(""),
  description: text("description").notNull().default(""),
  sku: text("sku"), priceMinor: integer("price_minor").notNull(),
  imageId: text("image_id").references(() => menuImage.id),
  allergens: jsonb("allergens").$type<string[]>().notNull().default([]),
  preparationMinutes: integer("preparation_minutes"),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(false),
  soldOut: boolean("sold_out").notNull().default(false), soldOutReason: text("sold_out_reason").notNull().default(""),
  version: integer("version").notNull().default(1),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [index("menu_items_tenant_cat_idx").on(t.tenantId,t.locationId,t.categoryId,t.sortOrder),
  index("menu_items_tenant_published_idx").on(t.tenantId,t.published,t.soldOut)]);
export const menuModifierGroup = pgTable("menu_modifier_groups", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenant.id),
  locationId: text("location_id").notNull().references(() => location.id),
  nameFa: text("name_fa").notNull(), namePs: text("name_ps").notNull().default(""), nameEn: text("name_en").notNull().default(""),
  selectionMode: text("selection_mode").notNull().default("single"),
  minSelections: integer("min_selections").notNull().default(0),
  maxSelections: integer("max_selections").notNull().default(1),
  version: integer("version").notNull().default(1),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [index("menu_groups_tenant_idx").on(t.tenantId,t.locationId)]);
export const menuModifierOption = pgTable("menu_modifier_options", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => menuModifierGroup.id),
  nameFa: text("name_fa").notNull(), namePs: text("name_ps").notNull().default(""), nameEn: text("name_en").notNull().default(""),
  deltaMinor: integer("delta_minor").notNull().default(0),
  active: boolean("active").notNull().default(true), sortOrder: integer("sort_order").notNull().default(0)
}, (t) => [index("menu_options_group_idx").on(t.groupId,t.sortOrder)]);
export const menuItemGroup = pgTable("menu_item_groups", {
  itemId: text("item_id").notNull().references(() => menuItem.id),
  groupId: text("group_id").notNull().references(() => menuModifierGroup.id)
}, (t) => [uniqueIndex("menu_item_group_unique").on(t.itemId,t.groupId),
  index("menu_item_group_group_idx").on(t.groupId)]);

/** P04: one physical restaurant location per tenant for the MVP. */
export const diningSection = pgTable("dining_sections", {
  id:text("id").primaryKey(),
  tenantId:text("tenant_id").notNull().references(()=>tenant.id),
  locationId:text("location_id").notNull().references(()=>location.id),
  name:text("name").notNull(),
  sortOrder:integer("sort_order").notNull().default(0),
  active:boolean("active").notNull().default(true),
  version:integer("version").notNull().default(1),
  archivedAt:timestamp("archived_at",{withTimezone:true}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("dining_sections_location_idx").on(t.tenantId,t.locationId,t.sortOrder)]);
export const diningTable = pgTable("dining_tables", {
  id:text("id").primaryKey(),
  tenantId:text("tenant_id").notNull().references(()=>tenant.id),
  locationId:text("location_id").notNull().references(()=>location.id),
  sectionId:text("section_id").notNull().references(()=>diningSection.id),
  label:text("label").notNull(),
  seats:integer("seats").notNull().default(4),
  sortOrder:integer("sort_order").notNull().default(0),
  notes:text("notes").notNull().default(""),
  active:boolean("active").notNull().default(true),
  cleaning:boolean("cleaning").notNull().default(false),
  assignedWaiterId:text("assigned_waiter_id").references(()=>user.id),
  version:integer("version").notNull().default(1),
  archivedAt:timestamp("archived_at",{withTimezone:true}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("dining_tables_section_idx").on(t.tenantId,t.locationId,t.sectionId,t.sortOrder),
  index("dining_tables_waiter_idx").on(t.tenantId,t.assignedWaiterId)]);
export const diningVisit = pgTable("dining_visits", {
  id:text("id").primaryKey(),
  tenantId:text("tenant_id").notNull().references(()=>tenant.id),
  locationId:text("location_id").notNull().references(()=>location.id),
  tableId:text("table_id").notNull().references(()=>diningTable.id),
  waiterId:text("waiter_id").notNull().references(()=>user.id),
  partySize:integer("party_size").notNull(),
  status:text("status").notNull().default("open"),
  openedBy:text("opened_by").notNull().references(()=>user.id),
  closedBy:text("closed_by").references(()=>user.id),
  closedReason:text("closed_reason"),
  openedAt:timestamp("opened_at",{withTimezone:true}).notNull().defaultNow(),
  closedAt:timestamp("closed_at",{withTimezone:true}),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("dining_visits_tenant_idx").on(t.tenantId,t.locationId,t.openedAt),
  index("dining_visits_table_idx").on(t.tableId,t.openedAt)]);
export const floorRevision=pgTable("floor_revisions",{
  locationId:text("location_id").primaryKey().references(()=>location.id),
  tenantId:text("tenant_id").notNull().references(()=>tenant.id),
  version:integer("version").notNull().default(1),
  changedAt:timestamp("changed_at",{withTimezone:true}).notNull().defaultNow()
});

/** P05: immutable accepted rounds and kitchen tickets. No billing ledger before P09. */
export const orderRound=pgTable("order_rounds",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 visitId:text("visit_id").notNull().references(()=>diningVisit.id),
 tableId:text("table_id").notNull().references(()=>diningTable.id),
 roundNumber:integer("round_number").notNull(),
 submittedBy:text("submitted_by").notNull().references(()=>user.id),
 idempotencyKey:text("idempotency_key").notNull(),requestHash:text("request_hash").notNull(),
 source:text("source").notNull().default("waiter"),status:text("status").notNull().default("accepted"),
 currency:text("currency").notNull().default("AFN"),subtotalMinor:integer("subtotal_minor").notNull(),
 taxMinor:integer("tax_minor").notNull().default(0),serviceMinor:integer("service_minor").notNull().default(0),
 totalMinor:integer("total_minor").notNull(),orderNote:text("order_note").notNull().default(""),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[
 uniqueIndex("order_round_actor_idem_idx").on(t.tenantId,t.submittedBy,t.idempotencyKey),
 uniqueIndex("order_round_visit_seq_idx").on(t.visitId,t.roundNumber),
 index("order_round_tenant_visit_idx").on(t.tenantId,t.locationId,t.visitId),
 index("order_round_tenant_recent_idx").on(t.tenantId,t.locationId,t.createdAt)
]);
export const orderLine=pgTable("order_lines",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 roundId:text("round_id").notNull().references(()=>orderRound.id),
 itemId:text("item_id").notNull().references(()=>menuItem.id),
 lineIndex:integer("line_index").notNull(),quantity:integer("quantity").notNull(),
 itemNameFa:text("item_name_fa").notNull(),itemNamePs:text("item_name_ps").notNull().default(""),
 itemNameEn:text("item_name_en").notNull().default(""),
 basePriceMinor:integer("base_price_minor").notNull(),
 addonsMinor:integer("addons_minor").notNull().default(0),
 unitPriceMinor:integer("unit_price_minor").notNull(),
 lineTotalMinor:integer("line_total_minor").notNull(),
 itemVersion:integer("item_version").notNull(),
 allergens:jsonb("allergens").$type<string[]>().notNull().default([]),
 modifierSnapshot:jsonb("modifier_snapshot").$type<Array<{groupId:string;nameFa:string;namePs:string;nameEn:string;options:Array<{id:string;nameFa:string;namePs:string;nameEn:string;deltaMinor:number}>}>>().notNull().default([]),
 note:text("note").notNull().default(""),
 kitchenStatus:text("kitchen_status").notNull().default("new"),
 readyAt:timestamp("ready_at",{withTimezone:true}),
 pickedUpAt:timestamp("picked_up_at",{withTimezone:true}),
 servedAt:timestamp("served_at",{withTimezone:true}),
 servedBy:text("served_by").references(()=>user.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("order_line_round_idx").on(t.roundId,t.lineIndex)]);
export const kitchenTicket=pgTable("kitchen_tickets",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 roundId:text("round_id").notNull().references(()=>orderRound.id).unique(),
 visitId:text("visit_id").notNull().references(()=>diningVisit.id),
 tableId:text("table_id").notNull().references(()=>diningTable.id),
 tableLabel:text("table_label").notNull(),status:text("status").notNull().default("new"),
 version:integer("version").notNull().default(1),
 startedAt:timestamp("started_at",{withTimezone:true}),
 readyAt:timestamp("ready_at",{withTimezone:true}),
 pickedUpAt:timestamp("picked_up_at",{withTimezone:true}),
 pickedUpBy:text("picked_up_by").references(()=>user.id),
 servedAt:timestamp("served_at",{withTimezone:true}),
 servedBy:text("served_by").references(()=>user.id),
 lastNotifiedAt:timestamp("last_notified_at",{withTimezone:true}),
 notifyCount:integer("notify_count").notNull().default(0),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("kitchen_ticket_queue_idx").on(t.tenantId,t.locationId,t.status,t.createdAt),
 index("kitchen_ticket_visit_idx").on(t.visitId)]);
export const orderActivity=pgTable("order_activities",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 roundId:text("round_id").notNull().references(()=>orderRound.id),
 actorId:text("actor_id").notNull().references(()=>user.id),
 action:text("action").notNull(),details:jsonb("details").$type<Record<string,unknown>>().notNull().default({}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("order_activity_round_idx").on(t.roundId,t.createdAt)]);
export const orderOutbox=pgTable("order_outbox",{
 id:text("id").primaryKey(),seq:bigint("seq",{mode:"number"}),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 roundId:text("round_id").notNull().references(()=>orderRound.id),
 eventType:text("event_type").notNull(),
 payload:jsonb("payload").$type<Record<string,unknown>>().notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 deliveredAt:timestamp("delivered_at",{withTimezone:true})
},t=>[index("order_outbox_tenant_idx").on(t.tenantId,t.locationId,t.createdAt)]);
export const orderRevision=pgTable("order_revisions",{
 locationId:text("location_id").primaryKey().references(()=>location.id),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 version:integer("version").notNull().default(1),
 changedAt:timestamp("changed_at",{withTimezone:true}).notNull().defaultNow()
});

/** P06 durable role-scoped ready alerts; no customer data or raw PII. */
export const staffNotification=pgTable("staff_notifications",{
 id:text("id").primaryKey(),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 recipientId:text("recipient_id").notNull().references(()=>user.id),
 visitId:text("visit_id").notNull().references(()=>diningVisit.id),
 roundId:text("round_id").notNull().references(()=>orderRound.id),
 ticketId:text("ticket_id").notNull().references(()=>kitchenTicket.id),
 type:text("type").notNull().default("ticket_ready"),
 readAt:timestamp("read_at",{withTimezone:true}),
 lastNotifiedAt:timestamp("last_notified_at",{withTimezone:true}).notNull().defaultNow(),
 notifyCount:integer("notify_count").notNull().default(1),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[
 uniqueIndex("staff_notification_recipient_round_type_unique").on(t.recipientId,t.roundId,t.type),
 index("staff_notification_inbox_idx").on(t.tenantId,t.locationId,t.recipientId,t.createdAt)
]);
