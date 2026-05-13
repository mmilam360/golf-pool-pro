-- Promo codes are single-use invite codes, and each user can redeem one promo total.
-- This prevents shared public codes from being reused across multiple pool hosts.

alter table public.gpp_promo_codes
  alter column max_redemptions set default 1;

update public.gpp_promo_codes
set max_redemptions = 1
where max_redemptions is null or max_redemptions <> 1;

-- Retire the early shared seed code. Use generated unique codes instead.
update public.gpp_promo_codes
set is_active = false,
    description = coalesce(description, 'Retired shared code')
where code = 'FIRSTPOOL';

create unique index if not exists gpp_promo_redemptions_code_once_idx
  on public.gpp_promo_redemptions (promo_code_id);

create unique index if not exists gpp_promo_redemptions_user_once_idx
  on public.gpp_promo_redemptions (user_id);
