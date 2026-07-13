begin;

alter table public.gpp_pools
  add column if not exists require_entry_email boolean not null default false;

comment on column public.gpp_pools.require_entry_email is
  'When true, every entrant must have a valid private contact email on the entry.';

-- A confirmed account profile is the only safe source for repairing missing
-- private names. Do not guess names for guest entries.
update public.gpp_entries e
set
  full_name = nullif(regexp_replace(coalesce(p.full_name, ''), '\s+', ' ', 'g'), ''),
  full_name_confirmed_at = p.full_name_confirmed_at
from public.gpp_profiles p
where e.user_id = p.id
  and coalesce(e.is_removed, false) = false
  and p.full_name_confirmed_at is not null
  and nullif(regexp_replace(coalesce(p.full_name, ''), '\s+', ' ', 'g'), '') is not null
  and (
    nullif(regexp_replace(coalesce(e.full_name, ''), '\s+', ' ', 'g'), '') is null
    or e.full_name_confirmed_at is null
  );

-- Pool creation is still client-side for signed-in owners. Preserve the existing
-- column-level privilege model while allowing this one new setting to be inserted.
grant insert (require_entry_email) on table public.gpp_pools to authenticated;

-- The current app uses the guarded guest-entry API. This older RPC cannot
-- collect full name or email, so leaving it callable would bypass both rules.
revoke execute on function public.gpp_create_guest_entry(text, text, text[], text) from public, anon, authenticated;

commit;
