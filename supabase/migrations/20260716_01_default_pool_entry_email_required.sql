begin;

alter table public.gpp_pools
  alter column require_entry_email set default true;

commit;
