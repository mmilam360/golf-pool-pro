-- FIRSTPOOL5 is a standing first-pool offer for Open Championship outreach.
-- It caps the host's first pool checkout at $5. Players still join free.

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
  'FIRSTPOOL5',
  'First pool capped at $5',
  false,
  null,
  500,
  null,
  now(),
  null,
  true
)
on conflict (code) do update set
  description = excluded.description,
  free_pool = excluded.free_pool,
  discount_cents = excluded.discount_cents,
  target_amount_cents = excluded.target_amount_cents,
  max_redemptions = excluded.max_redemptions,
  starts_at = coalesce(public.gpp_promo_codes.starts_at, excluded.starts_at),
  expires_at = excluded.expires_at,
  is_active = true,
  updated_at = now();
