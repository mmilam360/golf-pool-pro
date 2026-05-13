alter table public.gpp_pools
  add column if not exists payment_status text not null default 'draft',
  add column if not exists paid_entry_limit integer not null default 5,
  add column if not exists amount_paid_cents integer not null default 0,
  add column if not exists activated_at timestamptz,
  add column if not exists last_payment_at timestamptz,
  add column if not exists square_customer_id text,
  add column if not exists square_payment_ids text[] not null default '{}',
  add column if not exists square_order_ids text[] not null default '{}';

alter table public.gpp_pools
  drop constraint if exists gpp_pools_payment_status_check;

alter table public.gpp_pools
  add constraint gpp_pools_payment_status_check
  check (payment_status in ('draft', 'active', 'payment_due', 'archived_unpaid', 'refunded'));

alter table public.gpp_pools
  drop constraint if exists gpp_pools_paid_entry_limit_check;

alter table public.gpp_pools
  add constraint gpp_pools_paid_entry_limit_check
  check (paid_entry_limit >= 0);

alter table public.gpp_pools
  drop constraint if exists gpp_pools_amount_paid_cents_check;

alter table public.gpp_pools
  add constraint gpp_pools_amount_paid_cents_check
  check (amount_paid_cents >= 0);

create table if not exists public.gpp_pool_payments (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.gpp_pools(id) on delete cascade,
  provider text not null default 'square',
  square_payment_id text unique,
  square_order_id text,
  amount_cents integer not null check (amount_cents >= 0),
  entry_count_at_payment integer not null check (entry_count_at_payment >= 0),
  entry_limit integer not null check (entry_limit >= 0),
  status text not null,
  created_at timestamptz not null default now()
);

alter table public.gpp_pool_payments enable row level security;

drop policy if exists "Pool owners can read payment records" on public.gpp_pool_payments;
create policy "Pool owners can read payment records"
  on public.gpp_pool_payments for select
  using (
    exists (
      select 1 from public.gpp_pools p
      where p.id = gpp_pool_payments.pool_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Service role can manage payment records" on public.gpp_pool_payments;
create policy "Service role can manage payment records"
  on public.gpp_pool_payments for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists gpp_pool_payments_pool_id_idx on public.gpp_pool_payments(pool_id);
create index if not exists gpp_pools_payment_status_idx on public.gpp_pools(payment_status);
