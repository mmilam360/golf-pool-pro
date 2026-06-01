alter table public.gpp_tournaments
  add column if not exists last_field_fetch timestamptz,
  add column if not exists field_source text,
  add column if not exists field_fingerprint text;
