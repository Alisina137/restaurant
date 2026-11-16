-- P10 additive financial corrections, independent reimbursement ledger and audited review.
ALTER TABLE dining_checks ADD COLUMN discount_minor integer NOT NULL DEFAULT 0 CHECK(discount_minor BETWEEN 0 AND subtotal_minor);
CREATE TABLE finance_adjustments (
 id text PRIMARY KEY,
 tenant_id text NOT NULL REFERENCES tenants(id), location_id text NOT NULL REFERENCES locations(id),
 check_id text NOT NULL REFERENCES dining_checks(id),
 kind text NOT NULL CHECK(kind IN ('discount','void','refund')),
 target_round_id text REFERENCES order_rounds(id),
 amount_minor integer NOT NULL CHECK(amount_minor BETWEEN 1 AND 2000000000),
 reason text NOT NULL CHECK(length(reason) BETWEEN 8 AND 500),
 request_key text NOT NULL CHECK(length(request_key) BETWEEN 12 AND 100),
 request_hash text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','applied')),
 requested_by text NOT NULL REFERENCES "user"(id),
 approved_by text REFERENCES "user"(id), decided_at timestamptz, decision_note text NOT NULL DEFAULT '',
 applied_by text REFERENCES "user"(id), applied_at timestamptz,
 check_version integer NOT NULL,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT finance_review_states CHECK(
 (status='pending' AND decided_at IS NULL AND approved_by IS NULL AND applied_at IS NULL)
 OR (status='rejected' AND decided_at IS NOT NULL AND approved_by IS NOT NULL AND applied_at IS NULL)
 OR (status='approved' AND decided_at IS NOT NULL AND approved_by IS NOT NULL AND applied_at IS NULL)
 OR (status='applied' AND decided_at IS NOT NULL AND approved_by IS NOT NULL AND applied_at IS NOT NULL AND applied_by IS NOT NULL))
);
CREATE UNIQUE INDEX finance_adjustments_idempotency ON finance_adjustments(check_id,request_key);
CREATE INDEX finance_adjustments_queue ON finance_adjustments(tenant_id,location_id,status,created_at DESC);
CREATE INDEX finance_adjustments_check ON finance_adjustments(check_id,created_at DESC);
CREATE TABLE finance_refunds (
 id text PRIMARY KEY,adjustment_id text NOT NULL UNIQUE REFERENCES finance_adjustments(id),
 tenant_id text NOT NULL REFERENCES tenants(id),location_id text NOT NULL REFERENCES locations(id),
 check_id text NOT NULL REFERENCES dining_checks(id),shift_id text NOT NULL REFERENCES cashier_shifts(id),
 cashier_id text NOT NULL REFERENCES "user"(id),
 method text NOT NULL CHECK(method IN ('cash','manual_transfer')),
 amount_minor integer NOT NULL CHECK(amount_minor>0),
 external_reference text,note text NOT NULL DEFAULT '',
 posted_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT transfer_reference_required CHECK(method<>'manual_transfer' OR
   (external_reference IS NOT NULL AND length(external_reference)>0))
);
CREATE INDEX finance_refunds_check_idx ON finance_refunds(check_id,posted_at);
CREATE INDEX finance_refunds_shift_idx ON finance_refunds(shift_id,posted_at);
