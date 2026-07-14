alter table public.gpp_cron_runs
  add column if not exists dedupe_key text;

alter table public.gpp_cron_runs
  drop constraint if exists gpp_cron_runs_status_check;

alter table public.gpp_cron_runs
  add constraint gpp_cron_runs_status_check
  check (status in ('running', 'success', 'failure'));

create unique index if not exists gpp_cron_runs_dedupe_key_idx
  on public.gpp_cron_runs (dedupe_key)
  where dedupe_key is not null;
