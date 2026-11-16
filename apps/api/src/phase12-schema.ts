
import {boolean,index,integer,pgTable,text,timestamp,uniqueIndex} from "drizzle-orm/pg-core";
import {tenant,user} from "./schema";

/** P12 billing and support records; financial evidence is never physically deleted. */
export const saasPlan=pgTable("saas_plans",{
 id:text("id").primaryKey(),code:text("code").notNull(),name:text("name").notNull(),
 version:integer("version").notNull(),priceMinor:integer("price_minor").notNull().default(0),
 periodDays:integer("period_days").notNull().default(30),locationLimit:integer("location_limit").notNull().default(1),
 staffLimit:integer("staff_limit").notNull().default(20),tableLimit:integer("table_limit").notNull().default(100),
 active:boolean("active").notNull().default(true),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("saas_plan_version_unique").on(t.code,t.version)]);
export const saasSubscription=pgTable("saas_subscriptions",{
 tenantId:text("tenant_id").primaryKey().references(()=>tenant.id),
 planId:text("plan_id").notNull().references(()=>saasPlan.id),
 status:text("status").notNull().default("trial"),trialEndsAt:timestamp("trial_ends_at",{withTimezone:true}),
 paidUntil:timestamp("paid_until",{withTimezone:true}),graceEndsAt:timestamp("grace_ends_at",{withTimezone:true}),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
});
export const saasInvoice=pgTable("saas_invoices",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 planId:text("plan_id").notNull().references(()=>saasPlan.id),
 number:text("number").notNull().unique(),periodStart:timestamp("period_start",{withTimezone:true}).notNull(),
 periodEnd:timestamp("period_end",{withTimezone:true}).notNull(),amountMinor:integer("amount_minor").notNull(),
 status:text("status").notNull().default("draft"),dueAt:timestamp("due_at",{withTimezone:true}).notNull(),
 issuedAt:timestamp("issued_at",{withTimezone:true}),paidAt:timestamp("paid_at",{withTimezone:true}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("saas_invoice_tenant_idx").on(t.tenantId,t.createdAt)]);
export const saasPaymentClaim=pgTable("saas_payment_claims",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 invoiceId:text("invoice_id").notNull().references(()=>saasInvoice.id),reference:text("reference").notNull(),
 method:text("method").notNull(),amountMinor:integer("amount_minor").notNull(),
 proofNote:text("proof_note").notNull(),status:text("status").notNull().default("pending"),
 submittedBy:text("submitted_by").notNull().references(()=>user.id),
 reviewedBy:text("reviewed_by").references(()=>user.id),
 reviewedAt:timestamp("reviewed_at",{withTimezone:true}),reviewReason:text("review_reason"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("saas_payment_queue_idx").on(t.status,t.createdAt),
 index("saas_payment_invoice_idx").on(t.invoiceId)]);
export const saasTicket=pgTable("saas_support_tickets",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").references(()=>tenant.id),
 category:text("category").notNull(),priority:text("priority").notNull().default("normal"),
 subject:text("subject").notNull(),status:text("status").notNull().default("open"),
 openedBy:text("opened_by").notNull().references(()=>user.id),
 assignedTo:text("assigned_to").references(()=>user.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("saas_tickets_queue_idx").on(t.status,t.createdAt),
 index("saas_tickets_tenant_idx").on(t.tenantId,t.createdAt)]);
export const saasTicketMessage=pgTable("saas_ticket_messages",{
 id:text("id").primaryKey(),ticketId:text("ticket_id").notNull().references(()=>saasTicket.id),
 senderId:text("sender_id").notNull().references(()=>user.id),body:text("body").notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("saas_messages_ticket_idx").on(t.ticketId,t.createdAt)]);
export const saasSupportGrant=pgTable("saas_support_grants",{
 id:text("id").primaryKey(),tenantId:text("tenant_id").notNull().references(()=>tenant.id),
 requestedBy:text("requested_by").notNull().references(()=>user.id),
 approvedBy:text("approved_by").references(()=>user.id),
 scope:text("scope").notNull().default("metadata"),reason:text("reason").notNull(),
 status:text("status").notNull().default("pending"),
 expiresAt:timestamp("expires_at",{withTimezone:true}),
 approvedAt:timestamp("approved_at",{withTimezone:true}),
 revokedAt:timestamp("revoked_at",{withTimezone:true}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("saas_grants_tenant_idx").on(t.tenantId,t.status,t.createdAt)]);
export const saasPlatformSettings=pgTable("saas_platform_settings",{
 id:text("id").primaryKey().default("default"),trialDays:integer("trial_days").notNull().default(14),
 graceDays:integer("grace_days").notNull().default(7),supportContact:text("support_contact").notNull().default(""),
 incidentBanner:text("incident_banner").notNull().default(""),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
});
