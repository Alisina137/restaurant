-- P33: accountable restaurant pilot incidents, not an automated release authorization.
-- An immutable event timeline makes every resolution and reopening independently reviewable.
CREATE TABLE pilot_incidents (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES tenants(id),
 gate_key TEXT NOT NULL CHECK (gate_key IN
 ('roles','qr','orders','cash','billing','languages','devices','accessibility',
  'reliability','backups','rollback','shift')),
 severity TEXT NOT NULL CHECK (severity IN ('p0','p1','p2')),
 title TEXT NOT NULL CHECK (char_length(title) BETWEEN 8 AND 120),
 details TEXT NOT NULL CHECK (char_length(details) BETWEEN 25 AND 1500),
 status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
 version INTEGER NOT NULL DEFAULT 1 CHECK (version>=1),
 opened_by TEXT NOT NULL REFERENCES "user"(id),
 resolved_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pilot_incidents_tenant_status_idx
 ON pilot_incidents (tenant_id,status,severity,created_at DESC,id);

CREATE TABLE pilot_incident_events (
 id BIGSERIAL PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES tenants(id),
 incident_id TEXT NOT NULL REFERENCES pilot_incidents(id),
 action TEXT NOT NULL CHECK (action IN ('opened','resolved','reopened')),
 severity TEXT NOT NULL CHECK (severity IN ('p0','p1','p2')),
 gate_key TEXT NOT NULL,
 note TEXT NOT NULL CHECK (char_length(note) BETWEEN 25 AND 1500),
 actor_id TEXT NOT NULL REFERENCES "user"(id),
 version INTEGER NOT NULL CHECK (version>=1),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pilot_incident_events_version_unique
 ON pilot_incident_events (incident_id,version);
CREATE INDEX pilot_incident_events_tenant_order_idx
 ON pilot_incident_events (tenant_id,id DESC);
