-- FIRSTPOOL9 is a standing first-pool offer. Limit it by account redemption, not expiration date.

update public.gpp_promo_codes
set
  expires_at = null,
  max_redemptions = null,
  is_active = true,
  updated_at = now()
where code = 'FIRSTPOOL9';
