-- Support launch offers that set a final pool price, such as CJCUP9 = $9.

alter table public.gpp_promo_codes
  add column if not exists target_amount_cents integer;

alter table public.gpp_promo_codes
  drop constraint if exists gpp_promo_codes_target_amount_nonnegative;

alter table public.gpp_promo_codes
  add constraint gpp_promo_codes_target_amount_nonnegative
  check (target_amount_cents is null or target_amount_cents >= 0);

insert into public.gpp_promo_codes (
  code,
  description,
  free_pool,
  discount_cents,
  target_amount_cents,
  max_redemptions,
  starts_at,
  expires_at,
  is_active
)
values (
  'CJCUP9',
  'CJ Cup launch offer: any size pool for $9',
  false,
  null,
  900,
  25,
  now(),
  '2026-05-25 23:59:59-04'::timestamptz,
  true
)
on conflict (code) do update set
  description = excluded.description,
  free_pool = excluded.free_pool,
  discount_cents = excluded.discount_cents,
  target_amount_cents = excluded.target_amount_cents,
  max_redemptions = excluded.max_redemptions,
  expires_at = excluded.expires_at,
  is_active = true;
