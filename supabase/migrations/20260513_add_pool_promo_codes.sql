-- Promo codes for host-paid pool fees. Codes are applied by pool owners
-- and can comp a final pool fee without exposing Square/card fields.

create table if not exists public.gpp_promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  free_pool boolean not null default true,
  discount_cents integer,
  max_redemptions integer,
  times_redeemed integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpp_promo_codes_code_upper check (code = upper(code)),
  constraint gpp_promo_codes_discount_nonnegative check (discount_cents is null or discount_cents >= 0),
  constraint gpp_promo_codes_max_positive check (max_redemptions is null or max_redemptions > 0),
  constraint gpp_promo_codes_times_nonnegative check (times_redeemed >= 0)
);

create table if not exists public.gpp_promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.gpp_promo_codes(id) on delete restrict,
  pool_id uuid not null references public.gpp_pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  discount_cents integer not null default 0,
  entry_count_at_redemption integer not null default 0,
  created_at timestamptz not null default now(),
  constraint gpp_promo_redemptions_discount_nonnegative check (discount_cents >= 0),
  constraint gpp_promo_redemptions_entry_count_nonnegative check (entry_count_at_redemption >= 0)
);

create unique index if not exists gpp_promo_codes_code_idx on public.gpp_promo_codes (code);
create unique index if not exists gpp_promo_redemptions_pool_idx on public.gpp_promo_redemptions (pool_id);
create unique index if not exists gpp_promo_redemptions_code_user_idx on public.gpp_promo_redemptions (promo_code_id, user_id);
create index if not exists gpp_promo_redemptions_user_idx on public.gpp_promo_redemptions (user_id);

alter table public.gpp_promo_codes enable row level security;
alter table public.gpp_promo_redemptions enable row level security;

-- No public reads of promo code inventory. Validation happens through server routes.
drop policy if exists "promo_codes_service_role_all" on public.gpp_promo_codes;
create policy "promo_codes_service_role_all" on public.gpp_promo_codes
  for all to service_role
  using (true)
  with check (true);

drop policy if exists "promo_redemptions_service_role_all" on public.gpp_promo_redemptions;
create policy "promo_redemptions_service_role_all" on public.gpp_promo_redemptions
  for all to service_role
  using (true)
  with check (true);

-- Owners can see whether their own pool used a promo, without seeing code inventory.
drop policy if exists "owners_read_own_promo_redemptions" on public.gpp_promo_redemptions;
create policy "owners_read_own_promo_redemptions" on public.gpp_promo_redemptions
  for select to authenticated
  using (
    exists (
      select 1 from public.gpp_pools p
      where p.id = pool_id and p.owner_id = auth.uid()
    )
  );

create or replace function public.gpp_touch_promo_codes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gpp_promo_codes_updated_at on public.gpp_promo_codes;
create trigger gpp_promo_codes_updated_at
  before update on public.gpp_promo_codes
  for each row execute function public.gpp_touch_promo_codes_updated_at();

insert into public.gpp_promo_codes (code, description, free_pool, max_redemptions)
values ('FIRSTPOOL', 'Free first pool', true, 100)
on conflict (code) do update set
  description = excluded.description,
  free_pool = excluded.free_pool,
  max_redemptions = excluded.max_redemptions,
  is_active = true;
