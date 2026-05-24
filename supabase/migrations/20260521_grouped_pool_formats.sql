alter table public.gpp_pools
  add column if not exists game_format text not null default 'standard',
  add column if not exists group_count integer not null default 0,
  add column if not exists picks_per_group integer not null default 0,
  add column if not exists pick_groups_json jsonb not null default '[]'::jsonb,
  add column if not exists field_snapshot_json jsonb,
  add column if not exists groups_finalized_at timestamptz;

alter table public.gpp_pools
  drop constraint if exists gpp_pools_game_format_check;

alter table public.gpp_pools
  add constraint gpp_pools_game_format_check
  check (game_format in ('standard', 'ranked_groups', 'random_groups'));

alter table public.gpp_pools
  drop constraint if exists gpp_pools_group_settings_check;

alter table public.gpp_pools
  add constraint gpp_pools_group_settings_check
  check (
    (game_format = 'standard' and group_count = 0 and picks_per_group = 0)
    or
    (game_format <> 'standard' and group_count between 2 and 12 and picks_per_group between 1 and 6)
  );
