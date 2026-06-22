import { getPoolPaymentQuote, getPoolPaymentStatus, getPromoDiscountCents } from '../src/lib/payments/pricing.ts'

const cases = [
  [5, 0],
  [6, 100],
  [13, 800],
  [25, 2000],
  [30, 2000],
  [100, 2000],
  [101, 3000],
  [160, 3000],
  [200, 3000],
  [201, 4000],
  [550, 7000],
]

for (const [entries, expected] of cases) {
  const quote = getPoolPaymentQuote(entries)
  if (quote.amountDueCents !== expected) {
    throw new Error(`Expected ${entries} entries to cost ${expected}, got ${quote.amountDueCents}`)
  }
}

const targetPriceDiscount = getPromoDiscountCents(4000, { target_amount_cents: 900 })
if (targetPriceDiscount !== 3100) {
  throw new Error(`Expected target price discount 3100, got ${targetPriceDiscount}`)
}

const noDiscountBelowTarget = getPromoDiscountCents(800, { target_amount_cents: 900 })
if (noDiscountBelowTarget !== 0) {
  throw new Error(`Expected no discount below target price, got ${noDiscountBelowTarget}`)
}

const paymentStatusCases = [
  ['draft', 18, 0, 'payment_due'],
  ['active', 5, 0, 'active'],
  ['active', 18, 0, 'payment_due'],
  ['payment_due', 18, 0, 'payment_due'],
  ['archived_unpaid', 18, 0, 'archived_unpaid'],
  ['archived_unpaid', 5, 0, 'active'],
  ['refunded', 18, 0, 'refunded'],
]

for (const [storedStatus, entries, paid, expected] of paymentStatusCases) {
  const actual = getPoolPaymentStatus(storedStatus, entries, paid)
  if (actual !== expected) {
    throw new Error(`Expected ${storedStatus} with ${entries} entries and ${paid} paid to resolve to ${expected}, got ${actual}`)
  }
}

console.log('pool pricing checks passed')
