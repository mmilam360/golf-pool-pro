begin;

create or replace function public.gpp_enforce_entry_identity_and_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_full_name text;
  profile_full_name_confirmed_at timestamptz;
  profile_email text;
  email_required boolean := false;
begin
  new.display_name := nullif(btrim(new.display_name), '');
  new.full_name := nullif(regexp_replace(coalesce(new.full_name, ''), '\s+', ' ', 'g'), '');
  new.notification_email := nullif(lower(btrim(coalesce(new.notification_email, ''))), '');

  if new.user_id is not null then
    select
      nullif(regexp_replace(coalesce(p.full_name, ''), '\s+', ' ', 'g'), ''),
      p.full_name_confirmed_at,
      nullif(lower(btrim(coalesce(p.email, ''))), '')
    into profile_full_name, profile_full_name_confirmed_at, profile_email
    from public.gpp_profiles p
    where p.id = new.user_id;

    if new.full_name is null and profile_full_name is not null and profile_full_name_confirmed_at is not null then
      new.full_name := profile_full_name;
      new.full_name_confirmed_at := profile_full_name_confirmed_at;
    end if;
  end if;

  if new.full_name is not null and new.full_name_confirmed_at is null then
    new.full_name_confirmed_at := now();
  end if;

  if new.display_name is null then
    raise exception using
      errcode = '23514',
      message = 'Entry leaderboard name is required.';
  end if;

  if new.full_name is null or new.full_name_confirmed_at is null then
    raise exception using
      errcode = '23514',
      message = 'Entry full name is required.';
  end if;

  select coalesce(p.require_entry_email, false)
  into email_required
  from public.gpp_pools p
  where p.id = new.pool_id;

  if email_required and new.notification_email is null and profile_email is not null then
    new.notification_email := profile_email;
  end if;

  if email_required and (
    new.notification_email is null
    or new.notification_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception using
      errcode = '23514',
      message = 'A valid entrant email is required for this pool.';
  end if;

  return new;
end;
$$;

revoke all on function public.gpp_enforce_entry_identity_and_email() from public;
grant execute on function public.gpp_enforce_entry_identity_and_email() to service_role;

-- Enforce invariants on every new entry and whenever identity, email, or picks
-- are changed. Scoring/payment maintenance on untouched legacy rows is not blocked.
-- Account rows can self-repair from confirmed profile values inside the trigger.
drop trigger if exists gpp_entries_enforce_identity_and_email on public.gpp_entries;
create trigger gpp_entries_enforce_identity_and_email
before insert or update of display_name, full_name, full_name_confirmed_at, notification_email, golfer_picks
on public.gpp_entries
for each row
execute function public.gpp_enforce_entry_identity_and_email();

commit;
