-- Phase 29: bounded, scoped kitchen preparation sampling without full-table scans.
-- Safe additive index, no data rewrite and no historical performance invented.
CREATE INDEX IF NOT EXISTS kitchen_ticket_ready_sample_idx
 ON kitchen_tickets (tenant_id,location_id,ready_at)
 WHERE ready_at IS NOT NULL;
