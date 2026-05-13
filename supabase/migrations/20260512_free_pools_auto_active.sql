-- Free pools should not require a manual activation step.
-- New pools begin active while they are inside the 5-entry free tier.

alter table public.gpp_pools
  alter column payment_status set default 'active';

update public.gpp_pools p
set
  payment_status = 'active',
  paid_entry_limit = greatest(coalesce(p.paid_entry_limit, 0), entry_counts.active_entry_count),
  activated_at = coalesce(p.activated_at, now())
from (
  select
    p_inner.id,
    count(e.id)::integer as active_entry_count
  from public.gpp_pools p_inner
  left join public.gpp_entries e
    on e.pool_id = p_inner.id
   and coalesce(e.is_removed, false) = false
  group by p_inner.id
) entry_counts
where p.id = entry_counts.id
  and entry_counts.active_entry_count <= 5
  and p.payment_status in ('draft', 'payment_due', 'archived_unpaid');
