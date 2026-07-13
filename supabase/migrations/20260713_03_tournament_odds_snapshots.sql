begin;

alter table public.gpp_tournaments
  add column if not exists odds_snapshot_json jsonb,
  add column if not exists odds_source text,
  add column if not exists odds_event_id text,
  add column if not exists odds_captured_at timestamptz;

comment on column public.gpp_tournaments.odds_snapshot_json is
  'One-time pre-tournament outright odds snapshot used to build new ranked groups. Existing pool group snapshots remain unchanged.';
comment on column public.gpp_tournaments.odds_source is
  'Provider identifier for odds_snapshot_json.';
comment on column public.gpp_tournaments.odds_event_id is
  'Provider event identifier for the saved tournament odds snapshot.';
comment on column public.gpp_tournaments.odds_captured_at is
  'Time the saved tournament odds snapshot was captured.';

commit;
