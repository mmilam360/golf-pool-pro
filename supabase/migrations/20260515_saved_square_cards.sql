create table if not exists public.gpp_saved_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  square_customer_id text not null,
  square_card_id text not null unique,
  brand text,
  last_4 text,
  exp_month integer,
  exp_year integer,
  cardholder_name text,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gpp_saved_cards enable row level security;

drop policy if exists "Users can read their saved cards" on public.gpp_saved_cards;
create policy "Users can read their saved cards"
  on public.gpp_saved_cards for select
  using (user_id = auth.uid());

drop policy if exists "Service role can manage saved cards" on public.gpp_saved_cards;
create policy "Service role can manage saved cards"
  on public.gpp_saved_cards for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists gpp_saved_cards_user_id_idx on public.gpp_saved_cards(user_id);
create index if not exists gpp_saved_cards_square_customer_id_idx on public.gpp_saved_cards(square_customer_id);
