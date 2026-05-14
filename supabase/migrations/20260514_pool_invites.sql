create table if not exists public.gpp_pool_invites (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.gpp_pools(id) on delete cascade,
  invited_user_id uuid not null references public.gpp_profiles(id) on delete cascade,
  invited_by_user_id uuid not null references public.gpp_profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint gpp_pool_invites_status_check check (status in ('pending', 'accepted', 'declined', 'expired')),
  constraint gpp_pool_invites_unique_user_per_pool unique (pool_id, invited_user_id)
);

alter table public.gpp_pool_invites enable row level security;

create index if not exists gpp_pool_invites_pool_id_idx on public.gpp_pool_invites(pool_id);
create index if not exists gpp_pool_invites_invited_user_id_idx on public.gpp_pool_invites(invited_user_id);
create index if not exists gpp_pool_invites_invited_by_user_id_idx on public.gpp_pool_invites(invited_by_user_id);

drop policy if exists "Pool owners can manage invites" on public.gpp_pool_invites;
create policy "Pool owners can manage invites"
  on public.gpp_pool_invites for all
  using (
    exists (
      select 1 from public.gpp_pools p
      where p.id = gpp_pool_invites.pool_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    invited_by_user_id = auth.uid()
    and exists (
      select 1 from public.gpp_pools p
      where p.id = gpp_pool_invites.pool_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Invited users can read own invites" on public.gpp_pool_invites;
create policy "Invited users can read own invites"
  on public.gpp_pool_invites for select
  using (invited_user_id = auth.uid());

drop policy if exists "Invited users can respond to own pending invites" on public.gpp_pool_invites;
create policy "Invited users can respond to own pending invites"
  on public.gpp_pool_invites for update
  using (invited_user_id = auth.uid() and status = 'pending')
  with check (invited_user_id = auth.uid() and status in ('accepted', 'declined'));

drop policy if exists "Service role can manage pool invites" on public.gpp_pool_invites;
create policy "Service role can manage pool invites"
  on public.gpp_pool_invites for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
