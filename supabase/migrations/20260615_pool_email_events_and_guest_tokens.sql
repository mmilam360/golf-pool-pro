create table if not exists public.gpp_email_events (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references public.gpp_pools(id) on delete cascade,
  entry_id uuid references public.gpp_entries(id) on delete cascade,
  email_type text not null,
  dedupe_key text not null unique,
  recipient text,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists gpp_email_events_pool_id_idx on public.gpp_email_events(pool_id);
create index if not exists gpp_email_events_entry_id_idx on public.gpp_email_events(entry_id);
create index if not exists gpp_email_events_email_type_idx on public.gpp_email_events(email_type);
create index if not exists gpp_email_events_sent_at_idx on public.gpp_email_events(sent_at desc);

create table if not exists public.gpp_guest_entry_tokens (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.gpp_entries(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null default 'email_link',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists gpp_guest_entry_tokens_entry_id_idx on public.gpp_guest_entry_tokens(entry_id);
create index if not exists gpp_guest_entry_tokens_purpose_idx on public.gpp_guest_entry_tokens(purpose);

alter table public.gpp_email_events enable row level security;
alter table public.gpp_guest_entry_tokens enable row level security;

drop policy if exists "Service role manages email events" on public.gpp_email_events;
create policy "Service role manages email events"
  on public.gpp_email_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role manages guest entry tokens" on public.gpp_guest_entry_tokens;
create policy "Service role manages guest entry tokens"
  on public.gpp_guest_entry_tokens
  for all
  to service_role
  using (true)
  with check (true);
