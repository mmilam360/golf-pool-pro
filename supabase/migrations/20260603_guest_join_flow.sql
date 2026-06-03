create extension if not exists pgcrypto;

alter table public.gpp_entries
  alter column user_id drop not null;

alter table public.gpp_entries
  add column if not exists guest_entry_token_hash text,
  add column if not exists claimed_at timestamptz;

create index if not exists gpp_entries_guest_token_idx
  on public.gpp_entries (id, guest_entry_token_hash)
  where guest_entry_token_hash is not null;

create or replace function public.gpp_guest_join_payload(p_passcode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool public.gpp_pools%rowtype;
  v_tournament public.gpp_tournaments%rowtype;
  v_passcode text := upper(regexp_replace(coalesce(p_passcode, ''), '[^A-Z0-9]', '', 'g'));
begin
  if length(v_passcode) <> 6 then
    raise exception 'Enter the full pool code from your host.' using errcode = '22023';
  end if;

  select * into v_pool
  from public.gpp_pools
  where passcode = v_passcode
  limit 1;

  if not found then
    raise exception 'Invalid passcode. Check with the pool host.' using errcode = 'P0002';
  end if;

  select * into v_tournament
  from public.gpp_tournaments
  where id = v_pool.tournament_id;

  return jsonb_build_object(
    'pool', jsonb_build_object(
      'id', v_pool.id,
      'name', v_pool.name,
      'passcode', v_pool.passcode,
      'pick_count', v_pool.pick_count,
      'count_scores', v_pool.count_scores,
      'is_locked', v_pool.is_locked,
      'game_format', coalesce((to_jsonb(v_pool)->>'game_format'), 'standard'),
      'group_count', coalesce((to_jsonb(v_pool)->>'group_count')::int, 0),
      'picks_per_group', coalesce((to_jsonb(v_pool)->>'picks_per_group')::int, 0),
      'pick_groups_json', coalesce(to_jsonb(v_pool)->'pick_groups_json', '[]'::jsonb),
      'groups_finalized_at', to_jsonb(v_pool)->>'groups_finalized_at'
    ),
    'tournament', jsonb_build_object(
      'name', v_tournament.name,
      'start_date', v_tournament.start_date,
      'status', v_tournament.status,
      'field_json', coalesce(v_tournament.field_json, '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.gpp_create_guest_entry(
  p_passcode text,
  p_display_name text,
  p_golfer_picks text[],
  p_claim_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool public.gpp_pools%rowtype;
  v_tournament public.gpp_tournaments%rowtype;
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
  v_token text := nullif(trim(coalesce(p_claim_token, '')), '');
  v_passcode text := upper(regexp_replace(coalesce(p_passcode, ''), '[^A-Z0-9]', '', 'g'));
  v_entry_id uuid;
  v_required_picks int;
  v_game_format text;
begin
  if length(v_passcode) <> 6 then
    raise exception 'Enter the full pool code from your host.' using errcode = '22023';
  end if;

  if v_name is null then
    raise exception 'Enter an entry name.' using errcode = '22023';
  end if;

  if v_token is null or length(v_token) < 24 then
    raise exception 'Could not create a secure entry link.' using errcode = '22023';
  end if;

  select * into v_pool
  from public.gpp_pools
  where passcode = v_passcode
  limit 1;

  if not found then
    raise exception 'Invalid passcode. Check with the pool host.' using errcode = 'P0002';
  end if;

  select * into v_tournament
  from public.gpp_tournaments
  where id = v_pool.tournament_id;

  if coalesce(v_pool.is_locked, false) or v_tournament.status in ('live', 'completed') then
    raise exception 'This pool is locked. Picks have closed.' using errcode = 'P0001';
  end if;

  v_game_format := coalesce(to_jsonb(v_pool)->>'game_format', 'standard');
  v_required_picks := case
    when v_game_format in ('ranked_groups', 'random_groups') then
      coalesce(jsonb_array_length(coalesce(to_jsonb(v_pool)->'pick_groups_json', '[]'::jsonb)) * nullif((to_jsonb(v_pool)->>'picks_per_group')::int, 0), 0)
    else v_pool.pick_count
  end;

  if v_required_picks <= 0 then
    raise exception 'Picks are not open for this pool yet.' using errcode = 'P0001';
  end if;

  if v_game_format in ('ranked_groups', 'random_groups') and not coalesce((to_jsonb(v_pool)->>'groups_finalized_at') <> '', false) then
    raise exception 'Picks open after groups lock.' using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_golfer_picks, 1), 0) <> v_pool.pick_count and v_game_format = 'standard' then
    raise exception 'Finish every pick before saving as a guest.' using errcode = '22023';
  end if;

  if v_game_format in ('ranked_groups', 'random_groups') and coalesce(array_length(p_golfer_picks, 1), 0) <> v_required_picks then
    raise exception 'Finish every group before saving as a guest.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_golfer_picks, array[]::text[])) as pick(name)
    where nullif(trim(pick.name), '') is null
  ) then
    raise exception 'Pick every golfer before saving.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_golfer_picks, array[]::text[])) as pick(name)
    group by lower(trim(pick.name))
    having count(*) > 1
  ) then
    raise exception 'Remove duplicate golfers before saving.' using errcode = '22023';
  end if;

  if v_game_format = 'standard' and exists (
    select 1
    from unnest(coalesce(p_golfer_picks, array[]::text[])) as pick(name)
    where not exists (
      select 1
      from jsonb_array_elements(coalesce(v_tournament.field_json, '[]'::jsonb)) as field_player(player)
      where lower(trim(field_player.player->>'name')) = lower(trim(pick.name))
    )
  ) then
    raise exception 'Pick from the tournament field.' using errcode = '22023';
  end if;

  if v_game_format in ('ranked_groups', 'random_groups') and exists (
    select 1
    from unnest(coalesce(p_golfer_picks, array[]::text[])) as pick(name)
    where not exists (
      select 1
      from jsonb_array_elements(coalesce(to_jsonb(v_pool)->'pick_groups_json', '[]'::jsonb)) as pick_group(group_json)
      cross join lateral jsonb_array_elements(coalesce(pick_group.group_json->'players', '[]'::jsonb)) as group_player(player)
      where lower(trim(group_player.player->>'name')) = lower(trim(pick.name))
    )
  ) then
    raise exception 'Pick from the locked groups.' using errcode = '22023';
  end if;

  if v_game_format in ('ranked_groups', 'random_groups') and exists (
    select 1
    from jsonb_array_elements(coalesce(to_jsonb(v_pool)->'pick_groups_json', '[]'::jsonb)) as pick_group(group_json)
    left join lateral (
      select count(*) as pick_count
      from unnest(coalesce(p_golfer_picks, array[]::text[])) as pick(name)
      join jsonb_array_elements(coalesce(pick_group.group_json->'players', '[]'::jsonb)) as group_player(player)
        on lower(trim(group_player.player->>'name')) = lower(trim(pick.name))
    ) selected on true
    where selected.pick_count <> (to_jsonb(v_pool)->>'picks_per_group')::int
  ) then
    raise exception 'Make the required number of picks from each group.' using errcode = '22023';
  end if;

  insert into public.gpp_entries (
    pool_id,
    user_id,
    display_name,
    golfer_picks,
    guest_entry_token_hash
  ) values (
    v_pool.id,
    null,
    left(v_name, 80),
    to_jsonb(p_golfer_picks),
    encode(extensions.digest(v_token, 'sha256'), 'hex')
  )
  returning id into v_entry_id;

  return jsonb_build_object(
    'entry_id', v_entry_id,
    'pool_id', v_pool.id,
    'leaderboard_path', '/leaderboard/' || v_pool.id::text || '?entry=' || v_entry_id::text,
    'claim_path', '/pool/join?claim=' || v_entry_id::text || '.' || v_token
  );
end;
$$;

create or replace function public.gpp_claim_guest_entry(p_entry_id uuid, p_claim_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.gpp_entries%rowtype;
  v_user_id uuid := auth.uid();
  v_existing_entry_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to link this entry.' using errcode = '28000';
  end if;

  select * into v_entry
  from public.gpp_entries
  where id = p_entry_id
    and guest_entry_token_hash = encode(extensions.digest(coalesce(p_claim_token, ''), 'sha256'), 'hex')
    and user_id is null
    and is_removed = false
  limit 1;

  if not found then
    raise exception 'This entry link is no longer available.' using errcode = 'P0002';
  end if;

  select id into v_existing_entry_id
  from public.gpp_entries
  where pool_id = v_entry.pool_id
    and user_id = v_user_id
    and is_removed = false
  limit 1;

  if v_existing_entry_id is not null then
    raise exception 'Your account already has an entry in this pool.' using errcode = '23505';
  end if;

  update public.gpp_entries
  set user_id = v_user_id,
      claimed_at = now(),
      guest_entry_token_hash = null
  where id = p_entry_id;

  return jsonb_build_object('pool_id', v_entry.pool_id, 'entry_id', p_entry_id);
end;
$$;

grant execute on function public.gpp_guest_join_payload(text) to anon, authenticated;
grant execute on function public.gpp_create_guest_entry(text, text, text[], text) to anon, authenticated;
grant execute on function public.gpp_claim_guest_entry(uuid, text) to authenticated;
