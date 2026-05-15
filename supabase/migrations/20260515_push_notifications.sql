create table if not exists public.gpp_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists gpp_push_subscriptions_user_id_idx on public.gpp_push_subscriptions(user_id);

create table if not exists public.gpp_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pick_deadline boolean not null default true,
  leaderboard_live boolean not null default true,
  took_lead boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gpp_notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_id uuid references public.gpp_pools(id) on delete cascade,
  type text not null,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now()
);

create index if not exists gpp_notification_events_user_id_idx on public.gpp_notification_events(user_id);
create index if not exists gpp_notification_events_pool_id_idx on public.gpp_notification_events(pool_id);
create index if not exists gpp_notification_events_type_idx on public.gpp_notification_events(type);

alter table public.gpp_push_subscriptions enable row level security;
alter table public.gpp_notification_preferences enable row level security;
alter table public.gpp_notification_events enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.gpp_push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.gpp_push_subscriptions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own notification preferences" on public.gpp_notification_preferences;
create policy "Users manage own notification preferences"
  on public.gpp_notification_preferences
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users read own notification events" on public.gpp_notification_events;
create policy "Users read own notification events"
  on public.gpp_notification_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Service role manages push subscriptions" on public.gpp_push_subscriptions;
create policy "Service role manages push subscriptions"
  on public.gpp_push_subscriptions
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role manages notification preferences" on public.gpp_notification_preferences;
create policy "Service role manages notification preferences"
  on public.gpp_notification_preferences
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role manages notification events" on public.gpp_notification_events;
create policy "Service role manages notification events"
  on public.gpp_notification_events
  for all
  to service_role
  using (true)
  with check (true);
