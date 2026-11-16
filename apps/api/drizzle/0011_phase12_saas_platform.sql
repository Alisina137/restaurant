-- P12: immutable plan versions and auditable manual SaaS billing. No payment-provider claims.
CREATE TABLE subscription_plans (
 id text PRIMARY KEY,plan_key text NOT NULL,version integer NOT NULL CHECK(version>0),
 name text NOT NULL,price_minor integer NOT NULL CHECK(price_minor>=0),currency text NOT NULL DEFAULT 'AFN',
 period_days integer NOT NULL DEFAULT 30 CHECK(period_days BETWEEN 1 AND 365),
 max_tables integer NOT NULL CHECK(max_tables>=1),
 max_staff integer NOT NULL CHECK(max_staff>=1),
 max_locations integer NOT NULL DEFAULT 1 CHECK(max_locations=1),
 features jsonb NOT NULL DEFAULT '[]'::jsonb,
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT subscription_plan_version_unique UNIQUE(plan_key,version)
);
CREATE TABLE tenant_subscriptions(
 tenant_id text PRIMARY KEY REFERENCES tenants(id),plan_id text REFERENCES subscription_plans(id),
 status text NOT NULL DEFAULT 'trial' CHECK(status IN ('trial','active','grace','suspended')),
 trial_ends_at timestamptz,period_end timestamptz,grace_ends_at timestamptz,
 suspension_reason text,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE subscription_invoices(
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),plan_id text NOT NULL REFERENCES subscription_plans(id),
 number text NOT NULL UNIQUE,status text NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','paid','voided')),
 plan_snapshot jsonb NOT NULL,amount_minor integer NOT NULL CHECK(amount_minor>=0),
 currency text NOT NULL DEFAULT 'AFN',period_start timestamptz NOT NULL,
 period_end timestamptz NOT NULL,due_at timestamptz NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT now(),paid_at timestamptz,
 created_by text NOT NULL REFERENCES "user"(id),
 CONSTRAINT invoice_period_valid CHECK(period_end>period_start)
);
CREATE INDEX subscription_invoice_tenant_date_idx ON subscription_invoices(tenant_id,issued_at DESC);
CREATE TABLE invoice_proofs(
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),
 invoice_id text NOT NULL REFERENCES subscription_invoices(id),
 reference text NOT NULL,method text NOT NULL CHECK(method IN ('cash','bank_transfer','mobile_money')),
 amount_minor integer NOT NULL CHECK(amount_minor>0),note text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected')),
 submitted_by text NOT NULL REFERENCES "user"(id),reviewed_by text REFERENCES "user"(id),
 reviewed_at timestamptz,review_reason text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_proof_invoice_idx ON invoice_proofs(tenant_id,invoice_id,created_at DESC);
CREATE UNIQUE INDEX invoice_verified_reference_unique ON invoice_proofs(lower(reference)) WHERE status='verified';
CREATE UNIQUE INDEX invoice_one_verified_proof ON invoice_proofs(invoice_id) WHERE status='verified';
CREATE TABLE support_tickets(
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),subject text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('billing','technical','account')),
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','high')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed')),
 created_by text NOT NULL REFERENCES "user"(id),assigned_to text REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_ticket_tenant_idx ON support_tickets(tenant_id,created_at DESC);
CREATE TABLE support_messages(
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),
 ticket_id text NOT NULL REFERENCES support_tickets(id),
 actor_id text NOT NULL REFERENCES "user"(id),body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_message_ticket_idx ON support_messages(tenant_id,ticket_id,created_at);
CREATE TABLE support_grants(
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),
 scope text NOT NULL CHECK(scope IN ('billing_metadata','configuration_metadata')),
 reason text NOT NULL,created_by text NOT NULL REFERENCES "user"(id),
 expires_at timestamptz NOT NULL,revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT grant_valid_expiry CHECK(expires_at>created_at AND expires_at<=created_at+interval '1 hour')
);
CREATE INDEX support_grant_tenant_idx ON support_grants(tenant_id,expires_at DESC);
CREATE TABLE platform_settings(
 id text PRIMARY KEY,trial_days integer NOT NULL DEFAULT 14 CHECK(trial_days BETWEEN 1 AND 90),
 grace_days integer NOT NULL DEFAULT 7 CHECK(grace_days BETWEEN 0 AND 30),
 default_plan_id text REFERENCES subscription_plans(id),
 incident_banner text NOT NULL DEFAULT '',support_email text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO subscription_plans(id,plan_key,version,name,price_minor,period_days,max_tables,max_staff,max_locations,features)
VALUES ('starter-v1','starter',1,'Starter',99000,30,20,10,1,'["ordering","reports"]'::jsonb),
 ('growth-v1','growth',1,'Growth',199000,30,60,35,1,'["ordering","reports","priority_support"]'::jsonb);
INSERT INTO platform_settings(id,trial_days,grace_days,default_plan_id) VALUES ('default',14,7,'starter-v1');
INSERT INTO tenant_subscriptions(tenant_id,plan_id,status,trial_ends_at)
 SELECT tt.tenant_id,'starter-v1','trial',tt.expires_at FROM tenant_trials tt
 ON CONFLICT (tenant_id) DO NOTHING;
-- Existing demo/legacy active restaurants remain active until platform assigns a subscription.
