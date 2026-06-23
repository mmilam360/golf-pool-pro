import { formatDateOnly } from './date-utils'
import { getTournamentSaturday, isPoolFeePastDue } from './payments/pricing'

export type PoolFeeStatusLabel = 'Paid' | 'Closed' | 'Free' | 'Unpaid'

export type PoolFeeDisplay = {
  paymentStatusForDisplay: string
  showPaymentActions: boolean
  feeDueDate: string | null
  feeLabel: string
  feeStatusLabel: PoolFeeStatusLabel
  feeStatusClass: string
  feeTimingText: string
}

export function formatPoolFeeCents(cents: number | null | undefined) {
  if (cents == null) return 'Custom'
  if (cents === 0) return '$0'
  return `$${(cents / 100).toFixed(2)}`
}

export function formatPoolFeeShortDate(value?: string | Date | null) {
  if (!value) return null
  if (typeof value === 'string') return formatDateOnly(value)
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCFullYear()).slice(-2)}`
}

export function derivePoolFeeDisplay(input: {
  paymentStatus: string
  finalAmountDueCents: number
  amountPaidCents: number
  paymentCollectionOpen: boolean
  tournamentIsPastOrCompleted: boolean
  tournamentStartDate?: string | null
  now?: Date
}): PoolFeeDisplay {
  const paymentStatusForDisplay = input.tournamentIsPastOrCompleted ? 'active' : input.paymentStatus
  const showPaymentActions = !input.tournamentIsPastOrCompleted && input.paymentStatus !== 'active'
  const feeDueDate = formatPoolFeeShortDate(getTournamentSaturday(input.tournamentStartDate))

  const feeLabel = paymentStatusForDisplay === 'active' && input.amountPaidCents > 0
    ? 'Paid'
    : paymentStatusForDisplay === 'active' && input.tournamentIsPastOrCompleted
      ? 'Closed'
      : input.finalAmountDueCents === 0
        ? 'Free'
        : input.paymentCollectionOpen
          ? `${formatPoolFeeCents(input.finalAmountDueCents)} due`
          : `${formatPoolFeeCents(input.finalAmountDueCents)} current fee`

  const feeStatusLabel = paymentStatusForDisplay === 'active' && input.amountPaidCents > 0
    ? 'Paid'
    : paymentStatusForDisplay === 'active' && input.tournamentIsPastOrCompleted
      ? 'Closed'
      : input.finalAmountDueCents === 0
        ? 'Free'
        : paymentStatusForDisplay === 'active'
          ? 'Paid'
          : 'Unpaid'

  const feeStatusClass = feeStatusLabel === 'Paid'
    ? 'border-[#b58a3a] bg-[#fff4cf] text-[#7a5a19]'
    : feeStatusLabel === 'Free'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : input.paymentCollectionOpen
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-stone-300 bg-white text-stone-700'

  const feeTimingText = input.finalAmountDueCents === 0
    ? input.tournamentIsPastOrCompleted
      ? (input.amountPaidCents > 0 ? `Results are live. Amount paid: ${formatPoolFeeCents(input.amountPaidCents)}.` : 'Results are live.')
      : input.amountPaidCents > 0
        ? `Paid. No pool fee due for the current entry count.`
        : 'No pool fee with the current entry count.'
    : paymentStatusForDisplay === 'active'
      ? input.tournamentIsPastOrCompleted
        ? input.amountPaidCents > 0
          ? `Results are live. Amount paid: ${formatPoolFeeCents(input.amountPaidCents)}.`
          : 'Results are live.'
        : input.amountPaidCents > 0
          ? `Paid. Amount paid: ${formatPoolFeeCents(input.amountPaidCents)}.`
          : 'No payment due for the current entry count.'
      : isPoolFeePastDue(input.tournamentStartDate, input.now)
        ? `Payment is due${feeDueDate ? ` by ${feeDueDate}` : ' now'}.`
        : `Final fee is due Saturday of tournament week${feeDueDate ? ` (${feeDueDate})` : ''}.`

  return {
    paymentStatusForDisplay,
    showPaymentActions,
    feeDueDate,
    feeLabel,
    feeStatusLabel,
    feeStatusClass,
    feeTimingText,
  }
}
