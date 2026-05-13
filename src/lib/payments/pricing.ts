export type PoolPaymentStatus = 'draft' | 'active' | 'payment_due' | 'archived_unpaid' | 'refunded'

export const FREE_ENTRY_LIMIT = 5
export const PRICE_PER_EXTRA_ENTRY_CENTS = 72
export const POOL_PRICE_CAP_CENTS = 2500
export const LIFETIME_ACCESS_CENTS = 20000

export function getPoolPriceTier(activeEntryCount: number) {
  const count = Math.max(0, activeEntryCount)
  const paidEntries = Math.max(0, count - FREE_ENTRY_LIMIT)
  const uncappedAmountCents = paidEntries * PRICE_PER_EXTRA_ENTRY_CENTS
  const amountCents = Math.min(uncappedAmountCents, POOL_PRICE_CAP_CENTS)

  return {
    entryLimit: count,
    amountCents,
    label: count <= FREE_ENTRY_LIMIT
      ? `${FREE_ENTRY_LIMIT} entries free`
      : `72¢ per extra entry, capped at $25`,
  }
}

export function formatMoney(cents: number) {
  const dollars = cents / 100
  return Number.isInteger(dollars) ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`
}

export function getPoolPaymentQuote(activeEntryCount: number, amountPaidCents = 0, hasLifetimeAccess = false) {
  const tier = getPoolPriceTier(activeEntryCount)
  const amountDueCents = hasLifetimeAccess ? 0 : Math.max(0, tier.amountCents - amountPaidCents)

  return {
    activeEntryCount,
    entryLimit: tier.entryLimit,
    tierAmountCents: hasLifetimeAccess ? 0 : tier.amountCents,
    amountPaidCents,
    amountDueCents,
    label: hasLifetimeAccess ? 'Lifetime access' : tier.label,
    requiresCustomQuote: false,
    hasLifetimeAccess,
    lifetimeAccessCents: LIFETIME_ACCESS_CENTS,
  }
}

export function getPoolPaymentStatus(storedStatus: PoolPaymentStatus | string | null | undefined, activeEntryCount: number, amountPaidCents = 0, hasLifetimeAccess = false): PoolPaymentStatus {
  const quote = getPoolPaymentQuote(activeEntryCount, amountPaidCents, hasLifetimeAccess)
  if (quote.amountDueCents <= 0) return 'active'
  if (storedStatus === 'refunded') return 'refunded'
  if (storedStatus === 'archived_unpaid') return 'archived_unpaid'
  if (storedStatus === 'active') return 'payment_due'
  return (storedStatus as PoolPaymentStatus) || 'draft'
}
