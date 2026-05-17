create table if not exists public.gpp_final_result_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_id uuid not null references public.gpp_pools(id) on delete cascade,
  entry_id uuid references public.gpp_entries(id) on delete set null,
  dismissed_at timestamptz not null default now(),
  unique (user_id, pool_id)
);

alter table public.gpp_final_result_dismissals enable row level security;

drop policy if exists "final result dismissals select own" on public.gpp_final_result_dismissals;
create policy "final result dismissals select own"
  on public.gpp_final_result_dismissals
  for select
  using (auth.uid() = user_id);

drop policy if exists "final result dismissals insert own" on public.gpp_final_result_dismissals;
create policy "final result dismissals insert own"
  on public.gpp_final_result_dismissals
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "final result dismissals update own" on public.gpp_final_result_dismissals;
create policy "final result dismissals update own"
  on public.gpp_final_result_dismissals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists gpp_final_result_dismissals_user_id_idx
  on public.gpp_final_result_dismissals(user_id);

create index if not exists gpp_final_result_dismissals_pool_id_idx
  on public.gpp_final_result_dismissals(pool_id);
