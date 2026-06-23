export type PoolPaymentStatus = 'draft' | 'active' | 'payment_due' | 'archived_unpaid' | 'refunded'

export const FREE_ENTRY_LIMIT = 5
export const PRICE_PER_EXTRA_ENTRY_CENTS = 100
export const STANDARD_POOL_ENTRY_LIMIT = 100
export const STANDARD_POOL_PRICE_CAP_CENTS = 2000
export const OVERSIZE_ENTRY_BLOCK = 100
export const OVERSIZE_BLOCK_PRICE_CENTS = 1000
export const LIFETIME_ACCESS_CENTS = 20000

type PromoLike = {
  free_pool?: boolean | null
  discount_cents?: number | null
  target_amount_cents?: number | null
}

export function getPoolPriceTier(activeEntryCount: number) {
  const count = Math.max(0, activeEntryCount)
  const paidEntries = Math.max(0, count - FREE_ENTRY_LIMIT)
  const standardAmountCents = Math.min(paidEntries * PRICE_PER_EXTRA_ENTRY_CENTS, STANDARD_POOL_PRICE_CAP_CENTS)
  const oversizeBlocks = count > STANDARD_POOL_ENTRY_LIMIT
    ? Math.ceil((count - STANDARD_POOL_ENTRY_LIMIT) / OVERSIZE_ENTRY_BLOCK)
    : 0
  const amountCents = standardAmountCents + oversizeBlocks * OVERSIZE_BLOCK_PRICE_CENTS

  return {
    entryLimit: count,
    amountCents,
    label: count <= FREE_ENTRY_LIMIT
      ? `${FREE_ENTRY_LIMIT} entries free`
      : count <= STANDARD_POOL_ENTRY_LIMIT
        ? `$1 per extra entry, capped at $20 through 100 entries`
        : `$20 through 100 entries, then $10 per started 100 entries`,
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

export function getPromoDiscountCents(amountDueCents: number, promo: PromoLike | null | undefined) {
  if (!promo || amountDueCents <= 0) return 0
  if (promo.free_pool) return amountDueCents
  if (promo.target_amount_cents !== null && promo.target_amount_cents !== undefined) {
    return Math.max(0, amountDueCents - Math.max(0, Number(promo.target_amount_cents)))
  }
  return Math.min(amountDueCents, Math.max(0, Number(promo.discount_cents || 0)))
}

export function getRedeemedPromoCreditCents(activeEntryCount: number, promo: PromoLike | null | undefined, recordedDiscountCents = 0) {
  const fullPriceQuote = getPoolPaymentQuote(activeEntryCount, 0)
  const currentDiscountCents = getPromoDiscountCents(fullPriceQuote.amountDueCents, promo)
  return Math.max(0, Number(recordedDiscountCents || 0), currentDiscountCents)
}

export function getPoolPaymentStatus(storedStatus: PoolPaymentStatus | string | null | undefined, activeEntryCount: number, amountPaidCents = 0, hasLifetimeAccess = false): PoolPaymentStatus {
  if (storedStatus === 'refunded') return 'refunded'

  const quote = getPoolPaymentQuote(activeEntryCount, amountPaidCents, hasLifetimeAccess)
  if (quote.amountDueCents <= 0) return 'active'
  if (storedStatus === 'archived_unpaid') return 'archived_unpaid'
  return 'payment_due'
}

export function getTournamentSaturday(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const daysUntilSaturday = (6 - date.getUTCDay() + 7) % 7
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + daysUntilSaturday))
}

export function isPoolFeePastDue(tournamentStartDate?: string | null, now = new Date()) {
  const dueDate = getTournamentSaturday(tournamentStartDate)
  if (!dueDate) return false
  const dueDateEndsAt = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate() + 1))
  return now >= dueDateEndsAt
}
