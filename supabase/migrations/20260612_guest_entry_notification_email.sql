alter table public.gpp_entries
  add column if not exists notification_email text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gpp_entries_notification_email_format'
      and conrelid = 'public.gpp_entries'::regclass
  ) then
    alter table public.gpp_entries
      add constraint gpp_entries_notification_email_format
      check (
        notification_email is null
        or notification_email = ''
        or notification_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      );
  end if;
end $$;
