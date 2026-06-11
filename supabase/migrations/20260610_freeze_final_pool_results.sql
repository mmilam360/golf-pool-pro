alter table public.gpp_pools
  add column if not exists results_finalized_at timestamptz,
  add column if not exists results_finalized_source text;

create index if not exists gpp_pools_results_finalized_at_idx
  on public.gpp_pools(results_finalized_at);

update public.gpp_pools
set
  results_finalized_at = coalesce(updated_at, now()),
  results_finalized_source = coalesce(results_finalized_source, 'migration_existing_completed')
where is_completed = true
  and results_finalized_at is null;
