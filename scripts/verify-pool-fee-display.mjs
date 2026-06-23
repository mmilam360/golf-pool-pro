import { derivePoolFeeDisplay } from '../src/lib/pool-fee-display.ts'

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function display(overrides) {
  return derivePoolFeeDisplay({
    paymentStatus: 'active',
    finalAmountDueCents: 0,
    amountPaidCents: 0,
    paymentCollectionOpen: false,
    tournamentIsPastOrCompleted: false,
    tournamentStartDate: '2026-06-25',
    now: new Date('2026-06-23T12:00:00Z'),
    ...overrides,
  })
}

const freeUpcoming = display({
  paymentStatus: 'active',
  finalAmountDueCents: 0,
  amountPaidCents: 0,
  tournamentIsPastOrCompleted: false,
})
assertEqual(freeUpcoming.feeLabel, 'Free', 'upcoming free active pool label')
assertEqual(freeUpcoming.feeStatusLabel, 'Free', 'upcoming free active pool status')
assertEqual(freeUpcoming.feeTimingText, 'No pool fee with the current entry count.', 'upcoming free active pool timing')
assertEqual(freeUpcoming.showPaymentActions, false, 'upcoming free active pool actions')

const paidUpcoming = display({
  paymentStatus: 'active',
  finalAmountDueCents: 0,
  amountPaidCents: 900,
  tournamentIsPastOrCompleted: false,
})
assertEqual(paidUpcoming.feeLabel, 'Paid', 'upcoming paid pool label')
assertEqual(paidUpcoming.feeStatusLabel, 'Paid', 'upcoming paid pool status')
assertEqual(paidUpcoming.feeTimingText, 'Paid. No pool fee due for the current entry count.', 'upcoming paid pool timing')

const closedPast = display({
  paymentStatus: 'active',
  finalAmountDueCents: 0,
  amountPaidCents: 0,
  tournamentIsPastOrCompleted: true,
})
assertEqual(closedPast.feeLabel, 'Closed', 'past free pool label')
assertEqual(closedPast.feeStatusLabel, 'Closed', 'past free pool status')
assertEqual(closedPast.feeTimingText, 'Results are live.', 'past free pool timing')

const unpaidUpcoming = display({
  paymentStatus: 'payment_due',
  finalAmountDueCents: 1300,
  amountPaidCents: 0,
  paymentCollectionOpen: true,
  tournamentIsPastOrCompleted: false,
})
assertEqual(unpaidUpcoming.feeLabel, '$13.00 due', 'upcoming unpaid pool label')
assertEqual(unpaidUpcoming.feeStatusLabel, 'Unpaid', 'upcoming unpaid pool status')
assertEqual(unpaidUpcoming.feeTimingText, 'Final fee is due Saturday of tournament week (06/27/26).', 'upcoming unpaid pool timing')
assertEqual(unpaidUpcoming.showPaymentActions, true, 'upcoming unpaid pool actions')

console.log('pool fee display checks passed')
