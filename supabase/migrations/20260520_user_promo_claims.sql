-- Track promo offers claimed from signup links so hosts do not have to remember a code.

create table if not exists public.gpp_user_promo_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  promo_code_id uuid not null references public.gpp_promo_codes(id) on delete restrict,
  source text,
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists gpp_user_promo_claims_user_idx
  on public.gpp_user_promo_claims (user_id);

create index if not exists gpp_user_promo_claims_promo_code_idx
  on public.gpp_user_promo_claims (promo_code_id);

alter table public.gpp_user_promo_claims enable row level security;

drop policy if exists "promo_claims_service_role_all" on public.gpp_user_promo_claims;
create policy "promo_claims_service_role_all" on public.gpp_user_promo_claims
  for all to service_role
  using (true)
  with check (true);

-- Users may read their own claimed offer so the app can show the dashboard banner.
drop policy if exists "users_read_own_promo_claim" on public.gpp_user_promo_claims;
create policy "users_read_own_promo_claim" on public.gpp_user_promo_claims
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.gpp_touch_user_promo_claims_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gpp_user_promo_claims_updated_at on public.gpp_user_promo_claims;
create trigger gpp_user_promo_claims_updated_at
  before update on public.gpp_user_promo_claims
  for each row execute function public.gpp_touch_user_promo_claims_updated_at();
