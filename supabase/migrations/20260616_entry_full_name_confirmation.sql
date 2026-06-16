-- Track whether a full name was explicitly typed, not copied from an old leaderboard-name default.

alter table public.gpp_profiles
  add column if not exists full_name_confirmed_at timestamptz;

alter table public.gpp_entries
  add column if not exists full_name_confirmed_at timestamptz;

create or replace function public.gpp_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  combined_name text;
  explicit_full_name text;
  profile_name text;
begin
  combined_name := btrim(concat_ws(' ',
    nullif(NEW.raw_user_meta_data->>'first_name', ''),
    nullif(NEW.raw_user_meta_data->>'last_name', '')
  ));
  explicit_full_name := nullif(NEW.raw_user_meta_data->>'full_name', '');

  profile_name := coalesce(
    explicit_full_name,
    nullif(NEW.raw_user_meta_data->>'name', ''),
    nullif(combined_name, ''),
    nullif(NEW.raw_user_meta_data->>'display_name', ''),
    split_part(NEW.email, '@', 1)
  );

  insert into public.gpp_profiles (id, display_name, full_name, full_name_confirmed_at, email)
  values (
    NEW.id,
    coalesce(
      nullif(NEW.raw_user_meta_data->>'display_name', ''),
      profile_name
    ),
    profile_name,
    case when explicit_full_name is not null then now() else null end,
    NEW.email
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    full_name = coalesce(public.gpp_profiles.full_name, excluded.full_name),
    full_name_confirmed_at = coalesce(public.gpp_profiles.full_name_confirmed_at, excluded.full_name_confirmed_at),
    email = excluded.email,
    updated_at = now();

  return NEW;
end;
$$;
