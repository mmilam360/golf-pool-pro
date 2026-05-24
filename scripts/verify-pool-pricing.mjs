import { getPoolPaymentQuote, getPromoDiscountCents } from '../src/lib/payments/pricing.ts'

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

console.log('pool pricing checks passed')
