create unique index if not exists gpp_tournaments_external_id_unique
  on public.gpp_tournaments (external_id)
  where external_id is not null;
