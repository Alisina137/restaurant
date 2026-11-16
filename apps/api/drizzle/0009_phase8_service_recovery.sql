-- P08 service request, delivery revision and immutable financial correction delta.
CREATE TABLE service_requests (
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),
 location_id text NOT NULL REFERENCES locations(id),
 visit_id text NOT NULL REFERENCES dining_visits(id),
 table_id text NOT NULL REFERENCES dining_tables(id),
 guest_session_id text REFERENCES guest_visit_sessions(id),
 idempotency_key text NOT NULL,type text NOT NULL CHECK(type IN ('assistance','bill')),
 reason text NOT NULL CHECK(reason IN ('need_help','water','cutlery','other','bill')),
 note text NOT NULL DEFAULT '',split_preference text CHECK(split_preference IN ('together','split')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','acknowledged','resolved')),
 version integer NOT NULL DEFAULT 1,assigned_waiter_id text NOT NULL REFERENCES "user"(id),
 acknowledged_by text REFERENCES "user"(id),acknowledged_at timestamptz,
 resolved_by text REFERENCES "user"(id),resolved_at timestamptz,
 resolution_note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT service_request_note_length CHECK(length(note)<=200)
);
CREATE UNIQUE INDEX service_request_guest_idem ON service_requests(guest_session_id,idempotency_key);
CREATE UNIQUE INDEX service_request_outstanding_unique ON service_requests(visit_id,type,reason)
 WHERE status IN ('pending','acknowledged');
CREATE INDEX service_request_inbox ON service_requests(tenant_id,location_id,status,created_at);
CREATE INDEX service_request_visit ON service_requests(visit_id,created_at);
CREATE TABLE service_revisions(location_id text PRIMARY KEY REFERENCES locations(id),
 tenant_id text NOT NULL REFERENCES tenants(id),version integer NOT NULL DEFAULT 1,
 changed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE order_change_requests (
 id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),
 location_id text NOT NULL REFERENCES locations(id),
 visit_id text NOT NULL REFERENCES dining_visits(id),
 table_id text NOT NULL REFERENCES dining_tables(id),
 round_id text NOT NULL REFERENCES order_rounds(id),
 line_id text NOT NULL REFERENCES order_lines(id),
 ticket_id text NOT NULL REFERENCES kitchen_tickets(id),
 idempotency_key text NOT NULL,status text NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','approved','rejected')),
 version integer NOT NULL DEFAULT 1,
 requested_by text NOT NULL REFERENCES "user"(id),reason text NOT NULL,
 decided_by text REFERENCES "user"(id),decision_reason text NOT NULL DEFAULT '',
 delta_minor integer NOT NULL DEFAULT 0 CHECK(delta_minor<=0),
 decided_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT order_change_reason_length CHECK(length(reason)<=250)
);
CREATE UNIQUE INDEX order_change_idem ON order_change_requests(tenant_id,requested_by,idempotency_key);
CREATE UNIQUE INDEX order_change_one_open ON order_change_requests(line_id) WHERE status='pending';
CREATE UNIQUE INDEX order_change_one_approved ON order_change_requests(line_id) WHERE status='approved';
CREATE INDEX order_change_pending ON order_change_requests(tenant_id,location_id,status,created_at);
CREATE INDEX order_change_visit ON order_change_requests(visit_id,created_at);
