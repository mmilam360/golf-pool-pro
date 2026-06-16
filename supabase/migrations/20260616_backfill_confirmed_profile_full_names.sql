-- Backfill profile full names from explicitly confirmed account entries.

with latest_confirmed_entry_name as (
  select distinct on (user_id)
    user_id,
    full_name,
    full_name_confirmed_at
  from public.gpp_entries
  where user_id is not null
    and nullif(btrim(full_name), '') is not null
    and full_name_confirmed_at is not null
  order by user_id, full_name_confirmed_at desc
)
update public.gpp_profiles profile
set
  full_name = latest.full_name,
  full_name_confirmed_at = latest.full_name_confirmed_at,
  updated_at = now()
from latest_confirmed_entry_name latest
where profile.id = latest.user_id
  and profile.full_name_confirmed_at is null;
