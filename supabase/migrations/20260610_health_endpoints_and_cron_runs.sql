-- Health endpoints and cron-run history for external monitors.

CREATE TABLE IF NOT EXISTS gpp_cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success', 'failure')),
  response jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gpp_cron_runs_route_finished
  ON gpp_cron_runs(route, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_gpp_cron_runs_status_finished
  ON gpp_cron_runs(status, finished_at DESC);

CREATE OR REPLACE FUNCTION gpp_latest_cron_run(route_filter text, status_filter text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'route', route,
        'started_at', started_at,
        'finished_at', finished_at,
        'duration_ms', duration_ms,
        'status', status,
        'error', error
      )
      FROM gpp_cron_runs
      WHERE route = route_filter
        AND status = status_filter
      ORDER BY finished_at DESC
      LIMIT 1
    ),
    'null'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION gpp_live_scoring_health(stale_after_minutes integer DEFAULT 10)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH active_tournaments AS (
    SELECT
      id,
      name,
      external_id,
      status,
      last_scores_fetch,
      jsonb_array_length(COALESCE(leaderboard_json, '[]'::jsonb)) AS leaderboard_player_count
    FROM gpp_tournaments
    WHERE status = 'live'
    ORDER BY start_date ASC
  ),
  live_pools AS (
    SELECT count(*)::integer AS count
    FROM gpp_pools p
    JOIN gpp_tournaments t ON t.id = p.tournament_id
    WHERE t.status = 'live'
      AND p.is_completed = false
  ),
  latest_sync AS (
    SELECT max(last_scores_fetch) AS last_score_sync
    FROM active_tournaments
  )
  SELECT jsonb_build_object(
    'active_tournaments', COALESCE((SELECT jsonb_agg(to_jsonb(active_tournaments)) FROM active_tournaments), '[]'::jsonb),
    'last_score_sync', (SELECT last_score_sync FROM latest_sync),
    'last_successful_run', gpp_latest_cron_run('/api/cron/sync-tournaments?live=1', 'success'),
    'last_failed_run', gpp_latest_cron_run('/api/cron/sync-tournaments?live=1', 'failure'),
    'leaderboard_player_count', COALESCE((SELECT sum(leaderboard_player_count)::integer FROM active_tournaments), 0),
    'live_pools_count', (SELECT count FROM live_pools),
    'stale_after_minutes', stale_after_minutes,
    'stale', COALESCE((SELECT last_score_sync < now() - make_interval(mins => stale_after_minutes) FROM latest_sync), true)
  );
$$;

CREATE OR REPLACE FUNCTION gpp_field_health(stale_after_minutes integer DEFAULT 1440)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH upcoming AS (
    SELECT
      id,
      name,
      external_id,
      start_date,
      field_source,
      last_field_fetch,
      field_fingerprint,
      jsonb_array_length(COALESCE(field_json, '[]'::jsonb)) AS field_count,
      CASE
        WHEN jsonb_array_length(COALESCE(field_json, '[]'::jsonb)) = 0 THEN 'empty'
        WHEN jsonb_array_length(COALESCE(field_json, '[]'::jsonb)) < 40 THEN 'too_small'
        WHEN field_fingerprint IS NOT NULL AND count(*) OVER (PARTITION BY field_fingerprint) > 1 THEN 'duplicate_fingerprint'
        WHEN (
          SELECT count(*)
          FROM jsonb_array_elements(COALESCE(field_json, '[]'::jsonb)) WITH ORDINALITY AS player(value, ordinality)
          WHERE value->>'name' IN ('Kevin Kisner', 'Zac Blair', 'Christiaan Bezuidenhout', 'Nick Hardy')
            AND ordinality <= 8
        ) >= 3 THEN 'known_stale_signature'
        WHEN last_field_fetch IS NULL THEN 'never_fetched'
        WHEN last_field_fetch < now() - make_interval(mins => stale_after_minutes) THEN 'stale_field_fetch'
        ELSE NULL
      END AS suspicious_reason
    FROM gpp_tournaments
    WHERE status = 'upcoming'
    ORDER BY start_date ASC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'upcoming_tournaments', COALESCE((SELECT jsonb_agg(to_jsonb(upcoming)) FROM upcoming), '[]'::jsonb),
    'suspicious_placeholder_fingerprints', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tournament_id', id,
        'name', name,
        'field_fingerprint', field_fingerprint,
        'reason', suspicious_reason,
        'field_count', field_count,
        'last_field_fetch', last_field_fetch
      ))
      FROM upcoming
      WHERE suspicious_reason IS NOT NULL
    ), '[]'::jsonb),
    'last_successful_run', gpp_latest_cron_run('/api/cron/refresh-fields', 'success'),
    'last_failed_run', gpp_latest_cron_run('/api/cron/refresh-fields', 'failure')
  );
$$;

CREATE OR REPLACE FUNCTION gpp_group_lock_due_at(start_date date)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT ((start_date - (((extract(dow FROM start_date)::integer - 2 + 7) % 7))::integer)::timestamp + interval '8 hours') AT TIME ZONE 'America/New_York';
$$;

CREATE OR REPLACE FUNCTION gpp_lock_health(stale_after_minutes integer DEFAULT 10)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH pools_due_to_lock AS (
    SELECT
      p.id,
      p.name,
      p.game_format,
      p.lock_at,
      t.id AS tournament_id,
      t.name AS tournament_name,
      t.status AS tournament_status,
      t.start_date
    FROM gpp_pools p
    JOIN gpp_tournaments t ON t.id = p.tournament_id
    WHERE p.is_completed = false
      AND p.is_locked = false
      AND p.lock_at IS NOT NULL
      AND p.lock_at <= now()
    ORDER BY p.lock_at ASC
    LIMIT 50
  ),
  unfinalized_grouped AS (
    SELECT
      p.id,
      p.name,
      p.game_format,
      t.id AS tournament_id,
      t.name AS tournament_name,
      t.start_date,
      gpp_group_lock_due_at(t.start_date::date) AS group_lock_due_at
    FROM gpp_pools p
    JOIN gpp_tournaments t ON t.id = p.tournament_id
    WHERE p.is_completed = false
      AND p.game_format IN ('ranked_groups', 'random_groups')
      AND p.groups_finalized_at IS NULL
      AND gpp_group_lock_due_at(t.start_date::date) <= now()
    ORDER BY t.start_date ASC
    LIMIT 50
  ),
  unlocked_after_first_tee AS (
    SELECT
      p.id,
      p.name,
      p.game_format,
      t.id AS tournament_id,
      t.name AS tournament_name,
      t.status AS tournament_status,
      t.last_scores_fetch
    FROM gpp_pools p
    JOIN gpp_tournaments t ON t.id = p.tournament_id
    WHERE p.is_completed = false
      AND p.is_locked = false
      AND t.status = 'live'
    ORDER BY t.last_scores_fetch ASC NULLS FIRST
    LIMIT 50
  )
  SELECT jsonb_build_object(
    'pools_due_to_lock', COALESCE((SELECT jsonb_agg(to_jsonb(pools_due_to_lock)) FROM pools_due_to_lock), '[]'::jsonb),
    'unfinalized_grouped_pools_past_tuesday_lock', COALESCE((SELECT jsonb_agg(to_jsonb(unfinalized_grouped)) FROM unfinalized_grouped), '[]'::jsonb),
    'unlocked_pools_after_first_tee', COALESCE((SELECT jsonb_agg(to_jsonb(unlocked_after_first_tee)) FROM unlocked_after_first_tee), '[]'::jsonb),
    'last_successful_run', gpp_latest_cron_run('/api/cron/sync-tournaments?live=1', 'success'),
    'last_failed_run', gpp_latest_cron_run('/api/cron/sync-tournaments?live=1', 'failure')
  );
$$;
