alter table public.gpp_notification_preferences
  add column if not exists field_update boolean not null default true;
