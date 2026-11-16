-- Phase 14: supervised pilot evidence is append-only, never a surrogate for real device or cash testing.
CREATE TABLE pilot_gate_events (
 id BIGSERIAL PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES tenants(id),
 gate_key TEXT NOT NULL,
 result TEXT NOT NULL CHECK(result IN ('passed','failed')),
 evidence TEXT NOT NULL,
 actor_id TEXT NOT NULL REFERENCES "user"(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pilot_gate_event_tenant_order_idx ON pilot_gate_events(tenant_id,id DESC);

CREATE TABLE pilot_signoff_events (
 id BIGSERIAL PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES tenants(id),
 stage TEXT NOT NULL CHECK(stage IN ('owner','platform')),
 decision TEXT NOT NULL CHECK(decision IN ('ready','approved','hold')),
 owner_signoff_id BIGINT,
 fingerprint TEXT NOT NULL,
 note TEXT NOT NULL,
 actor_id TEXT NOT NULL REFERENCES "user"(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT pilot_signoff_stage_decision_ck CHECK ((stage='owner' AND decision='ready') OR
  (stage='platform' AND decision IN ('approved','hold')))
);
CREATE INDEX pilot_signoff_tenant_order_idx ON pilot_signoff_events(tenant_id,id DESC);
