'use client'
import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BoardMetric, ClubhouseBoard } from '@/components/ClubhouseBoard'
import { scoreEntry, rankEntries, type ScoredEntry } from '@/lib/scoring'
import { getPoolPaymentStatus } from '@/lib/payments/pricing'
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
  const clean = name.replace(/^OB Stand-in #/, 'OB ')
  if (clean.startsWith('OB ')) return clean
  const parts = clean.split(' ').filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : clean
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
  const initialActiveEntryCount = initialEntries.filter(entry => !entry.is_removed).length
  const [paymentStatus, setPaymentStatus] = useState(getPoolPaymentStatus(pool.payment_status || 'draft', initialActiveEntryCount, Number(pool.amount_paid_cents || 0)))
  const paymentCardRef = useRef<any>(null)
  const adminSectionRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const activeEntries = entries.filter(e => !e.is_removed)
  const isLocked = poolLocked
  const scoringIsLive = tournament?.status === 'live' || tournament?.status === 'completed'
  const picksAreClosed = isLocked || scoringIsLive
  const paymentCollectionOpen = isLocked || scoringIsLive
  const leaderboardIsHidden = scoringIsLive && paymentStatus !== 'active'
  const canInvitePlayers = !isLocked && !scoringIsLive
  const canSeeAllEntries = isOwner || picksAreClosed
  const visibleEntries = canSeeAllEntries
    ? activeEntries
    : activeEntries.filter(entry => entry.user_id === userId)

  const refreshPoolEntries = useCallback(async () => {
    let query = supabase
      .from('gpp_entries')
      .select('*')
      .eq('pool_id', pool.id)

    if (!canSeeAllEntries) {
      query = query.eq('user_id', userId)
    }

    const { data } = await query.order('created_at', { ascending: true })
    if (data) {
      setEntries(data)
      setMyEntry(data.find(entry => entry.user_id === userId && !entry.is_removed) || null)
    }
  }, [canSeeAllEntries, pool.id, supabase, userId])

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/pool/join?code=${pool.passcode}`)
  }, [pool.passcode])

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
  }, [isOwner, pool.id])

  useEffect(() => {
    refreshPaymentQuote()
  }, [refreshPaymentQuote, activeEntries.length])

  function formatCents(cents: number | null | undefined) {
    if (cents == null) return 'Custom'
    if (cents === 0) return '$0'
    return `$${(cents / 100).toFixed(2)}`
  }

  function reviewActivation() {
    setTab('admin')
    window.setTimeout(() => {
      adminSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
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
      if (paymentQuote.requiresCustomQuote || !paymentQuote.amountDueCents || paymentQuote.amountDueCents <= 0) return
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
        if (!cancelled) setPaymentFeedback('Square checkout could not be loaded yet.')
      }
    }

    mountSquareCard()

    return () => {
      cancelled = true
    }
  }, [isOwner, paymentQuote, paymentCollectionOpen, tab])

  useEffect(() => {
    if (tab === 'admin' && paymentQuote?.paymentStatus !== 'active' && paymentCollectionOpen) return
    if (paymentCardRef.current) {
      paymentCardRef.current.destroy?.()
      paymentCardRef.current = null
      setPaymentCardReady(false)
    }
  }, [tab, paymentQuote?.paymentStatus])

  async function activatePool() {
    if (!paymentQuote) {
      setPaymentFeedback('Payment quote is still loading.')
      return
    }
    if (paymentQuote.requiresCustomQuote) {
      setPaymentFeedback('This pool needs a custom quote.')
      return
    }
    if (!paymentQuote.square.applicationId || !paymentQuote.square.locationId) {
      setPaymentFeedback('Square is not configured yet.')
      return
    }

    if ((paymentQuote.amountDueCents || 0) > 0 && !paymentCollectionOpen) {
      setPaymentFeedback('Payment opens after picks lock.')
      return
    }

    setPaymentLoading(true)
    setStatusMessage('')
    setPaymentFeedback('Processing payment...')
    try {
      const amountDue = paymentQuote.amountDueCents || 0
      let sourceId = 'free-entry-credit'

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
        body: JSON.stringify({ poolId: pool.id, sourceId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Payment failed.')

      setPaymentStatus('active')
      const successMessage = data.amountDueCents === 0 ? 'Pool is active.' : 'Payment received. Pool is active.'
      setPaymentFeedback(successMessage)
      setStatusMessage(successMessage)
      await refreshPaymentQuote()
    } catch (error: any) {
      setPaymentFeedback(error?.message || 'Payment failed.')
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
      setTimeout(() => setStatusMessage(''), 2500)
    }
    setSaving(false)
  }

  function copyToClipboard(value: string, message: string) {
    navigator.clipboard?.writeText(value)
    setStatusMessage(message)
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
      refreshPaymentQuote()
    } else {
      setStatusMessage('Could not lock pool.')
    }
  }

  async function renamePool() {
    const nextName = renameValue.trim()
    if (!nextName) {
      setStatusMessage('Pool name cannot be blank.')
      return
    }
    const { error } = await supabase
      .from('gpp_pools')
      .update({ name: nextName })
      .eq('id', pool.id)
    if (error) {
      setStatusMessage('Could not update pool name.')
      return
    }
    setPoolName(nextName)
    setStatusMessage('Pool name updated.')
    setTimeout(() => setStatusMessage(''), 2500)
  }

  async function deletePool() {
    if (deleteConfirm !== 'DELETE') {
      setStatusMessage('Type DELETE to confirm.')
      return
    }
    const { error: entriesError } = await supabase.from('gpp_entries').delete().eq('pool_id', pool.id)
    if (entriesError) {
      setStatusMessage('Could not delete pool entries.')
      return
    }
    const { error } = await supabase.from('gpp_pools').delete().eq('id', pool.id)
    if (error) {
      setStatusMessage('Could not delete pool.')
      return
    }
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{poolName}</h1>
        <p className="text-stone-600 mt-1">{tournament?.name || 'Tournament'} at {tournament?.course || 'TBD'}</p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-stone-600">Passcode: <span className="text-emerald-700 font-mono font-semibold">{pool.passcode}</span></span>
          <span className="text-stone-600">{activeEntries.length} {activeEntries.length === 1 ? 'entry' : 'entries'}</span>
          <span className="text-stone-600">Field: {field.length || ((tournament?.field_json as GolfPlayer[] | undefined)?.length || 0)} golfers</span>
          {picksAreClosed && <span className="text-amber-700">Picks closed</span>}
          {pool.is_completed && <span className="text-emerald-700">Final results</span>}
        </div>
      </div>

      {statusMessage && <div className="mb-4 rounded-none border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{statusMessage}</div>}

      {isOwner && paymentStatus !== 'active' && (
        <div className="mb-6 rounded-none border-2 border-amber-300 bg-[#fbf7ed] p-4 shadow-[5px_5px_0_#d8cab0]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg font-bold text-emerald-950">{paymentCollectionOpen ? 'Pool fee due' : 'Estimated pool fee'}</p>
              <p className="text-sm text-stone-700">
                {paymentCollectionOpen
                  ? 'Pay once, based on the final entry count, to show results.'
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
            <button onClick={copyInviteCode} className="shrink-0 rounded-none border border-stone-300 p-2 text-emerald-900 hover:bg-emerald-50" aria-label="Copy invite code">
              <CopyIcon />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-none border border-amber-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Link</p>
              <p className="truncate font-mono text-xs text-stone-900">{inviteUrl || `/pool/join?code=${pool.passcode}`}</p>
            </div>
            <button onClick={copyInviteLink} className="shrink-0 rounded-none border border-stone-300 p-2 text-emerald-900 hover:bg-emerald-50" aria-label="Copy invite link">
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
              <p className="font-display text-2xl font-bold text-emerald-950">Leaderboard hidden until pool is activated</p>
              <p className="mx-auto mt-2 max-w-xl text-sm text-stone-700">
                Entries are safe. The host can activate this pool from the Admin tab to restore live standings.
              </p>
              {isOwner && (
                <button onClick={reviewActivation} className="gpp-3d gpp-button-3d gpp-button-wrap mt-5 text-sm">
                  <span className="gpp-button-face px-5 py-2">Activate pool</span>
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
              className="gpp-3d [--gpp-depth-x:10px] [--gpp-depth-y:8px] [--gpp-side-color:#00442c] [--gpp-bottom-color:#003622] md:[--gpp-depth-x:18px] md:[--gpp-depth-y:12px]"
              style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}
            >
              <div className="gpp-3d-face border-[10px] border-[#006241] bg-[#006241] md:border-[16px]">
              <div className="border-2 border-[#111] bg-[#f7f7f2] text-center shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.08),6px_6px_0_rgba(0,0,0,0.18)]">
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
                            {(!scoringIsLive || entry.obStandIns > 0) && (
                              <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                                {scoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
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
                              <div key={i} className="border-r border-t border-[#111] px-1 py-1.5 text-center [&:nth-child(4n)]:border-r-0">
                                <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                <div className="mt-1 truncate text-xs font-black uppercase leading-none tracking-[0.02em] text-[#111]">{pick ? shortName(pick.name) : '—'}</div>
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
                                {(!scoringIsLive || entry.obStandIns > 0) && (
                                  <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                                    {scoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                                  </div>
                                )}
                              </td>
                              {Array.from({ length: pool.count_scores }, (_, i) => {
                                const pick = countingPicks[i]
                                return (
                                  <td key={i} title={pick?.name || ''} className="border-b border-r border-[#111] bg-[#fbfbf5] px-1 py-1 text-center align-middle shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                                    <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                    <div className="mt-0.5 truncate text-xs font-black uppercase leading-none tracking-[0.01em] text-[#111]">{pick ? shortName(pick.name) : '—'}</div>
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
            <div className="gpp-3d-post mx-auto -mb-8 -mt-[10px] h-36 w-16 border-x-4 border-[#003622] bg-[#006241] md:-mb-10 md:h-44 md:w-20" />
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

              {/* Selected picks */}
              <div className="bg-white rounded-none p-4 border border-stone-200 mb-4">
                <h3 className="text-sm font-medium text-stone-700 mb-2">
                  Your Picks ({myPicks.length}/{pool.pick_count})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {myPicks.map(name => (
                    <span key={name} className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      {name}
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
                    {field.sort((a, b) => a.name.localeCompare(b.name)).map(player => {
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
                          <span className="text-sm">{player.name}</span>
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
          <ClubhouseBoard title="Payment" label="Pool fee" subtitle="First 5 entries free" footer="72¢ per extra entry, capped at $25">
            <div className="grid gap-0 sm:grid-cols-3">
              <BoardMetric label="Entries" value={paymentQuote?.activeEntryCount ?? activeEntries.length} tone="green" />
              <BoardMetric label="Rule" value={paymentQuote?.label || 'Loading'} tone="ink" />
              <BoardMetric label="Due" value={formatCents(paymentQuote?.amountDueCents)} />
            </div>
            <div className="px-4 py-4">
              <p className="text-sm font-bold leading-6 text-stone-700">
                {paymentCollectionOpen
                  ? 'Entries are closed. Pay the final pool fee to show results.'
                  : 'This is only an estimate while entries are open. Payment opens after picks lock.'}
              </p>
                {paymentStatus === 'active' ? (
                  <p className="mt-4 rounded-none border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Pool fee handled. Results access is enabled.</p>
                ) : paymentQuote?.requiresCustomQuote ? (
                  <p className="mt-4 rounded-none border border-amber-200 bg-white px-3 py-2 text-sm text-stone-700">Pools over 200 entries need manual pricing for now.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {!paymentCollectionOpen ? (
                      <div className="border border-amber-200 bg-white px-3 py-3 text-sm text-stone-700">
                        Keep adding and removing entries for now. The final fee is collected after picks lock.
                      </div>
                    ) : (
                      <>
                        {!!paymentQuote?.amountDueCents && paymentQuote.amountDueCents > 0 && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2 border-2 border-[#123c2f] bg-[#fbf7ed] px-3 py-3 text-xs font-bold text-stone-700">
                              <span className="inline-flex items-center gap-1.5 text-emerald-800"><TrustCheckIcon /> Secure checkout</span>
                              <span className="hidden h-4 w-px bg-stone-300 sm:block" />
                              <SquareTrustMark />
                              <span className="text-stone-600">Card details are encrypted and processed by Square.</span>
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
                          disabled={paymentLoading || !paymentQuote || (!paymentCardReady && !!paymentQuote?.amountDueCents)}
                          className="w-full border-2 border-[#123c2f] bg-[#123c2f] px-5 py-3 text-sm font-black text-white transition-colors hover:bg-[#0f2f25] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {paymentLoading ? 'Processing...' : paymentQuote?.amountDueCents === 0 ? 'Open results' : `Pay pool fee ${formatCents(paymentQuote?.amountDueCents)}`}
                        </button>
                      </>
                    )}
                    {paymentFeedback && (
                      <p className={`border px-3 py-2 text-xs font-semibold ${paymentFeedback.includes('enabled') || paymentFeedback.includes('active') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : paymentFeedback.includes('Processing') ? 'border-stone-300 bg-white text-stone-700' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                        {paymentFeedback}
                      </p>
                    )}
                    {paymentCollectionOpen && <p className="pt-1 text-xs text-stone-600">Square securely handles card details. Golf Pools Pro never stores card numbers.</p>}
                  </div>
                )}
              </div>
          </ClubhouseBoard>
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

          {/* Entries management */}
          <div className="bg-white rounded-none border border-stone-200 overflow-hidden shadow-[5px_5px_0_#d8cab0]">
            <div className="px-5 py-4 border-b border-stone-200 bg-stone-50">
              <h3 className="text-lg font-semibold text-emerald-950">Manage entries ({activeEntries.length})</h3>
            </div>
            {entries.map(entry => (
              <div key={entry.id} className={`px-5 py-3 border-b border-stone-100 flex items-center justify-between ${entry.is_removed ? 'opacity-40' : ''}`}>
                <div>
                  <p className="font-medium text-stone-900">{entry.display_name}</p>
                  <p className="text-stone-500 text-xs">
                    {((entry.golfer_picks as string[]) || []).length} picks
                    {entry.is_removed && <span className="text-red-700 ml-2">Removed: {entry.removed_reason}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!entry.is_removed && entry.user_id !== userId && (
                    <button onClick={() => setRemoveTarget(entry.id)}
                      className="text-xs text-red-700 hover:text-red-800 px-2">Remove</button>
                  )}
                </div>
              </div>
            ))}
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
