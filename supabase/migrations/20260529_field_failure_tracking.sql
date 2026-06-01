-- Track field fetch failures per tournament for alerting
CREATE TABLE IF NOT EXISTS gpp_field_fetch_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES gpp_tournaments(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'pga_tour',
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_failures_tournament ON gpp_field_fetch_failures(tournament_id);
CREATE INDEX IF NOT EXISTS idx_field_failures_created ON gpp_field_fetch_failures(created_at);

-- Add alert status column to tournaments (UI can display warnings)
ALTER TABLE gpp_tournaments
  ADD COLUMN IF NOT EXISTS field_alert_status text DEFAULT NULL
  CHECK (field_alert_status IN (NULL, 'fetch_failed', 'placeholder_detected', 'auto_lock_skipped'));

-- Add alert_cleared_at so we don't re-alert endlessly
ALTER TABLE gpp_tournaments
  ADD COLUMN IF NOT EXISTS field_alert_cleared_at timestamptz DEFAULT NULL;
