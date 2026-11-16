-- P08: service and bill assistance requests. Status transitions remain auditable.
CREATE TABLE IF NOT EXISTS service_requests (
 id text PRIMARY KEY,
 tenant_id text NOT NULL REFERENCES tenants(id),
 location_id text NOT NULL REFERENCES locations(id),
 visit_id text NOT NULL REFERENCES dining_visits(id),
 table_id text NOT NULL REFERENCES dining_tables(id),
 guest_session_id text REFERENCES guest_visit_sessions(id),
 created_by text REFERENCES "user"(id),
 type text NOT NULL CHECK (type IN ('call_waiter','water','cutlery','bill','other')),
 note text NOT NULL DEFAULT '',
 bill_preference text NOT NULL DEFAULT 'together' CHECK (bill_preference IN ('together','split')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','resolved','cancelled')),
 version integer NOT NULL DEFAULT 1,
 acknowledged_by text REFERENCES "user"(id),
 acknowledged_at timestamptz,
 resolved_by text REFERENCES "user"(id),
 resolved_at timestamptz,
 resolution_note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_requests_inbox_idx ON service_requests(tenant_id, location_id, status, created_at);
CREATE INDEX IF NOT EXISTS service_requests_visit_idx ON service_requests(visit_id, created_at);
-- Any one visit may have at most one unresolved request of a kind.
CREATE UNIQUE INDEX IF NOT EXISTS service_requests_active_kind_idx
 ON service_requests(visit_id, type) WHERE status IN ('pending','acknowledged');
