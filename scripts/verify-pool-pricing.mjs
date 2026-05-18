import { getPoolPaymentQuote, getPromoDiscountCents } from '../src/lib/payments/pricing.ts'

const cases = [
  [5, 0],
  [6, 100],
  [13, 800],
  [30, 2500],
  [100, 2500],
  [101, 4000],
  [140, 4000],
  [200, 4000],
  [201, 5500],
  [550, 9900],
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

console.log('pool pricing checks passed')
