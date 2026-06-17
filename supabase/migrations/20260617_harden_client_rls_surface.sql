-- Tighten client-side Supabase privileges/policies so browser clients cannot bypass
-- the server routes that enforce lock/live/payment/removal rules.

begin;

-- Entries: guests use the service-backed guest-entry API. Authenticated users may
-- insert/update only their own player-facing entry fields, and only before picks close.
revoke insert, update, delete on table public.gpp_entries from anon;
revoke insert, update on table public.gpp_entries from authenticated;

grant insert (pool_id, user_id, display_name, full_name, full_name_confirmed_at, notification_email, golfer_picks)
  on table public.gpp_entries to authenticated;
grant update (display_name, full_name, full_name_confirmed_at, notification_email, golfer_picks)
  on table public.gpp_entries to authenticated;

drop policy if exists "Pool owner can admin entries" on public.gpp_entries;
drop policy if exists "Users can insert own entry" on public.gpp_entries;
drop policy if exists "Users can update own picks" on public.gpp_entries;

create policy "Users can insert own entry before picks close"
  on public.gpp_entries
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and coalesce(is_removed, false) = false
    and exists (
      select 1
      from public.gpp_pools p
      join public.gpp_tournaments t on t.id = p.tournament_id
      where p.id = pool_id
        and coalesce(p.is_locked, false) = false
        and coalesce(p.is_completed, false) = false
        and coalesce(t.status, '') not in ('live', 'completed')
    )
  );

create policy "Users can update own entry before picks close"
  on public.gpp_entries
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and coalesce(is_removed, false) = false
    and exists (
      select 1
      from public.gpp_pools p
      join public.gpp_tournaments t on t.id = p.tournament_id
      where p.id = pool_id
        and coalesce(p.is_locked, false) = false
        and coalesce(p.is_completed, false) = false
        and coalesce(t.status, '') not in ('live', 'completed')
    )
  )
  with check (
    auth.uid() = user_id
    and coalesce(is_removed, false) = false
    and exists (
      select 1
      from public.gpp_pools p
      join public.gpp_tournaments t on t.id = p.tournament_id
      where p.id = pool_id
        and coalesce(p.is_locked, false) = false
        and coalesce(p.is_completed, false) = false
        and coalesce(t.status, '') not in ('live', 'completed')
    )
  );

-- Pools: the browser create form still inserts new pools directly, but direct
-- browser updates can no longer mutate payment/lock/results/system fields.
revoke insert, update, delete on table public.gpp_pools from anon;
revoke insert, update, delete on table public.gpp_pools from authenticated;

grant insert (
  tournament_id,
  name,
  owner_id,
  passcode,
  pick_count,
  count_scores,
  game_format,
  group_count,
  picks_per_group,
  pick_groups_json,
  field_snapshot_json,
  groups_finalized_at,
  ob_rule_enabled,
  ob_penalty_strokes,
  payment_status,
  paid_entry_limit,
  activated_at
) on table public.gpp_pools to authenticated;

grant update (name) on table public.gpp_pools to authenticated;

drop policy if exists "Authenticated users can create" on public.gpp_pools;
drop policy if exists "Pool owner can update" on public.gpp_pools;

create policy "Authenticated users can create safe draft pool"
  on public.gpp_pools
  for insert
  to authenticated
  with check (
    auth.uid() = owner_id
    and coalesce(is_locked, false) = false
    and coalesce(is_completed, false) = false
    and payment_status = 'active'
    and paid_entry_limit = 5
    and coalesce(amount_paid_cents, 0) = 0
    and pick_count between 1 and 24
    and count_scores between 1 and pick_count
    and coalesce(ob_penalty_strokes, 0) between 0 and 10
    and game_format in ('standard', 'ranked_groups', 'random_groups')
    and (
      (game_format = 'standard' and coalesce(group_count, 0) = 0 and coalesce(picks_per_group, 0) = 0)
      or (game_format in ('ranked_groups', 'random_groups') and group_count between 1 and 12 and picks_per_group between 1 and 6 and pick_count = group_count * picks_per_group)
    )
    and exists (
      select 1
      from public.gpp_tournaments t
      where t.id = tournament_id
        and coalesce(t.status, '') = 'upcoming'
    )
  );

create policy "Pool owner can rename"
  on public.gpp_pools
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

commit;
