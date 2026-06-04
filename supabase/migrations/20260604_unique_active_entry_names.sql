create or replace function public.gpp_normalize_entry_name(p_name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

create unique index if not exists gpp_entries_active_pool_name_unique
  on public.gpp_entries (pool_id, public.gpp_normalize_entry_name(display_name))
  where is_removed = false;
