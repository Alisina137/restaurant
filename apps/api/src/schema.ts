import { bigint, bigserial, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
  guestPolicyVersion: integer("guest_policy_version").notNull().default(1),
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
 submittedBy:text("submitted_by").references(()=>user.id),
 guestSessionId:text("guest_session_id").references(()=>guestVisitSession.id),
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
 pickupAcknowledgedAt:timestamp("pickup_acknowledged_at",{withTimezone:true}),
 pickupAcknowledgedBy:text("pickup_acknowledged_by").references(()=>user.id),
 firstDisplayedAt:timestamp("first_displayed_at",{withTimezone:true}),
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
 actorId:text("actor_id").references(()=>user.id),
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

/** P07: printed QR is an opaque table locator, NOT a guest authorization credential. */
export const tableQr=pgTable("table_qrs",{
 tableId:text("table_id").primaryKey().references(()=>diningTable.id),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 code:text("code").notNull().unique(),
 version:integer("version").notNull().default(1),
 issuedBy:text("issued_by").notNull().references(()=>user.id),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("table_qrs_tenant_idx").on(t.tenantId,t.locationId)]);

/** HMAC-derived six digit PIN depends on visit ID + monotonic generation and never needs plaintext storage. */
export const guestVisitPin=pgTable("guest_visit_pins",{
 visitId:text("visit_id").primaryKey().references(()=>diningVisit.id),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 generation:integer("generation").notNull().default(1),
 rotatedAt:timestamp("rotated_at",{withTimezone:true}).notNull().defaultNow()
});

/** Per-visit global and per-fingerprint rate limiting; wrong codes cannot reset the window. */
export const guestPinAttempt=pgTable("guest_pin_attempts",{
 id:text("id").primaryKey(),visitId:text("visit_id").notNull().references(()=>diningVisit.id),
 fingerprint:text("fingerprint").notNull(),
 failures:integer("failures").notNull().default(0),
 windowStarted:timestamp("window_started",{withTimezone:true}).notNull().defaultNow(),
 lockedUntil:timestamp("locked_until",{withTimezone:true})
},t=>[uniqueIndex("guest_pin_attempt_visit_fingerprint").on(t.visitId,t.fingerprint)]);

/** Guest session is bound to one active visit + QR/PIN generations; bearer hash only persisted. */
export const guestVisitSession=pgTable("guest_visit_sessions",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 tableId:text("table_id").notNull().references(()=>diningTable.id),
 visitId:text("visit_id").notNull().references(()=>diningVisit.id),
 tokenHash:text("token_hash").notNull().unique(),
 pinGeneration:integer("pin_generation").notNull(),
 qrVersion:integer("qr_version").notNull(),
 expiresAt:timestamp("expires_at",{withTimezone:true}).notNull(),
 revokedAt:timestamp("revoked_at",{withTimezone:true}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("guest_session_visit_idx").on(t.visitId,t.expiresAt)]);

export type GuestCartSnapshot={itemId:string;itemVersion:number;quantity:number;note:string;
 selections:Array<{groupId:string;version:number;optionIds:string[]}>};
export type GuestPreviewLine={nameFa:string;namePs:string;nameEn:string;quantity:number;unitPriceMinor:number;
 lineTotalMinor:number;note:string;modifierSummary:string[]};
export const guestSubmission=pgTable("guest_submissions",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 visitId:text("visit_id").notNull().references(()=>diningVisit.id),
 tableId:text("table_id").notNull().references(()=>diningTable.id),
 guestSessionId:text("guest_session_id").notNull().references(()=>guestVisitSession.id),
 idempotencyKey:text("idempotency_key").notNull(),requestHash:text("request_hash").notNull(),
 status:text("status").notNull().default("pending"),version:integer("version").notNull().default(1),
 policy:text("policy").notNull().default("waiter_approval"),
 orderNote:text("order_note").notNull().default(""),
 cart:jsonb("cart").$type<GuestCartSnapshot[]>().notNull().default([]),
 preview:jsonb("preview").$type<GuestPreviewLine[]>().notNull().default([]),
 estimatedMinor:integer("estimated_minor").notNull(),
 roundId:text("round_id").references(()=>orderRound.id),
 rejectionReason:text("rejection_reason"),
 decidedBy:text("decided_by").references(()=>user.id),
 decidedAt:timestamp("decided_at",{withTimezone:true}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[
 uniqueIndex("guest_submissions_session_idem_idx").on(t.guestSessionId,t.idempotencyKey),
 index("guest_submissions_pending_idx").on(t.tenantId,t.locationId,t.status,t.createdAt),
 index("guest_submissions_visit_idx").on(t.visitId,t.createdAt)
]);

export const guestRevision=pgTable("guest_revisions",{
 locationId:text("location_id").primaryKey().references(()=>location.id),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 version:integer("version").notNull().default(1),
 changedAt:timestamp("changed_at",{withTimezone:true}).notNull().defaultNow()
});

/** P09 cashier: all currency integers are AFN minor units (1 AFN = 100). */
export const financeSetting=pgTable("finance_settings",{
 tenantId:text("tenant_id").primaryKey().references(()=>tenant.id),
 version:integer("version").notNull().default(1),
 taxRateBps:integer("tax_rate_bps").notNull().default(0),
 taxInclusive:boolean("tax_inclusive").notNull().default(false),
 serviceRateBps:integer("service_rate_bps").notNull().default(0),
 serviceFixedMinor:integer("service_fixed_minor").notNull().default(0),
 shiftVarianceLimitMinor:integer("shift_variance_limit_minor").notNull().default(5000),
 receiptFooter:text("receipt_footer").notNull().default(""),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
});
export type ChargePolicy={taxRateBps:number;taxInclusive:boolean;serviceRateBps:number;
 serviceFixedMinor:number;receiptFooter:string};
export const diningCheck=pgTable("dining_checks",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 visitId:text("visit_id").notNull().unique().references(()=>diningVisit.id),
 tableId:text("table_id").notNull().references(()=>diningTable.id),
 number:integer("number").notNull(),
 version:integer("version").notNull().default(1),
 status:text("status").notNull().default("open"),
 splitMode:text("split_mode").notNull().default("single"),
 splitCount:integer("split_count").notNull().default(1),
 chargePolicy:jsonb("charge_policy").$type<ChargePolicy>().notNull(),
 subtotalMinor:integer("subtotal_minor").notNull().default(0),
 discountMinor:integer("discount_minor").notNull().default(0),
 taxMinor:integer("tax_minor").notNull().default(0),
 serviceMinor:integer("service_minor").notNull().default(0),
 totalMinor:integer("total_minor").notNull().default(0),
 paidMinor:integer("paid_minor").notNull().default(0),
 lockedAt:timestamp("locked_at",{withTimezone:true}),
 settledAt:timestamp("settled_at",{withTimezone:true}),
 settledBy:text("settled_by").references(()=>user.id),
 receiptId:text("receipt_id"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[
 uniqueIndex("dining_check_location_number").on(t.locationId,t.number),
 index("dining_check_status_idx").on(t.tenantId,t.locationId,t.status,t.createdAt)
]);
export const checkShare=pgTable("check_shares",{
 id:text("id").primaryKey(),checkId:text("check_id").notNull().references(()=>diningCheck.id),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 shareIndex:integer("share_index").notNull(),
 label:text("label").notNull().default(""),
 amountMinor:integer("amount_minor").notNull(),
 paidMinor:integer("paid_minor").notNull().default(0)
},t=>[uniqueIndex("check_share_index_unique").on(t.checkId,t.shareIndex)]);
export const checkShareLine=pgTable("check_share_lines",{
 id:text("id").primaryKey(),shareId:text("share_id").notNull().references(()=>checkShare.id),
 checkId:text("check_id").notNull().references(()=>diningCheck.id),
 lineId:text("line_id").notNull().references(()=>orderLine.id),
 quantity:integer("quantity").notNull(),
 lineAmountMinor:integer("line_amount_minor").notNull()
},t=>[uniqueIndex("check_share_line_unique").on(t.shareId,t.lineId),
 index("check_share_line_check_idx").on(t.checkId)]);
export const cashierShift=pgTable("cashier_shifts",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 cashierId:text("cashier_id").notNull().references(()=>user.id),
 openingFloatMinor:integer("opening_float_minor").notNull().default(0),
 closingCountMinor:integer("closing_count_minor"),
 expectedMinor:integer("expected_minor"),
 varianceMinor:integer("variance_minor"),
 supervisorId:text("supervisor_id").references(()=>user.id),
 status:text("status").notNull().default("open"),
 openedAt:timestamp("opened_at",{withTimezone:true}).notNull().defaultNow(),
 closedAt:timestamp("closed_at",{withTimezone:true})
},t=>[index("cashier_shift_history_idx").on(t.tenantId,t.locationId,t.openedAt)]);
export const checkPayment=pgTable("check_payments",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 checkId:text("check_id").notNull().references(()=>diningCheck.id),
 shareId:text("share_id").notNull().references(()=>checkShare.id),
 shiftId:text("shift_id").notNull().references(()=>cashierShift.id),
 cashierId:text("cashier_id").notNull().references(()=>user.id),
 idempotencyKey:text("idempotency_key").notNull(),
 requestHash:text("request_hash").notNull(),
 method:text("method").notNull(),status:text("status").notNull().default("posted"),
 amountMinor:integer("amount_minor").notNull(),
 receivedMinor:integer("received_minor").notNull(),changeMinor:integer("change_minor").notNull().default(0),
 externalReference:text("external_reference"),
 note:text("note").notNull().default(""),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[
 uniqueIndex("check_payment_idem_unique").on(t.checkId,t.idempotencyKey),
 index("check_payment_history_idx").on(t.tenantId,t.locationId,t.createdAt),
 index("check_payment_shift_idx").on(t.shiftId,t.createdAt)
]);
export const checkActivity=pgTable("check_activities",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 checkId:text("check_id").notNull().references(()=>diningCheck.id),
 actorId:text("actor_id").notNull().references(()=>user.id),
 action:text("action").notNull(),details:jsonb("details").notNull().default({}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("check_activity_history_idx").on(t.checkId,t.createdAt)]);
export type ReceiptSnapshot={receiptNumber:string;checkNumber:number;restaurant:string;
 tableLabel:string;issuedAt:string;currency:string;subtotalMinor:number;discountMinor?:number;taxMinor:number;
 serviceMinor:number;totalMinor:number;paidMinor:number;footer:string;
 lines:Array<{nameFa:string;namePs:string;nameEn:string;quantity:number;unitPriceMinor:number;
 lineTotalMinor:number}>;payments:Array<{method:string;amountMinor:number;receivedMinor:number;
 changeMinor:number;createdAt:string;externalReference:string|null}>};
export const checkReceipt=pgTable("check_receipts",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 checkId:text("check_id").notNull().unique().references(()=>diningCheck.id),
 number:text("number").notNull().unique(),
 snapshot:jsonb("snapshot").$type<ReceiptSnapshot>().notNull(),
 issuedBy:text("issued_by").notNull().references(()=>user.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 reprintCount:integer("reprint_count").notNull().default(0)
},t=>[index("check_receipt_history_idx").on(t.tenantId,t.locationId,t.createdAt)]);

/** P08 visit-scoped service calls, bill requests and staff resolution timeline. */
export const serviceRequest=pgTable("service_requests",{
 id:text("id").primaryKey(),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 visitId:text("visit_id").notNull().references(()=>diningVisit.id),
 tableId:text("table_id").notNull().references(()=>diningTable.id),
 guestSessionId:text("guest_session_id").references(()=>guestVisitSession.id),
 createdBy:text("created_by").references(()=>user.id),
 type:text("type").notNull(),
 note:text("note").notNull().default(""),
 billPreference:text("bill_preference").notNull().default("together"),
 status:text("status").notNull().default("pending"),
 version:integer("version").notNull().default(1),
 acknowledgedBy:text("acknowledged_by").references(()=>user.id),
 acknowledgedAt:timestamp("acknowledged_at",{withTimezone:true}),
 resolvedBy:text("resolved_by").references(()=>user.id),
 resolvedAt:timestamp("resolved_at",{withTimezone:true}),
 resolutionNote:text("resolution_note").notNull().default(""),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[
 index("service_requests_inbox_idx").on(t.tenantId,t.locationId,t.status,t.createdAt),
 index("service_requests_visit_idx").on(t.visitId,t.createdAt)
]);

/** P10 reviewed requests, separate refunds, immutable paid tender and receipt snapshots. */
export const financeAdjustment=pgTable("finance_adjustments",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 checkId:text("check_id").notNull().references(()=>diningCheck.id),
 kind:text("kind").notNull(),targetRoundId:text("target_round_id").references(()=>orderRound.id),
 amountMinor:integer("amount_minor").notNull(),reason:text("reason").notNull(),
 requestKey:text("request_key").notNull(),requestHash:text("request_hash").notNull(),
 status:text("status").notNull().default("pending"),
 requestedBy:text("requested_by").notNull().references(()=>user.id),
 approvedBy:text("approved_by").references(()=>user.id),
 decidedAt:timestamp("decided_at",{withTimezone:true}),
 decisionNote:text("decision_note").notNull().default(""),
 appliedBy:text("applied_by").references(()=>user.id),
 appliedAt:timestamp("applied_at",{withTimezone:true}),
 checkVersion:integer("check_version").notNull(),version:integer("version").notNull().default(1),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[
 uniqueIndex("finance_adjustments_idempotency").on(t.checkId,t.requestKey),
 index("finance_adjustments_queue").on(t.tenantId,t.locationId,t.status,t.createdAt),
 index("finance_adjustments_check").on(t.checkId,t.createdAt)
]);
export const financeRefund=pgTable("finance_refunds",{
 id:text("id").primaryKey(),adjustmentId:text("adjustment_id").notNull().unique().references(()=>financeAdjustment.id),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 locationId:text("location_id").notNull().references(()=>location.id),
 checkId:text("check_id").notNull().references(()=>diningCheck.id),
 shiftId:text("shift_id").notNull().references(()=>cashierShift.id),
 cashierId:text("cashier_id").notNull().references(()=>user.id),
 method:text("method").notNull(),amountMinor:integer("amount_minor").notNull(),
 externalReference:text("external_reference"),note:text("note").notNull().default(""),
 postedAt:timestamp("posted_at",{withTimezone:true}).notNull().defaultNow()
},t=>[
 index("finance_refunds_check_idx").on(t.checkId,t.postedAt),
 index("finance_refunds_shift_idx").on(t.shiftId,t.postedAt)
]);

/** P12 — versioned SaaS plans, manual billing and bounded support. Operational ledgers remain tenant-private. */
export const subscriptionPlan=pgTable("subscription_plans",{
 id:text("id").primaryKey(),planKey:text("plan_key").notNull(),version:integer("version").notNull(),
 name:text("name").notNull(),priceMinor:integer("price_minor").notNull(),
 currency:text("currency").notNull().default("AFN"),periodDays:integer("period_days").notNull().default(30),
 maxTables:integer("max_tables").notNull(),maxStaff:integer("max_staff").notNull(),
 maxLocations:integer("max_locations").notNull().default(1),
 features:jsonb("features").$type<string[]>().notNull().default([]),
 active:boolean("active").notNull().default(true),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("subscription_plan_version_unique").on(t.planKey,t.version)]);
export const tenantSubscription=pgTable("tenant_subscriptions",{
 tenantId:text("tenant_id").primaryKey().references(()=>tenant.id),
 planId:text("plan_id").references(()=>subscriptionPlan.id),
 status:text("status").notNull().default("trial"),
 trialEndsAt:timestamp("trial_ends_at",{withTimezone:true}),
 periodEnd:timestamp("period_end",{withTimezone:true}),
 graceEndsAt:timestamp("grace_ends_at",{withTimezone:true}),
 suspensionReason:text("suspension_reason"),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
});
export const subscriptionInvoice=pgTable("subscription_invoices",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 planId:text("plan_id").notNull().references(()=>subscriptionPlan.id),
 number:text("number").notNull().unique(),status:text("status").notNull().default("issued"),
 planSnapshot:jsonb("plan_snapshot").$type<{name:string;planKey:string;version:number;periodDays:number;priceMinor:number;maxTables:number;maxStaff:number;maxLocations:number}>().notNull(),
 amountMinor:integer("amount_minor").notNull(),currency:text("currency").notNull().default("AFN"),
 periodStart:timestamp("period_start",{withTimezone:true}).notNull(),
 periodEnd:timestamp("period_end",{withTimezone:true}).notNull(),
 dueAt:timestamp("due_at",{withTimezone:true}).notNull(),
 issuedAt:timestamp("issued_at",{withTimezone:true}).notNull().defaultNow(),
 paidAt:timestamp("paid_at",{withTimezone:true}),
 createdBy:text("created_by").notNull().references(()=>user.id)
},t=>[index("subscription_invoice_tenant_date_idx").on(t.tenantId,t.issuedAt)]);
export const invoiceProof=pgTable("invoice_proofs",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 invoiceId:text("invoice_id").notNull().references(()=>subscriptionInvoice.id),
 reference:text("reference").notNull(),method:text("method").notNull(),
 amountMinor:integer("amount_minor").notNull(),note:text("note").notNull().default(""),
 status:text("status").notNull().default("pending"),
 submittedBy:text("submitted_by").notNull().references(()=>user.id),
 reviewedBy:text("reviewed_by").references(()=>user.id),
 reviewedAt:timestamp("reviewed_at",{withTimezone:true}),reviewReason:text("review_reason"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("invoice_proof_invoice_idx").on(t.tenantId,t.invoiceId,t.createdAt)]);
export const supportTicket=pgTable("support_tickets",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 subject:text("subject").notNull(),kind:text("kind").notNull(),priority:text("priority").notNull().default("normal"),
 status:text("status").notNull().default("open"),createdBy:text("created_by").notNull().references(()=>user.id),
 assignedTo:text("assigned_to").references(()=>user.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("support_ticket_tenant_idx").on(t.tenantId,t.createdAt)]);
export const supportMessage=pgTable("support_messages",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 ticketId:text("ticket_id").notNull().references(()=>supportTicket.id),
 actorId:text("actor_id").notNull().references(()=>user.id),body:text("body").notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("support_message_ticket_idx").on(t.tenantId,t.ticketId,t.createdAt)]);
export const supportGrant=pgTable("support_grants",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 scope:text("scope").notNull(),reason:text("reason").notNull(),
 createdBy:text("created_by").notNull().references(()=>user.id),
 expiresAt:timestamp("expires_at",{withTimezone:true}).notNull(),
 revokedAt:timestamp("revoked_at",{withTimezone:true}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("support_grant_tenant_idx").on(t.tenantId,t.expiresAt)]);
export const platformSetting=pgTable("platform_settings",{
 id:text("id").primaryKey(),trialDays:integer("trial_days").notNull().default(14),
 graceDays:integer("grace_days").notNull().default(7),
 defaultPlanId:text("default_plan_id").references(()=>subscriptionPlan.id),
 incidentBanner:text("incident_banner").notNull().default(""),
 supportEmail:text("support_email").notNull().default(""),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
});

/** P14 append-only gate evidence; checked-by-actor reports, not a production deployment toggle. */
export const pilotGateEvent=pgTable("pilot_gate_events",{
 id:bigserial("id",{mode:"number"}).primaryKey(),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 gateKey:text("gate_key").notNull(),result:text("result").notNull(),
 evidence:text("evidence").notNull(),actorId:text("actor_id").notNull().references(()=>user.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("pilot_gate_event_tenant_order_idx").on(t.tenantId,t.id)]);
export const pilotSignoffEvent=pgTable("pilot_signoff_events",{
 id:bigserial("id",{mode:"number"}).primaryKey(),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 stage:text("stage").notNull(),decision:text("decision").notNull(),
 ownerSignoffId:bigint("owner_signoff_id",{mode:"number"}),
 fingerprint:text("fingerprint").notNull(),
 note:text("note").notNull(),actorId:text("actor_id").notNull().references(()=>user.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("pilot_signoff_tenant_order_idx").on(t.tenantId,t.id)]);

/** P33 observed pilot incident register: business state plus immutable event trail. */
export const pilotIncident=pgTable("pilot_incidents",{
 id:text("id").primaryKey(),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 gateKey:text("gate_key").notNull(),severity:text("severity").notNull(),
 title:text("title").notNull(),details:text("details").notNull(),
 status:text("status").notNull().default("open"),
 version:integer("version").notNull().default(1),
 openedBy:text("opened_by").notNull().references(()=>user.id),
 resolvedAt:timestamp("resolved_at",{withTimezone:true}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("pilot_incidents_tenant_status_idx").on(t.tenantId,t.status,t.severity,t.createdAt,t.id)]);
export const pilotIncidentEvent=pgTable("pilot_incident_events",{
 id:bigserial("id",{mode:"number"}).primaryKey(),
 tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 incidentId:text("incident_id").notNull().references(()=>pilotIncident.id),
 action:text("action").notNull(),
 severity:text("severity").notNull(),
 gateKey:text("gate_key").notNull(),
 note:text("note").notNull(),
 actorId:text("actor_id").notNull().references(()=>user.id),
 version:integer("version").notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[
 uniqueIndex("pilot_incident_events_version_unique").on(t.incidentId,t.version),
 index("pilot_incident_events_tenant_order_idx").on(t.tenantId,t.id)
]);
