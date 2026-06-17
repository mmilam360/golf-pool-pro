-- Prevent duplicate active leaderboard names inside the same pool.
-- Must be applied after cleaning existing active duplicates.

create unique index if not exists gpp_entries_active_pool_name_unique
on public.gpp_entries (
  pool_id,
  lower(regexp_replace(btrim(display_name), '\s+', ' ', 'g'))
)
where coalesce(is_removed, false) = false;
