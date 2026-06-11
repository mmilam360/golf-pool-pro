alter table public.gpp_pools
  add column if not exists results_finalized_at timestamptz,
  add column if not exists results_finalized_source text;

create index if not exists gpp_pools_results_finalized_at_idx
  on public.gpp_pools(results_finalized_at);
