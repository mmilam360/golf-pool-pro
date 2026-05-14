'use client'
import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BackButton } from '@/components/BackButton'
import { createClient } from '@/lib/supabase/client'
import { scoreEntry, rankEntries, type ScoredEntry } from '@/lib/scoring'
import { getPoolPaymentStatus, getTournamentSaturday, isPoolFeePastDue } from '@/lib/payments/pricing'
import type { GolfPlayer } from '@/lib/golf-api'

type PaymentQuote = {
  activeEntryCount: number
  entryLimit: number | null
  tierAmountCents: number | null
  amountPaidCents: number
  amountDueCents: number | null
  label: string
  requiresCustomQuote: boolean
  paymentStatus: string
  paidEntryLimit: number
  square: {
    applicationId: string
    locationId: string
    environment: string
  }
}

type AppliedPromo = {
  code: string
  label: string
  discountCents: number
  amountDueCents: number
}

declare global {
  interface Window {
    Square?: any
  }
}

interface Props {
  pool: any
  tournament: any
  entries: any[]
  myEntry: any | null
  isOwner: boolean
  userId: string
}

type Tab = 'leaderboard' | 'my-team' | 'admin'
type ToastTone = 'success' | 'error' | 'info'
type ToastMessage = { id: number; message: string; tone: ToastTone }

function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6" aria-live="polite" aria-atomic="true">
      {toasts.map(toast => {
        const toneClass = toast.tone === 'error'
          ? 'border-[#b21e23] bg-[#fff8f4] text-[#6f1114] shadow-[5px_5px_0_#e0b8ad]'
          : toast.tone === 'success'
            ? 'border-[#123c2f] bg-[#fbf7ed] text-[#123c2f] shadow-[5px_5px_0_#d8cab0]'
            : 'border-stone-300 bg-white text-stone-900 shadow-[5px_5px_0_#d8cab0]'

        return (
          <div key={toast.id} className={`flex items-start justify-between gap-3 rounded-none border-2 px-4 py-3 text-sm font-semibold ${toneClass}`}>
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="-mr-1 border border-current px-1 text-[10px] font-black leading-4 opacity-70 hover:opacity-100"
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}

function formatScore(score: number | null) {
  if (score === null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

function scoreClass(score: number | null) {
  if (score === null) return 'text-stone-400'
  return score < 0 ? 'text-[#b21e23]' : 'text-[#111]'
}

function buildPreScoringEntry(entry: any, countScores: number): ScoredEntry {
  if (entry.picks_hidden) {
    return {
      entryId: entry.id,
      displayName: entry.display_name,
      picks: ['__hidden__'],
      pickScores: Array.from({ length: countScores }, () => ({
        name: 'Picks hidden',
        scoreToPar: null,
        strokes: null,
        thru: '',
        status: 'active' as const,
        counted: true,
        isObStandIn: false,
      })),
      totalScore: null,
      rank: null,
      obStandIns: 0,
    }
  }

  const orderedPicks = ([...(entry.golfer_picks || [])] as string[]).sort((a, b) => a.localeCompare(b))
  const pickScores = orderedPicks.map((name, index) => ({
    name,
    scoreToPar: null,
    strokes: null,
    thru: '',
    status: 'active' as const,
    counted: index < countScores,
    isObStandIn: false,
  }))

  return {
    entryId: entry.id,
    displayName: entry.display_name,
    picks: orderedPicks,
    pickScores,
    totalScore: null,
    rank: null,
    obStandIns: 0,
  }
}

function shortName(name: string) {
  if (name === 'Picks hidden') return 'Hidden'
  const clean = name.replace(/^OB Stand-in #/, 'OB ')
  if (clean.startsWith('OB ')) return clean
  const parts = clean.split(' ').filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : clean
}

function golferListName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return name
  const suffixes = new Set(['Jr.', 'Jr', 'Sr.', 'Sr', 'II', 'III', 'IV', 'V'])
  const suffix = suffixes.has(parts[parts.length - 1]) ? parts.pop() : null
  const lastName = parts.pop()
  const firstNames = parts.join(' ')
  return `${lastName}, ${firstNames}${suffix ? ` ${suffix}` : ''}`
}

function thruLabel(thru?: string) {
  if (!thru) return '—'
  const value = String(thru).toUpperCase()
  return value === 'F' ? 'F' : `THRU ${value}`
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7 7V4.75C7 3.78 7.78 3 8.75 3h6.5C16.22 3 17 3.78 17 4.75v6.5c0 .97-.78 1.75-1.75 1.75H13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" />
      <path d="M3 8.75C3 7.78 3.78 7 4.75 7h6.5c.97 0 1.75.78 1.75 1.75v6.5c0 .97-.78 1.75-1.75 1.75h-6.5C3.78 17 3 16.22 3 15.25v-6.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" />
    </svg>
  )
}

function TrustCheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  )
}

function SquareTrustMark() {
  return (
    <span className="inline-flex items-center gap-2 border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-stone-800">
      <span className="grid h-4 w-4 place-items-center border-2 border-stone-900">
        <span className="h-1.5 w-1.5 bg-stone-900" />
      </span>
      Square
    </span>
  )
}

const REFRESH_SECONDS = 60

export default function PoolView({ pool, tournament, entries: initialEntries, myEntry: initialMyEntry, isOwner, userId }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(initialMyEntry?.golfer_picks?.length ? 'leaderboard' : 'my-team')
  const [entries, setEntries] = useState(initialEntries)
  const [myEntry, setMyEntry] = useState(initialMyEntry)
  const [poolName, setPoolName] = useState(pool.name)
  const [poolLocked, setPoolLocked] = useState(pool.is_locked)
  const [leaderboard, setLeaderboard] = useState<GolfPlayer[]>([])
  const [field, setField] = useState<GolfPlayer[]>([])
  const [myPicks, setMyPicks] = useState<string[]>(initialMyEntry?.golfer_picks || [])
  const [entryNameValue, setEntryNameValue] = useState(initialMyEntry?.display_name || '')
  const [entryNameSaving, setEntryNameSaving] = useState(false)
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_SECONDS)
  const [loadingScores, setLoadingScores] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const [renameValue, setRenameValue] = useState(pool.name)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [paymentQuote, setPaymentQuote] = useState<PaymentQuote | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentCardReady, setPaymentCardReady] = useState(false)
  const [paymentFeedback, setPaymentFeedback] = useState('')
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  const initialActiveEntryCount = initialEntries.filter(entry => !entry.is_removed).length
  const [paymentStatus, setPaymentStatus] = useState(getPoolPaymentStatus(pool.payment_status || 'draft', initialActiveEntryCount, Number(pool.amount_paid_cents || 0)))
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const paymentCardRef = useRef<any>(null)
  const adminSectionRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const dismissToast = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts(current => [...current.slice(-2), { id, message, tone }])
    window.setTimeout(() => dismissToast(id), 3500)
  }, [dismissToast])

  const activeEntries = entries.filter(e => !e.is_removed)
  const isLocked = poolLocked
  const scoringIsLive = tournament?.status === 'live' || tournament?.status === 'completed'
  const picksAreClosed = isLocked || scoringIsLive
  const baseAmountDueCents = paymentQuote?.amountDueCents ?? 0
  const finalAmountDueCents = appliedPromo ? appliedPromo.amountDueCents : baseAmountDueCents
  const paymentCollectionOpen = isLocked || scoringIsLive
  const feeDueDate = formatShortDate(getTournamentSaturday(tournament?.start_date))
  const amountPaidCents = paymentQuote?.amountPaidCents ?? Number(pool.amount_paid_cents || 0)
  const feeLabel = paymentStatus === 'active'
    ? (amountPaidCents > 0 ? 'Paid' : 'Free')
    : finalAmountDueCents === 0
      ? 'Free'
      : paymentCollectionOpen
        ? `${formatCents(finalAmountDueCents)} due`
        : `${formatCents(finalAmountDueCents)} current fee`
  const feeStatusLabel = finalAmountDueCents === 0
    ? 'Free'
    : paymentStatus === 'active'
      ? 'Paid'
      : 'Unpaid'
  const feeStatusClass = paymentStatus === 'active' || finalAmountDueCents === 0
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : paymentCollectionOpen
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-stone-300 bg-white text-stone-700'
  const feeTimingText = finalAmountDueCents === 0
    ? paymentStatus === 'active'
      ? (amountPaidCents > 0 ? `Results are live. Amount paid: ${formatCents(amountPaidCents)}.` : 'Results are live.')
      : 'No pool fee with the current entry count.'
    : paymentStatus === 'active'
      ? `Results are live. Amount paid: ${formatCents(amountPaidCents)}.`
      : isPoolFeePastDue(tournament?.start_date)
        ? `Payment is due${feeDueDate ? ` by ${feeDueDate}` : ' now'}.`
        : `Final fee is due Saturday of tournament week${feeDueDate ? ` (${feeDueDate})` : ''}.`
  const leaderboardIsHidden = isPoolFeePastDue(tournament?.start_date) && paymentStatus !== 'active'
  const canInvitePlayers = isOwner && !isLocked && !scoringIsLive
  const visibleEntries = activeEntries

  const maskHiddenPicks = useCallback((poolEntries: any[]) => {
    if (picksAreClosed) return poolEntries
    return poolEntries.map(entry => {
      const submittedPickCount = Array.isArray(entry.golfer_picks) ? entry.golfer_picks.length : 0
      if (entry.user_id === userId) return entry
      return {
        ...entry,
        submitted_pick_count: submittedPickCount,
        golfer_picks: [],
        picks_hidden: true,
      }
    })
  }, [picksAreClosed, userId])

  const refreshPoolEntries = useCallback(async () => {
    const query = supabase
      .from('gpp_entries')
      .select('*')
      .eq('pool_id', pool.id)

    const { data } = await query.order('created_at', { ascending: true })
    if (data) {
      const safeData = maskHiddenPicks(data)
      setEntries(safeData)
      setMyEntry(safeData.find(entry => entry.user_id === userId && !entry.is_removed) || null)
    }
  }, [maskHiddenPicks, pool.id, supabase, userId])

  useEffect(() => {
    const channel = supabase
      .channel(`gpp_entries:${pool.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gpp_entries', filter: `pool_id=eq.${pool.id}` }, () => {
        refreshPoolEntries()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pool.id, refreshPoolEntries, supabase])

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/pool/join?code=${pool.passcode}`)
  }, [pool.passcode])

  useEffect(() => {
    setEntryNameValue(myEntry?.display_name || '')
  }, [myEntry?.display_name])

  const refreshPaymentQuote = useCallback(async () => {
    if (!isOwner) return
    const res = await fetch('/api/payments/square/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolId: pool.id }),
    })
    if (!res.ok) return
    const quote = await res.json()
    setPaymentQuote(quote)
    setPaymentStatus(quote.paymentStatus || 'draft')
    if ((quote.amountDueCents || 0) <= 0) setAppliedPromo(null)
  }, [isOwner, pool.id])

  useEffect(() => {
    refreshPaymentQuote()
  }, [refreshPaymentQuote, activeEntries.length])

  function formatCents(cents: number | null | undefined) {
    if (cents == null) return 'Custom'
    if (cents === 0) return '$0'
    return `$${(cents / 100).toFixed(2)}`
  }

  function formatShortDate(value?: string | Date | null) {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCFullYear()).slice(-2)}`
  }


  function reviewActivation() {
    setTab('admin')
    window.setTimeout(() => {
      adminSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  async function applyPromoCode() {
    const code = promoCode.trim().toUpperCase()
    if (!code) {
      showToast('Enter a promo code.', 'info')
      return
    }
    if (!paymentQuote || baseAmountDueCents <= 0) {
      showToast('This pool does not need a promo code.', 'info')
      return
    }

    setPromoLoading(true)
    setPaymentFeedback('')
    try {
      const res = await fetch('/api/payments/promo-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: pool.id, code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Promo code could not be applied.')
      setAppliedPromo(data)
      setPromoCode(data.code || code)
      showToast('Promo code applied.', 'success')
    } catch (error: any) {
      const message = error?.message || 'Promo code could not be applied.'
      setAppliedPromo(null)
      setPaymentFeedback(message)
      showToast(message, 'error')
    } finally {
      setPromoLoading(false)
    }
  }

  function squareScriptUrl(environment: string) {
    return environment === 'production'
      ? 'https://web.squarecdn.com/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js'
  }

  async function loadSquareScript(environment: string) {
    if (window.Square) return
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = squareScriptUrl(environment)
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load Square checkout'))
      document.head.appendChild(script)
    })
  }

  useEffect(() => {
    let cancelled = false

    async function mountSquareCard() {
      if (!isOwner || tab !== 'admin' || !paymentQuote || paymentQuote.paymentStatus === 'active') return
      if (!paymentCollectionOpen) return
      if (paymentQuote.requiresCustomQuote || finalAmountDueCents <= 0) return
      if (!paymentQuote.square.applicationId || !paymentQuote.square.locationId) return
      if (paymentCardRef.current) return

      try {
        await loadSquareScript(paymentQuote.square.environment)
        if (cancelled) return
        const payments = window.Square.payments(paymentQuote.square.applicationId, paymentQuote.square.locationId)
        const card = await payments.card()
        await card.attach('#square-card-container')
        if (cancelled) {
          await card.destroy?.()
          return
        }
        paymentCardRef.current = card
        setPaymentCardReady(true)
      } catch {
        if (!cancelled) {
          setPaymentFeedback('Square checkout could not be loaded yet.')
          showToast('Square checkout could not be loaded yet.', 'error')
        }
      }
    }

    mountSquareCard()

    return () => {
      cancelled = true
    }
  }, [finalAmountDueCents, isOwner, paymentQuote, paymentCollectionOpen, showToast, tab])

  useEffect(() => {
    if (tab === 'admin' && paymentQuote?.paymentStatus !== 'active' && paymentCollectionOpen && finalAmountDueCents > 0) return
    if (paymentCardRef.current) {
      paymentCardRef.current.destroy?.()
      paymentCardRef.current = null
      setPaymentCardReady(false)
    }
  }, [finalAmountDueCents, paymentCollectionOpen, tab, paymentQuote?.paymentStatus])

  async function activatePool() {
    if (!paymentQuote) {
      setPaymentFeedback('Payment quote is still loading.')
      showToast('Payment quote is still loading.', 'info')
      return
    }
    if (paymentQuote.requiresCustomQuote) {
      setPaymentFeedback('This pool needs a custom quote.')
      showToast('This pool needs a custom quote.', 'error')
      return
    }
    if (!paymentQuote.square.applicationId || !paymentQuote.square.locationId) {
      setPaymentFeedback('Square is not configured yet.')
      showToast('Square is not configured yet.', 'error')
      return
    }

    if (finalAmountDueCents > 0 && !paymentCollectionOpen) {
      setPaymentFeedback('Payment opens after picks lock.')
      showToast('Payment opens after picks lock.', 'info')
      return
    }

    setPaymentLoading(true)
    setStatusMessage('')
    setPaymentFeedback('Processing payment...')
    try {
      const amountDue = finalAmountDueCents
      let sourceId = appliedPromo && amountDue === 0 ? 'promo-code' : 'free-entry-credit'

      if (amountDue > 0) {
        const card = paymentCardRef.current
        if (!card) {
          throw new Error('Enter payment details first.')
        }
        const result = await card.tokenize()

        if (result.status !== 'OK') {
          throw new Error(result.errors?.[0]?.message || 'Payment could not be started.')
        }
        sourceId = result.token
      }

      const res = await fetch('/api/payments/square/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: pool.id, sourceId, promoCode: appliedPromo?.code || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Payment failed.')

      setPaymentStatus('active')
      const successMessage = data.discountCents > 0 ? 'Promo applied. Pool is active.' : data.amountDueCents === 0 ? 'Pool is active.' : 'Payment received. Pool is active.'
      setPaymentFeedback(successMessage)
      setStatusMessage(successMessage)
      showToast(successMessage, 'success')
      await refreshPaymentQuote()
    } catch (error: any) {
      const message = error?.message || 'Payment failed.'
      setPaymentFeedback(message)
      showToast(message, 'error')
    } finally {
      setPaymentLoading(false)
    }
  }

  // Fetch live leaderboard
  const fetchScores = useCallback(async () => {
    if (!tournament?.external_id) return
    setLoadingScores(true)
    try {
      const res = await fetch(`/api/tournaments/leaderboard?id=${tournament.external_id}`)
      if (res.ok) {
        const data = await res.json()
        const liveLeaderboard = data.leaderboard || []
        if (liveLeaderboard.length > 0) {
          setLeaderboard(liveLeaderboard)
          setField(liveLeaderboard)
        }
      }
      await refreshPoolEntries()
    } catch {}
    setRefreshCountdown(REFRESH_SECONDS)
    setLoadingScores(false)
  }, [refreshPoolEntries, tournament?.external_id])

  useEffect(() => {
    // Load field from tournament data if available
    if (tournament?.field_json) {
      setField(tournament.field_json as GolfPlayer[])
    }
    if (scoringIsLive && tournament?.leaderboard_json) {
      setLeaderboard(tournament.leaderboard_json as GolfPlayer[])
    }
    fetchScores()
    const interval = setInterval(fetchScores, 60000) // refresh every minute
    const countdown = setInterval(() => {
      setRefreshCountdown(prev => (prev <= 1 ? REFRESH_SECONDS : prev - 1))
    }, 1000)
    return () => {
      clearInterval(interval)
      clearInterval(countdown)
    }
  }, [fetchScores, tournament, scoringIsLive])

  // Save picks
  async function savePicks() {
    if (!myEntry) return
    if (picksAreClosed) {
      setStatusMessage('Picks are closed for this pool.')
      showToast('Picks are closed for this pool.', 'error')
      setTimeout(() => setStatusMessage(''), 2500)
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('gpp_entries')
      .update({ golfer_picks: myPicks })
      .eq('id', myEntry.id)
    if (!error) {
      const updatedEntry = { ...myEntry, golfer_picks: myPicks }
      setMyEntry(updatedEntry)
      setEntries(entries.map(entry => entry.id === myEntry.id ? updatedEntry : entry))
      setStatusMessage('Picks saved.')
      showToast('Picks saved.', 'success')
      setTab('leaderboard')
      setTimeout(() => setStatusMessage(''), 2500)
    } else {
      showToast('Could not save picks.', 'error')
    }
    setSaving(false)
  }

  async function saveEntryName() {
    if (!myEntry) return
    const nextName = entryNameValue.trim()
    if (!nextName) {
      setStatusMessage('Entry name cannot be blank.')
      showToast('Entry name cannot be blank.', 'error')
      return
    }
    if (nextName === myEntry.display_name) return

    setEntryNameSaving(true)
    const { error } = await supabase
      .from('gpp_entries')
      .update({ display_name: nextName })
      .eq('id', myEntry.id)
      .eq('user_id', userId)

    if (error) {
      setStatusMessage('Could not update entry name.')
      showToast('Could not update entry name.', 'error')
    } else {
      const updatedEntry = { ...myEntry, display_name: nextName }
      setMyEntry(updatedEntry)
      setEntries(entries.map(entry => entry.id === myEntry.id ? updatedEntry : entry))
      setStatusMessage('Entry name updated.')
      showToast('Entry name updated.', 'success')
      setTimeout(() => setStatusMessage(''), 2500)
    }
    setEntryNameSaving(false)
  }

  async function copyToClipboard(value: string, message: string) {
    const text = value.trim()
    if (!text) {
      setStatusMessage('Nothing to copy yet.')
      showToast('Nothing to copy yet.', 'error')
      return
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(textarea)
        if (!copied) throw new Error('copy failed')
      }
    } catch {
      setStatusMessage('Could not copy. Select and copy it manually.')
      showToast('Could not copy. Select and copy it manually.', 'error')
      return
    }
    setStatusMessage(message)
    showToast(message, 'success')
    setTimeout(() => setStatusMessage(''), 2500)
  }

  function copyInviteLink() {
    copyToClipboard(inviteUrl || `${window.location.origin}/pool/join?code=${pool.passcode}`, 'Invite link copied.')
  }

  function copyInviteCode() {
    copyToClipboard(pool.passcode, 'Invite code copied.')
  }


  // Toggle golfer in picks
  function togglePick(name: string) {
    if (picksAreClosed) return
    setMyPicks(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name)
      if (prev.length >= pool.pick_count) return prev
      return [...prev, name]
    })
  }

  // Remove entry (admin)
  async function removeEntry(entryId: string) {
    const { error } = await supabase
      .from('gpp_entries')
      .update({ is_removed: true, removed_reason: removeReason, removed_at: new Date().toISOString() })
      .eq('id', entryId)
    if (!error) {
      setEntries(entries.map(e => e.id === entryId ? { ...e, is_removed: true, removed_reason: removeReason } : e))
      setRemoveTarget(null); setRemoveReason('')
      showToast('Entry removed.', 'success')
    } else {
      showToast('Could not remove entry.', 'error')
    }
  }

  // Lock pool permanently (admin)
  async function lockPool() {
    if (scoringIsLive || isLocked) return
    const { error } = await supabase
      .from('gpp_pools')
      .update({ is_locked: true })
      .eq('id', pool.id)
    if (!error) {
      setPoolLocked(true)
      setShowLockConfirm(false)
      setStatusMessage('Pool locked. New entries and pick changes are closed.')
      showToast('Pool locked. Picks are closed.', 'success')
      refreshPaymentQuote()
    } else {
      setStatusMessage('Could not lock pool.')
      showToast('Could not lock pool.', 'error')
    }
  }

  async function renamePool() {
    const nextName = renameValue.trim()
    if (!nextName) {
      setStatusMessage('Pool name cannot be blank.')
      showToast('Pool name cannot be blank.', 'error')
      return
    }
    const { error } = await supabase
      .from('gpp_pools')
      .update({ name: nextName })
      .eq('id', pool.id)
    if (error) {
      setStatusMessage('Could not update pool name.')
      showToast('Could not update pool name.', 'error')
      return
    }
    setPoolName(nextName)
    setStatusMessage('Pool name updated.')
    showToast('Pool name updated.', 'success')
    setTimeout(() => setStatusMessage(''), 2500)
  }

  async function deletePool() {
    if (deleteConfirm !== 'DELETE') {
      setStatusMessage('Type DELETE to confirm.')
      showToast('Type DELETE to confirm.', 'error')
      return
    }
    const { error: entriesError } = await supabase.from('gpp_entries').delete().eq('pool_id', pool.id)
    if (entriesError) {
      setStatusMessage('Could not delete pool entries.')
      showToast('Could not delete pool entries.', 'error')
      return
    }
    const { error } = await supabase.from('gpp_pools').delete().eq('id', pool.id)
    if (error) {
      setStatusMessage('Could not delete pool.')
      showToast('Could not delete pool.', 'error')
      return
    }
    showToast('Pool deleted. Sending you back to the dashboard.', 'success')
    router.push('/dashboard')
  }

  // Compute scored entries
  const scoredEntries: ScoredEntry[] = scoringIsLive
    ? rankEntries(
        visibleEntries.map(entry => ({
          ...scoreEntry(
            (entry.golfer_picks as string[]) || [],
            leaderboard,
            { countScores: pool.count_scores, obRuleEnabled: pool.ob_rule_enabled, obPenaltyStrokes: pool.ob_penalty_strokes }
          ),
          entryId: entry.id,
          displayName: entry.display_name,
        }))
      )
    : visibleEntries.map(entry => buildPreScoringEntry(entry, pool.count_scores))

  return (
    <div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {/* Header */}
      <div className="mb-6">
        <BackButton />
        <h1 className="text-3xl font-bold">{poolName}</h1>
        <p className="text-stone-600 mt-1">{tournament?.name || 'Tournament'} at {tournament?.course || 'TBD'}</p>
        {!scoringIsLive && <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-stone-600">Passcode: <span className="text-emerald-700 font-mono font-semibold">{pool.passcode}</span></span>
          <span className="text-stone-600">{activeEntries.length} {activeEntries.length === 1 ? 'entry' : 'entries'}</span>
          <span className="text-stone-600">Field: {field.length || ((tournament?.field_json as GolfPlayer[] | undefined)?.length || 0)} golfers</span>
          {picksAreClosed && <span className="text-amber-700">Picks closed</span>}
          {pool.is_completed && <span className="text-emerald-700">Final results</span>}
        </div>}
      </div>

      {statusMessage && <div className="mb-4 rounded-none border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{statusMessage}</div>}

      {isOwner && paymentStatus !== 'active' && (
        <div className="mb-6 rounded-none border-2 border-amber-300 bg-[#fbf7ed] p-4 shadow-[5px_5px_0_#d8cab0]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg font-bold text-emerald-950">{paymentCollectionOpen ? 'Pool fee due' : 'Estimated pool fee'}</p>
              <p className="text-sm text-stone-700">
                {paymentCollectionOpen
                  ? 'Pay once, based on the final entry count.'
                  : 'Keep entries open for now. Payment opens after picks lock.'}
              </p>
            </div>
            <button onClick={reviewActivation} className="gpp-3d gpp-button-3d gpp-button-wrap text-sm">
              <span className="gpp-button-face px-4 py-2">{paymentCollectionOpen ? 'Pay pool fee' : 'Review estimate'}</span>
            </button>
          </div>
        </div>
      )}

      {canInvitePlayers && <div className="mb-6 rounded-none border border-amber-200 bg-amber-50 p-4 shadow-[5px_5px_0_#d8cab0]">
        <div className="mb-3">
          <p className="text-sm font-semibold text-emerald-950">Invite players</p>
          <p className="text-sm text-stone-700">Send the code or the direct join link.</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-none border border-amber-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Code</p>
              <p className="font-mono text-base font-semibold tracking-[0.08em] text-emerald-900">{pool.passcode}</p>
            </div>
            <button type="button" onClick={copyInviteCode} className="shrink-0 rounded-none border border-stone-300 p-2 text-emerald-900 hover:bg-emerald-50" aria-label="Copy invite code">
              <CopyIcon />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-none border border-amber-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Link</p>
              <p className="truncate font-mono text-xs text-stone-900">{inviteUrl || `/pool/join?code=${pool.passcode}`}</p>
            </div>
            <button type="button" onClick={copyInviteLink} className="shrink-0 rounded-none border border-stone-300 p-2 text-emerald-900 hover:bg-emerald-50" aria-label="Copy invite link">
              <CopyIcon />
            </button>
          </div>
        </div>
      </div>}
      <div className="flex gap-1 mb-6 bg-stone-100 rounded-none p-1 inline-flex border border-stone-200">
        {(['leaderboard', 'my-team', ...(isOwner ? ['admin'] as Tab[] : [])] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-none text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-emerald-900' : 'text-stone-600 hover:text-emerald-800'
            }`}>
            {t === 'leaderboard' ? 'Leaderboard' : t === 'my-team' ? 'My Team' : 'Admin'}
          </button>
        ))}
      </div>

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div>
          {loadingScores && <p className="text-stone-500 text-sm mb-4">Loading scores...</p>}
          {leaderboardIsHidden ? (
            <div className="rounded-none border-2 border-amber-300 bg-[#fbf7ed] p-8 text-center shadow-[5px_5px_0_#d8cab0]">
              <p className="font-display text-2xl font-bold text-emerald-950">Leaderboard hidden until the pool fee is paid</p>
              <p className="mx-auto mt-2 max-w-xl text-sm text-stone-700">
                Entries are safe. The host can activate this pool from the Admin tab to restore live standings.
              </p>
              {isOwner && (
                <button onClick={reviewActivation} className="gpp-3d gpp-button-3d gpp-button-wrap mt-5 text-sm">
                  <span className="gpp-button-face px-5 py-2">Pay pool fee</span>
                </button>
              )}
            </div>
          ) : scoredEntries.length === 0 ? (
            <div className="bg-white rounded-none p-8 border border-stone-200 text-center">
              <p className="text-stone-600">No entries yet. Share passcode <span className="text-emerald-700 font-mono">{pool.passcode}</span></p>
            </div>
          ) : (
            <>
            <div
              className="gpp-3d [--gpp-depth-x:12px] [--gpp-depth-y:8px] [--gpp-side-color:#001f17] [--gpp-bottom-color:#001f17] md:[--gpp-depth-x:22px] md:[--gpp-depth-y:14px]"
              style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}
            >
              <div className="gpp-board-depth-right" aria-hidden="true" />
              <div className="gpp-board-depth-bottom" aria-hidden="true" />
              <div className="gpp-3d-face gpp-board-frame border-[10px] border-[#123c2f] md:border-[16px]">
              <div className="gpp-score-face border-2 border-[#111] bg-[#f7f7f2] text-center">
                <div className="relative border-b-2 border-[#111] px-3 py-2">
                  <p className="text-2xl font-black uppercase leading-none tracking-[0.24em] text-[#111] sm:text-3xl">Leaders</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#005b3c] sm:text-xs">{poolName}</p>
                  <div className="absolute right-2 top-2 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#005b3c]" title="Auto-refresh countdown">
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M13 8a5 5 0 1 1-1.46-3.54" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" />
                      <path d="M13 3v4H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter" />
                    </svg>
                    {refreshCountdown}s
                  </div>
                </div>
                <div className="bg-[#f7f7f2] lg:hidden">
                  {scoredEntries.map((entry, entryIndex) => {
                    const isMe = entry.entryId === myEntry?.id
                    const picksHidden = entry.picks.includes('__hidden__')
                    const countingPicks = entry.pickScores.filter(pick => pick.counted).slice(0, pool.count_scores)
                    const outOfBoundsPicks = entry.pickScores.filter(pick => !pick.counted)
                    return (
                      <details key={entry.entryId} open={entryIndex === 0} className="group border-b-2 border-[#111]">
                        <summary className="grid cursor-pointer list-none grid-cols-[44px_1fr_74px_20px] items-center gap-2 bg-[#f7f7f2] px-2 py-2 text-left [&::-webkit-details-marker]:hidden">
                          <div className="text-center text-xl font-black text-[#b21e23]">{entry.rank || '—'}</div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {isMe && <span aria-label="Your entry" className="h-2 w-2 shrink-0 rounded-full bg-[#005b3c]" />}
                              <span className="truncate text-base font-black uppercase tracking-[0.04em] text-[#111]">{entry.displayName}</span>
                            </div>
                            {(picksHidden || !scoringIsLive || entry.obStandIns > 0) && (
                              <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                                {picksHidden ? 'Picks hidden until lock' : scoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                              </div>
                            )}
                          </div>
                          <div className={`text-right text-2xl font-black ${scoreClass(entry.totalScore)}`}>{formatScore(entry.totalScore)}</div>
                          <div className="flex items-center justify-center text-[#111]">
                            <svg className="h-4 w-4 group-open:hidden" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
                            </svg>
                            <svg className="hidden h-4 w-4 group-open:block" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
                            </svg>
                            <span className="sr-only">Toggle entry</span>
                          </div>
                        </summary>
                        <div className="grid grid-cols-4 border-t border-[#111] bg-[#fbfbf5]">
                          {Array.from({ length: pool.count_scores }, (_, i) => {
                            const pick = countingPicks[i]
                            return (
                              <div key={i} className={`border-r border-t border-[#111] px-1 py-1.5 text-center [&:nth-child(4n)]:border-r-0 ${picksHidden ? 'bg-[#efeee6]' : ''}`}>
                                <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                <div className={`mt-1 truncate text-xs font-black uppercase leading-none tracking-[0.02em] text-[#111] ${picksHidden ? 'blur-[1px]' : ''}`}>{pick ? shortName(pick.name) : '—'}</div>
                                <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? (pick.isObStandIn ? 'OB' : thruLabel(pick.thru)) : '—'}</div>
                              </div>
                            )
                          })}
                        </div>
                        {outOfBoundsPicks.length > 0 && (
                          <div className="border-t-2 border-[#111] bg-[#efeee6] px-2 py-1.5 text-left">
                            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#111]">{scoringIsLive ? 'Out of Bounds Golfers' : 'Other Picks'}</div>
                            <div className="flex flex-wrap gap-1">
                              {outOfBoundsPicks.map(pick => (
                                <span key={`${entry.entryId}-${pick.name}`} className="border border-[#111] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                                  <span className={scoreClass(pick.scoreToPar)}>{formatScore(pick.scoreToPar)}</span> {shortName(pick.name)} <span className="text-[#555]">{pick.isObStandIn ? 'OB' : thruLabel(pick.thru)}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </details>
                    )
                  })}
                </div>
                <div className="hidden bg-[#f7f7f2] lg:block">
                  <table className="w-full table-fixed border-collapse text-[12px] text-[#111]">
                    <thead>
                      <tr className="bg-[#f7f7f2] text-[10px] font-black uppercase tracking-[0.12em] text-[#111]">
                        <th className="w-[5%] border-b-2 border-r-2 border-[#111] bg-[#f7f7f2] px-1 py-1.5 text-center">Rank</th>
                        <th className="w-[19%] border-b-2 border-r-2 border-[#111] bg-[#f7f7f2] px-2 py-1.5 text-left">Entry</th>
                        <th className="border-b-2 border-r-2 border-[#111] px-1 py-1.5 text-center" colSpan={pool.count_scores}>Top {pool.count_scores} golfers</th>
                        <th className="w-[9%] border-b-2 border-[#111] px-1 py-1.5 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoredEntries.map(entry => {
                        const isMe = entry.entryId === myEntry?.id
                        const picksHidden = entry.picks.includes('__hidden__')
                        const countingPicks = entry.pickScores.filter(pick => pick.counted).slice(0, pool.count_scores)
                        const outOfBoundsPicks = entry.pickScores.filter(pick => !pick.counted)
                        return (
                          <Fragment key={entry.entryId}>
                            <tr key={`${entry.entryId}-top`} className="bg-[#f7f7f2]">
                              <td className="border-b border-r-2 border-[#111] bg-[#f7f7f2] px-1 py-1.5 text-center text-xl font-black text-[#b21e23]">
                                {entry.rank || '—'}
                              </td>
                              <td className="border-b border-r-2 border-[#111] bg-[#f7f7f2] px-2 py-1.5 text-left">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  {isMe && <span aria-label="Your entry" className="h-2 w-2 shrink-0 rounded-full bg-[#005b3c]" />}
                                  <span className="truncate text-base font-black uppercase tracking-[0.02em] text-[#111]" title={entry.displayName}>{entry.displayName}</span>
                                </div>
                                {(picksHidden || !scoringIsLive || entry.obStandIns > 0) && (
                                  <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                                    {picksHidden ? 'Picks hidden until lock' : scoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                                  </div>
                                )}
                              </td>
                              {Array.from({ length: pool.count_scores }, (_, i) => {
                                const pick = countingPicks[i]
                                return (
                                  <td key={i} title={picksHidden ? 'Picks hidden until the pool locks' : pick?.name || ''} className={`border-b border-r border-[#111] px-1 py-1 text-center align-middle shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] ${picksHidden ? 'bg-[#efeee6]' : 'bg-[#fbfbf5]'}`}>
                                    <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                    <div className={`mt-0.5 truncate text-xs font-black uppercase leading-none tracking-[0.01em] text-[#111] ${picksHidden ? 'blur-[1px]' : ''}`}>{pick ? shortName(pick.name) : '—'}</div>
                                    <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? (pick.isObStandIn ? 'OB' : thruLabel(pick.thru)) : '—'}</div>
                                  </td>
                                )
                              })}
                              <td className={`border-b border-[#111] bg-[#fbfbf5] px-1 py-1.5 text-center text-3xl font-black ${scoreClass(entry.totalScore)}`}>
                                {formatScore(entry.totalScore)}
                              </td>
                            </tr>
                            {outOfBoundsPicks.length > 0 && (
                              <tr key={`${entry.entryId}-out`} className="bg-[#efeee6]">
                                <td className="border-b border-r-2 border-[#111] bg-[#efeee6]" />
                                <td className="border-b border-r-2 border-[#111] bg-[#efeee6] px-2 py-1 text-left text-[9px] font-black uppercase tracking-[0.1em] text-[#111]">{scoringIsLive ? 'Out of Bounds Golfers' : 'Other Picks'}</td>
                                <td className="border-b border-[#111] bg-[#efeee6] px-2 py-1 text-left" colSpan={pool.count_scores + 1}>
                                  <div className="flex flex-wrap gap-1">
                                    {outOfBoundsPicks.map(pick => (
                                      <span key={`${entry.entryId}-${pick.name}`} className="border border-[#111] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                                        <span className={scoreClass(pick.scoreToPar)}>{formatScore(pick.scoreToPar)}</span> {shortName(pick.name)} <span className="text-[#555]">{pick.isObStandIn ? 'OB' : thruLabel(pick.thru)}</span>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {!scoringIsLive && (
                <p className="mt-2 border-2 border-[#111] bg-[#f7f7f2] px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#111]">Live scoring appears here when the tournament starts.</p>
              )}
            </div>
            </div>
            <div className="gpp-board-post mx-auto -mb-8 -mt-[10px] h-36 w-16 border-x-4 border-[#003622] md:-mb-10 md:h-44 md:w-20" />
            </>
          )}
        </div>
      )}

      {/* My Team Tab */}
      {tab === 'my-team' && (
        <div>
          {!myEntry ? (
            <div className="bg-white rounded-none p-8 border border-stone-200 text-center">
              <p className="text-stone-600">You haven't joined this pool yet.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-stone-600 text-sm">
                  Pick {pool.pick_count} golfers. Best {pool.count_scores} scores count.
                  {picksAreClosed && <span className="ml-2 text-amber-700">Picks are closed.</span>}
                </p>
                {!picksAreClosed && (
                  <button onClick={savePicks} disabled={saving}
                    className="gpp-3d gpp-button-3d gpp-button-wrap text-sm disabled:opacity-50">
                    <span className="gpp-button-face px-5 py-2">{saving ? 'Saving...' : 'Save Picks'}</span>
                  </button>
                )}
              </div>

              <div className="mb-4 rounded-none border border-stone-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-sm font-medium text-stone-700">Entry name</label>
                    <input
                      type="text"
                      value={entryNameValue}
                      onChange={e => setEntryNameValue(e.target.value)}
                      placeholder="Name shown on leaderboard"
                      maxLength={60}
                      className="w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                    <p className="mt-1 text-xs text-stone-500">This is how your entry appears in this pool.</p>
                  </div>
                  <button
                    type="button"
                    onClick={saveEntryName}
                    disabled={entryNameSaving || !entryNameValue.trim() || entryNameValue.trim() === myEntry.display_name}
                    className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black uppercase text-white transition-colors hover:bg-[#0f2f25] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {entryNameSaving ? 'Saving...' : 'Save entry name'}
                  </button>
                </div>
              </div>

              {/* Selected picks */}
              <div className="bg-white rounded-none p-4 border border-stone-200 mb-4">
                <h3 className="text-sm font-medium text-stone-700 mb-2">
                  Your Picks ({myPicks.length}/{pool.pick_count})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {myPicks.map(name => (
                    <span key={name} className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      {golferListName(name)}
                      {!picksAreClosed && (
                        <button onClick={() => togglePick(name)} className="text-emerald-500 hover:text-red-400 ml-1">x</button>
                      )}
                    </span>
                  ))}
                  {myPicks.length === 0 && <span className="text-stone-500 text-sm">No golfers selected yet</span>}
                </div>
              </div>

              {/* Golfer list */}
              {!picksAreClosed && field.length > 0 && (
                <div className="bg-white rounded-none border border-stone-200 overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    {[...field].sort((a, b) => golferListName(a.name).localeCompare(golferListName(b.name))).map(player => {
                      const selected = myPicks.includes(player.name)
                      return (
                        <button key={player.id}
                          onClick={() => togglePick(player.name)}
                          disabled={!selected && myPicks.length >= pool.pick_count}
                          className={`w-full text-left px-4 py-2 flex items-center justify-between border-b border-stone-100 transition-colors ${
                            selected ? 'bg-emerald-50 text-emerald-900' :
                            myPicks.length >= pool.pick_count ? 'text-stone-400 cursor-not-allowed' :
                            'text-stone-800 hover:bg-stone-50'
                          }`}>
                          <span className="text-sm">{golferListName(player.name)}</span>
                          {selected && <span className="text-emerald-400 text-xs">Selected</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {field.length === 0 && (
                <div className="bg-white rounded-none p-8 border border-stone-200 text-center">
                  <p className="text-stone-600">Tournament field not loaded yet. Check back when the tournament is closer.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Admin Tab */}
      {tab === 'admin' && isOwner && (
        <div ref={adminSectionRef} className="scroll-mt-6 space-y-6">
          <section className="border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">Pool fee</p>
                <h3 className="mt-1 text-2xl font-black text-emerald-950">{feeLabel}</h3>
                {paymentStatus === 'active' && amountPaidCents > 0 && (
                  <p className="mt-1 text-sm font-black uppercase tracking-[0.08em] text-emerald-800">Amount paid: {formatCents(amountPaidCents)}</p>
                )}
                <p className="mt-1 text-sm text-stone-600">
                  {(paymentQuote?.activeEntryCount ?? activeEntries.length)} active {(paymentQuote?.activeEntryCount ?? activeEntries.length) === 1 ? 'entry' : 'entries'} · first 5 free · $1 after · $25 max
                </p>
                {feeTimingText && <p className="mt-2 text-sm font-semibold text-stone-700">{feeTimingText}</p>}
                {appliedPromo && (
                  <p className="mt-1 text-sm font-semibold text-emerald-800">{appliedPromo.code}: {formatCents(appliedPromo.discountCents)} off</p>
                )}
              </div>
              <span className={`inline-flex w-fit border px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${feeStatusClass}`}>{feeStatusLabel}</span>
            </div>

            {paymentStatus !== 'active' && paymentQuote?.requiresCustomQuote && (
              <p className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">This pool needs manual pricing.</p>
            )}
            {paymentStatus !== 'active' && !paymentQuote?.requiresCustomQuote && (
              <div className="mt-4 space-y-4">
                {!paymentCollectionOpen ? (
                  <p className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Payment opens after you lock picks.</p>
                ) : (
                  <>
                    {baseAmountDueCents > 0 && (
                      <div className="border border-stone-200 bg-[#fbf7ed]">
                        <button
                          type="button"
                          onClick={() => setPromoOpen(open => !open)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-black uppercase tracking-[0.12em] text-emerald-900"
                        >
                          <span>Promo code</span>
                          <span aria-hidden="true">{promoOpen ? '^' : '⌄'}</span>
                        </button>
                        {promoOpen && (
                          <div className="space-y-2 border-t border-stone-200 bg-white p-3">
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                value={promoCode}
                                onChange={e => {
                                  setPromoCode(e.target.value.toUpperCase())
                                  setAppliedPromo(null)
                                }}
                                placeholder="Enter code"
                                className="min-w-0 flex-1 rounded-none border border-stone-300 bg-white px-3 py-2 text-sm font-bold uppercase tracking-[0.08em] text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                              />
                              <button
                                type="button"
                                onClick={applyPromoCode}
                                disabled={promoLoading || !promoCode.trim()}
                                className="border-2 border-[#123c2f] bg-white px-4 py-2 text-sm font-black text-[#123c2f] transition-colors hover:bg-[#eef7ef] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {promoLoading ? 'Checking...' : 'Apply'}
                              </button>
                            </div>
                            {appliedPromo && (
                              <p className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{appliedPromo.label} · {formatCents(appliedPromo.discountCents)} discount</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {finalAmountDueCents > 0 && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 border border-stone-200 bg-[#fbf7ed] px-3 py-2 text-xs font-semibold text-stone-700">
                          <span className="inline-flex items-center gap-1.5 text-emerald-800"><TrustCheckIcon /> Secure Square checkout</span>
                          <span className="hidden h-4 w-px bg-stone-300 sm:block" />
                          <SquareTrustMark />
                        </div>
                        <div id="square-card-container" className="gpp-square-card-frame" />
                        {!paymentCardReady && (
                          <p className="text-xs font-semibold text-stone-600">Card form is loading.</p>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={activatePool}
                      disabled={paymentLoading || !paymentQuote || (!paymentCardReady && finalAmountDueCents > 0)}
                      className="w-full border-2 border-[#123c2f] bg-[#123c2f] px-5 py-3 text-sm font-black text-white transition-colors hover:bg-[#0f2f25] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {paymentLoading ? 'Processing...' : finalAmountDueCents === 0 ? 'Open results' : `Pay ${formatCents(finalAmountDueCents)}`}
                    </button>
                  </>
                )}
                {paymentFeedback && (
                  <p className={`border px-3 py-2 text-xs font-semibold ${paymentFeedback.includes('enabled') || paymentFeedback.includes('active') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : paymentFeedback.includes('Processing') ? 'border-stone-300 bg-white text-stone-700' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                    {paymentFeedback}
                  </p>
                )}
              </div>
            )}
          </section>
          {/* Entries management */}
          <div className="bg-white rounded-none border border-stone-200 overflow-hidden shadow-[5px_5px_0_#d8cab0]">
            <div className="px-5 py-4 border-b border-stone-200 bg-stone-50">
              <h3 className="text-lg font-semibold text-emerald-950">Manage entries ({activeEntries.length})</h3>
            </div>
            {entries.map(entry => {
              const pickCount = entry.submitted_pick_count ?? ((entry.golfer_picks as string[]) || []).length
              const picksComplete = pickCount >= pool.pick_count
              return (
                <div key={entry.id} className={`px-5 py-3 border-b border-stone-100 flex items-center justify-between gap-3 ${entry.is_removed ? 'opacity-40' : ''}`}>
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900">{entry.display_name}</p>
                    <p className="text-stone-500 text-xs">
                      {pickCount}/{pool.pick_count} Picks
                      {entry.is_removed && <span className="text-red-700 ml-2">Removed: {entry.removed_reason}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!entry.is_removed && (
                      <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${picksComplete ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {picksComplete ? 'Finalized' : `Needs ${pool.pick_count - pickCount}`}
                      </span>
                    )}
                    {!entry.is_removed && entry.user_id !== userId && (
                      <button onClick={() => setRemoveTarget(entry.id)}
                        className="text-xs text-red-700 hover:text-red-800 px-2">Remove</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pool controls */}
          <div className="bg-white rounded-none p-5 border border-stone-200 shadow-[5px_5px_0_#d8cab0]">
            <h3 className="text-lg font-semibold mb-4 text-emerald-950">Pool controls</h3>
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">Pool name</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    className="min-w-0 flex-1 rounded-none border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  <button onClick={renamePool} className="gpp-3d gpp-button-3d gpp-button-wrap text-sm">
                    <span className="gpp-button-face px-4 py-2">Save name</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-stone-600">
                  {scoringIsLive
                    ? 'The event has started. Entries and picks are closed.'
                    : isLocked
                      ? 'Pool is locked. New entries and pick changes are closed permanently.'
                      : 'Pool is open. Lock it only when entries and picks are final.'}
                </p>
                {!scoringIsLive && !isLocked && (
                  <button onClick={() => setShowLockConfirm(true)}
                    className="rounded-none bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500">
                    Lock pool
                  </button>
                )}
              </div>

              <div className="border-t border-red-200 pt-4">
                <p className="text-sm font-semibold text-red-800">Delete pool</p>
                <p className="mt-1 text-sm text-stone-600">This removes the pool and its entries. Type DELETE to confirm.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="min-w-0 flex-1 rounded-none border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100"
                  />
                  <button onClick={deletePool} className="rounded-none bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
                    Delete pool
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Lock confirmation modal */}
          {showLockConfirm && (
            <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-none p-6 border border-amber-300 max-w-sm w-full mx-4 shadow-2xl">
                <h3 className="text-lg font-semibold mb-3 text-emerald-950">Lock pool permanently?</h3>
                <p className="text-stone-700 text-sm mb-3">Once this pool is locked, new entrants cannot be added and picks cannot be changed.</p>
                <p className="text-stone-700 text-sm mb-5">You can still remove entries before paying the final pool fee.</p>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setShowLockConfirm(false)}
                    className="text-stone-600 hover:text-stone-900 px-4 py-2 text-sm">Cancel</button>
                  <button onClick={lockPool}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-none text-sm font-semibold">Lock pool</button>
                </div>
              </div>
            </div>
          )}

          {/* Remove confirmation modal */}
          {removeTarget && (
            <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-none p-6 border border-stone-200 max-w-sm w-full mx-4 shadow-2xl">
                <h3 className="text-lg font-semibold mb-3 text-emerald-950">Remove entry</h3>
                <p className="text-stone-600 text-sm mb-4">Remove this person from the pool? They won't be able to rejoin.</p>
                <input
                  type="text"
                  value={removeReason}
                  onChange={e => setRemoveReason(e.target.value)}
                  placeholder="Reason"
                  className="w-full bg-white border border-stone-300 rounded-none px-4 py-2 text-stone-900 text-sm mb-4 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
                <div className="flex gap-3 justify-end">
                  <button onClick={() => { setRemoveTarget(null); setRemoveReason('') }}
                    className="text-stone-600 hover:text-stone-900 px-4 py-2 text-sm">Cancel</button>
                  <button onClick={() => removeEntry(removeTarget)}
                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-none text-sm">Remove</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
