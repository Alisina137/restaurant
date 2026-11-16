-- P09: append-only posted tender, visit check snapshot, split allocations, cashier shifts and receipts.
CREATE SEQUENCE IF NOT EXISTS dining_check_number_seq;
CREATE TABLE finance_settings (
 tenant_id text PRIMARY KEY REFERENCES tenants(id),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 tax_rate_bps integer NOT NULL DEFAULT 0 CHECK(tax_rate_bps BETWEEN 0 AND 10000),
 tax_inclusive boolean NOT NULL DEFAULT false,
 service_rate_bps integer NOT NULL DEFAULT 0 CHECK(service_rate_bps BETWEEN 0 AND 10000),
 service_fixed_minor integer NOT NULL DEFAULT 0 CHECK(service_fixed_minor BETWEEN 0 AND 100000000),
 receipt_footer text NOT NULL DEFAULT '' CHECK(length(receipt_footer)<=250),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE dining_checks (
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),
 location_id text NOT NULL REFERENCES locations(id),
 visit_id text NOT NULL UNIQUE REFERENCES dining_visits(id),
 table_id text NOT NULL REFERENCES dining_tables(id),
 number integer NOT NULL DEFAULT nextval('dining_check_number_seq'),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','settled')),
 split_mode text NOT NULL DEFAULT 'single' CHECK(split_mode IN ('single','equal','items')),
 split_count integer NOT NULL DEFAULT 1 CHECK(split_count BETWEEN 1 AND 10),
 charge_policy jsonb NOT NULL,subtotal_minor integer NOT NULL DEFAULT 0 CHECK(subtotal_minor>=0),
 tax_minor integer NOT NULL DEFAULT 0 CHECK(tax_minor>=0),
 service_minor integer NOT NULL DEFAULT 0 CHECK(service_minor>=0),
 total_minor integer NOT NULL DEFAULT 0 CHECK(total_minor>=0),
 paid_minor integer NOT NULL DEFAULT 0 CHECK(paid_minor>=0 AND paid_minor<=total_minor),
 locked_at timestamptz, settled_at timestamptz,settled_by text REFERENCES "user"(id),
 receipt_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT check_settlement_consistency CHECK(
 (status='open' AND settled_at IS NULL AND settled_by IS NULL)
 OR (status='settled' AND settled_at IS NOT NULL AND settled_by IS NOT NULL
   AND paid_minor=total_minor AND receipt_id IS NOT NULL))
);
CREATE UNIQUE INDEX dining_check_location_number ON dining_checks(location_id,number);
CREATE INDEX dining_check_status_idx ON dining_checks(tenant_id,location_id,status,created_at);
CREATE TABLE check_shares (
 id text PRIMARY KEY,check_id text NOT NULL REFERENCES dining_checks(id),
 tenant_id text NOT NULL REFERENCES tenants(id),share_index integer NOT NULL CHECK(share_index BETWEEN 1 AND 10),
 label text NOT NULL DEFAULT '',amount_minor integer NOT NULL CHECK(amount_minor>=0),
 paid_minor integer NOT NULL DEFAULT 0 CHECK(paid_minor>=0 AND paid_minor<=amount_minor)
);
CREATE UNIQUE INDEX check_share_index_unique ON check_shares(check_id,share_index);
CREATE TABLE check_share_lines (
 id text PRIMARY KEY,share_id text NOT NULL REFERENCES check_shares(id),
 check_id text NOT NULL REFERENCES dining_checks(id),
 line_id text NOT NULL REFERENCES order_lines(id),
 quantity integer NOT NULL CHECK(quantity>0),
 line_amount_minor integer NOT NULL CHECK(line_amount_minor>=0)
);
CREATE UNIQUE INDEX check_share_line_unique ON check_share_lines(share_id,line_id);
CREATE INDEX check_share_line_check_idx ON check_share_lines(check_id);
CREATE TABLE cashier_shifts (
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),
 location_id text NOT NULL REFERENCES locations(id),cashier_id text NOT NULL REFERENCES "user"(id),
 opening_float_minor integer NOT NULL DEFAULT 0 CHECK(opening_float_minor>=0),
 closing_count_minor integer CHECK(closing_count_minor>=0),
 expected_minor integer,variance_minor integer,supervisor_id text REFERENCES "user"(id),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 opened_at timestamptz NOT NULL DEFAULT now(),closed_at timestamptz,
 CONSTRAINT shift_closed_consistency CHECK ((status='open' AND closed_at IS NULL)
 OR (status='closed' AND closed_at IS NOT NULL AND closing_count_minor IS NOT NULL))
);
CREATE UNIQUE INDEX cashier_one_open_shift_per_user ON cashier_shifts(location_id,cashier_id) WHERE status='open';
CREATE INDEX cashier_shift_history_idx ON cashier_shifts(tenant_id,location_id,opened_at);
CREATE TABLE check_payments(
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),
 location_id text NOT NULL REFERENCES locations(id),
 check_id text NOT NULL REFERENCES dining_checks(id),
 share_id text NOT NULL REFERENCES check_shares(id),
 shift_id text NOT NULL REFERENCES cashier_shifts(id),cashier_id text NOT NULL REFERENCES "user"(id),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 12 AND 100),
 request_hash text NOT NULL,
 method text NOT NULL CHECK(method IN ('cash','manual_transfer')),
 status text NOT NULL DEFAULT 'posted' CHECK(status='posted'),
 amount_minor integer NOT NULL CHECK(amount_minor>0),
 received_minor integer NOT NULL CHECK(received_minor>=amount_minor),
 change_minor integer NOT NULL DEFAULT 0 CHECK(change_minor>=0 AND change_minor=received_minor-amount_minor),
 external_reference text,note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX check_payment_idem_unique ON check_payments(check_id,idempotency_key);
CREATE INDEX check_payment_history_idx ON check_payments(tenant_id,location_id,created_at);
CREATE INDEX check_payment_shift_idx ON check_payments(shift_id,created_at);
CREATE TABLE check_activities(
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),
 location_id text NOT NULL REFERENCES locations(id),
 check_id text NOT NULL REFERENCES dining_checks(id),
 actor_id text NOT NULL REFERENCES "user"(id),
 action text NOT NULL,details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX check_activity_history_idx ON check_activities(check_id,created_at);
CREATE TABLE check_receipts(
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),
 location_id text NOT NULL REFERENCES locations(id),
 check_id text NOT NULL UNIQUE REFERENCES dining_checks(id),
 number text NOT NULL UNIQUE,snapshot jsonb NOT NULL,
 issued_by text NOT NULL REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 reprint_count integer NOT NULL DEFAULT 0 CHECK(reprint_count>=0)
);
CREATE INDEX check_receipt_history_idx ON check_receipts(tenant_id,location_id,created_at);
