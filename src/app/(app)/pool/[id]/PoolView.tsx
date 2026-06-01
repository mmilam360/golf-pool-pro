'use client'
import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BackButton } from '@/components/BackButton'
import { PoolInvitePrepPanel } from '@/components/PoolInvitePrepPanel'
import { PreviousPlayersInvitePanel } from '@/components/PreviousPlayersInvitePanel'
import { TournamentLeaderboard } from '@/components/TournamentLeaderboard'
import { createClient } from '@/lib/supabase/client'
import { trackGppEvent } from '@/lib/posthog-events'
import { LeverageMarker, LeverageMarkerCorner, LeverageMarkerLegend, ObMarker, ObMarkerCorner } from '@/components/LeverageMarkers'
import { availableCompletedRounds, buildHarePickMap, buildTortoisePickMap, leaderboardForCompletedRound, leaderboardForRoundOnly, normalizePickName, scoreEntriesForLeaderboard, type PickScore, type ScoredEntry } from '@/lib/scoring'
import { getPoolPaymentStatus, getTournamentSaturday, isPoolFeePastDue } from '@/lib/payments/pricing'
import { formatDateOnly, formatDateOnlyWeekday } from '@/lib/date-utils'
import { hasOnCourseScores } from '@/lib/golf-live'
import { leaderboardBackedPickProgressLabel } from '@/lib/golfer-status'
import type { GolfCutLine, GolfPlayer } from '@/lib/golf-api'
import { buildPickGroups, groupForPick, groupPickCounts, validateGroupedPicks, type PickGroup, type PoolGameFormat } from '@/lib/pool-formats'
import { GroupedPickGrid } from '@/components/GroupedPickGrid'

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
  savedCards: {
    id: string
    brand: string | null
    last_4: string | null
    exp_month: number | null
    exp_year: number | null
    is_default: boolean
  }[]
  square: {
    applicationId: string
    locationId: string
    environment: string
  }
  claimedPromo?: {
    code: string
    label: string
    discountCents: number | null
    targetAmountCents: number | null
    freePool: boolean
  } | null
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
  previousPlayerCandidates: { userId: string; displayName: string }[]
  inviteSummary: { pending: number; accepted: number; declined: number }
  publicView?: boolean
}

type Tab = 'leaderboard' | 'my-entry' | 'pool-settings'
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

function getAutoPromoDiscountCents(amountDueCents: number, promo: PaymentQuote['claimedPromo']) {
  if (!promo || amountDueCents <= 0) return 0
  if (promo.freePool) return amountDueCents
  if (promo.targetAmountCents !== null && promo.targetAmountCents !== undefined) return Math.max(0, amountDueCents - Math.max(0, Number(promo.targetAmountCents)))
  return Math.min(amountDueCents, Math.max(0, Number(promo.discountCents || 0)))
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
      todayScore: null,
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
    todayScore: null,
    rank: null,
    obStandIns: 0,
  }
}

function lastNameFor(name: string) {
  const clean = name.replace(/^OB Stand-in #/, 'OB ')
  if (clean.startsWith('OB ')) return clean
  const parts = clean.split(' ').filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : clean
}

function shortName(name: string, peerNames: string[] = []) {
  if (name === 'Picks hidden') return 'Hidden'
  const clean = name.replace(/^OB Stand-in #/, 'OB ')
  if (clean.startsWith('OB ')) return clean
  const parts = clean.split(' ').filter(Boolean)
  if (parts.length <= 1) return clean
  const firstName = parts[0]
  const lastName = parts[parts.length - 1]
  const matchingLastNames = peerNames
    .map(peer => peer.split(' ').filter(Boolean))
    .filter(peerParts => peerParts.length > 1 && lastNameFor(peerParts.join(' ')) === lastName)

  if (matchingLastNames.length <= 1) return lastName

  const firstInitial = firstName[0]
  const initialMatches = matchingLastNames.filter(peerParts => peerParts[0]?.[0] === firstInitial)
  if (initialMatches.length <= 1) return `${firstInitial}. ${lastName}`

  for (let length = 2; length <= firstName.length; length += 1) {
    const prefix = firstName.slice(0, length)
    const prefixMatches = initialMatches.filter(peerParts => peerParts[0]?.startsWith(prefix))
    if (prefixMatches.length === 1) return `${prefix}. ${lastName}`
  }

  return `${firstName}. ${lastName}`
}

function activePoolPickStatusLabel(pick: PickScore, leaderboardByName: Map<string, GolfPlayer>, timeZone: string) {
  return leaderboardBackedPickProgressLabel(pick, leaderboardByName.get(normalizePickName(pick.name)), timeZone)
}

function LivePulseBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 border border-[#b21e23] bg-[#fff1ef] px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#b21e23]">
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping bg-[#b21e23] opacity-70" />
        <span className="relative inline-flex h-2.5 w-2.5 bg-[#b21e23]" />
      </span>
      Live
    </span>
  )
}

function hasRecentOnCourseScores(tournament: any, leaderboard: GolfPlayer[]) {
  if (tournament?.status !== 'live' || !tournament?.last_scores_fetch) return false
  if (!hasOnCourseScores(leaderboard)) return false
  const lastFetchMs = new Date(tournament.last_scores_fetch).getTime()
  if (!Number.isFinite(lastFetchMs)) return false
  return Date.now() - lastFetchMs <= 5 * 60 * 1000
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
const DEFAULT_TEE_TIME_ZONE = 'America/New_York'
const ROUND_MENU_LABELS: Record<number, string> = { 1: 'THURSDAY', 2: 'FRIDAY', 3: 'SATURDAY', 4: 'SUNDAY' }
const ROUND_SCORE_LABELS: Record<number, string> = { 1: 'THU', 2: 'FRI', 3: 'SAT', 4: 'SUN' }

type LeaderboardMode = { type: 'current' } | { type: 'thru'; round: number } | { type: 'day'; round: number }

type FieldUpdateAlert = {
  id: string
  payload: {
    role?: 'entrant' | 'host'
    entryName?: string
    removedPicks?: string[]
    removedCount?: number
    affectedEntries?: Array<{ displayName: string; removed: string[] }>
    affectedCount?: number
    poolName?: string
    tournamentName?: string | null
  }
}

function roundMenuLabel(round: number) {
  return ROUND_MENU_LABELS[round] || `ROUND ${round}`
}

function roundScoreLabel(round: number) {
  return ROUND_SCORE_LABELS[round] || `R${round}`
}

export default function PoolView({ pool, tournament, entries: initialEntries, myEntry: initialMyEntry, isOwner, userId, previousPlayerCandidates, inviteSummary, publicView = false }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(publicView ? 'leaderboard' : initialMyEntry?.golfer_picks?.length ? 'leaderboard' : 'my-entry')
  const [entries, setEntries] = useState(initialEntries)
  const [myEntry, setMyEntry] = useState(initialMyEntry)
  const [poolName, setPoolName] = useState(pool.name)
  const [poolLocked, setPoolLocked] = useState(pool.is_locked)
  const [leaderboard, setLeaderboard] = useState<GolfPlayer[]>(() => Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json as GolfPlayer[] : [])
  const [leaderboardLastUpdated, setLeaderboardLastUpdated] = useState<string | null>(() => tournament?.last_scores_fetch || null)
  const [cutLine, setCutLine] = useState<GolfCutLine | null>(() => tournament?.cutLine || null)
  const [field, setField] = useState<GolfPlayer[]>(() => Array.isArray(tournament?.field_json) ? tournament.field_json as GolfPlayer[] : Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json as GolfPlayer[] : [])
  const [myPicks, setMyPicks] = useState<string[]>(initialMyEntry?.golfer_picks || [])
  const [entryNameValue, setEntryNameValue] = useState(initialMyEntry?.display_name || '')
  const [entryNameSaving, setEntryNameSaving] = useState(false)
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_SECONDS)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [publicLeaderboardUrl, setPublicLeaderboardUrl] = useState('')
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
  const [obRulesOpen, setObRulesOpen] = useState(false)
  const [openEntryIds, setOpenEntryIds] = useState<Set<string>>(() => new Set())
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  const [selectedSavedCardId, setSelectedSavedCardId] = useState('')
  const [saveCard, setSaveCard] = useState(false)
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null)
  const [forceOpenEntryId, setForceOpenEntryId] = useState<string | null>(null)
  const initialActiveEntryCount = initialEntries.filter(entry => !entry.is_removed).length
  const [paymentStatus, setPaymentStatus] = useState(getPoolPaymentStatus(pool.payment_status || 'draft', initialActiveEntryCount, Number(pool.amount_paid_cents || 0)))
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [fieldUpdateAlerts, setFieldUpdateAlerts] = useState<FieldUpdateAlert[]>([])
  const [dismissedFieldUpdateAlertIds, setDismissedFieldUpdateAlertIds] = useState<Set<string>>(() => new Set())
  const [teeTimeZone, setTeeTimeZone] = useState(DEFAULT_TEE_TIME_ZONE)
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>({ type: 'current' })
  const [leaderboardMenuOpen, setLeaderboardMenuOpen] = useState(false)
  const [defaultOpenedEntryId, setDefaultOpenedEntryId] = useState<string | null>(null)
  const [finalizingGroups, setFinalizingGroups] = useState(false)
  const paymentCardRef = useRef<any>(null)
  const adminSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected) setTeeTimeZone(detected)
  }, [])

  useEffect(() => {
    if (window.location.hash === '#make-picks') {
      setTab('my-entry')
      window.setTimeout(() => document.getElementById('make-picks')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
  }, [])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (publicView || !userId) return
    let active = true
    supabase
      .from('gpp_notification_events')
      .select('id, payload, sent_at')
      .eq('pool_id', pool.id)
      .eq('type', 'field_update')
      .order('sent_at', { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (!active) return
        setFieldUpdateAlerts(((data || []) as FieldUpdateAlert[]).filter(alert => alert?.payload))
      })
    return () => { active = false }
  }, [pool.id, publicView, supabase, userId])

  const dismissToast = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts(current => [...current.slice(-2), { id, message, tone }])
    window.setTimeout(() => dismissToast(id), 3500)
  }, [dismissToast])

  const activeEntries = entries.filter(e => !e.is_removed)
  const storedPickGroups: PickGroup[] = Array.isArray(pool.pick_groups_json) ? pool.pick_groups_json : []
  const groupedFormat = pool.game_format === 'ranked_groups' || pool.game_format === 'random_groups'
  const pickGroups: PickGroup[] = useMemo(() => {
    if (!groupedFormat) return []
    if (storedPickGroups.length > 0) return storedPickGroups
    if (!field.length) return []
    return buildPickGroups({
      field,
      format: pool.game_format as PoolGameFormat,
      groupCount: Number(pool.group_count || 6),
      seed: `${pool.id}:${tournament?.id || tournament?.external_id || tournament?.name || 'group-preview'}`,
    })
  }, [field, groupedFormat, pool.game_format, pool.group_count, pool.id, storedPickGroups, tournament?.external_id, tournament?.id, tournament?.name])
  const groupsFinalized = !groupedFormat || (storedPickGroups.length > 0 && Boolean(pool.groups_finalized_at))
  const picksPerGroup = groupedFormat ? Number(pool.picks_per_group || 1) : 0
  const groupName = pool.game_format === 'ranked_groups' ? 'tier' : 'group'
  const groupNamePlural = pool.game_format === 'ranked_groups' ? 'tiers' : 'groups'
  const displayGroupLabel = useCallback((label: string) => (pool.game_format === 'ranked_groups' ? label.replace(/^Group\b/, 'Tier') : label), [pool.game_format])
  const groupedTotalPicks = groupedFormat ? pickGroups.length * picksPerGroup : 0
  const groupedGroupsRemaining = groupedFormat ? pickGroups.filter(group => {
    const selectedCount = group.players.filter(player => myPicks.includes(player.name)).length
    return selectedCount < picksPerGroup
  }).length : 0
  const entriesNeedingPicks = activeEntries.filter(entry => {
    const picks = ((entry.golfer_picks as string[]) || [])
    if (groupedFormat) return !validateGroupedPicks(pickGroups, picks, picksPerGroup).valid
    const pickCount = entry.submitted_pick_count ?? picks.length
    return pickCount < pool.pick_count
  })
  const submittedPickCount = activeEntries.length - entriesNeedingPicks.length
  const isLocked = poolLocked
  const scoringIsLive = tournament?.status === 'live' || tournament?.status === 'completed' || hasOnCourseScores(leaderboard)
  const showLivePulse = hasRecentOnCourseScores(tournament, leaderboard)
  const availableHistoricalRounds = useMemo(() => availableCompletedRounds(leaderboard), [leaderboard])
  const selectedLeaderboard = useMemo(() => {
    if (leaderboardMode.type === 'thru') return leaderboardForCompletedRound(leaderboard, leaderboardMode.round)
    if (leaderboardMode.type === 'day') return leaderboardForRoundOnly(leaderboard, leaderboardMode.round)
    return leaderboard
  }, [leaderboard, leaderboardMode])
  const leaderboardModeIsCurrent = leaderboardMode.type === 'current'
  const selectedBoardLabel = leaderboardMode.type === 'current'
    ? 'Current'
    : leaderboardMode.type === 'thru'
      ? `Thru ${roundMenuLabel(leaderboardMode.round)}`
      : roundMenuLabel(leaderboardMode.round)
  const selectedBoardIsHistorical = !leaderboardModeIsCurrent
  const canShareBoardImage = (pool.is_completed || tournament?.status === 'completed') || (isOwner && selectedBoardIsHistorical)
  const shareBoardImageLabel = selectedBoardIsHistorical ? 'Share board image' : 'Share final results'
  const totalScoreSubLabel = leaderboardMode.type === 'current'
    ? 'TODAY'
    : leaderboardMode.type === 'thru' && leaderboardMode.round > 1
      ? roundScoreLabel(leaderboardMode.round)
      : null
  const selectedScoringIsLive = scoringIsLive || selectedBoardIsHistorical
  useEffect(() => {
    if (!leaderboardModeIsCurrent && !availableHistoricalRounds.includes(leaderboardMode.round)) setLeaderboardMode({ type: 'current' })
  }, [availableHistoricalRounds, leaderboardMode, leaderboardModeIsCurrent])
  const groupsNeedLock = groupedFormat && !groupsFinalized
  const picksAreLocked = isLocked || scoringIsLive
  const pickSelectionOpen = !picksAreLocked && !groupsNeedLock
  const baseAmountDueCents = paymentQuote?.amountDueCents ?? 0
  const finalAmountDueCents = appliedPromo ? appliedPromo.amountDueCents : baseAmountDueCents
  const paymentCollectionOpen = isLocked || scoringIsLive
  const feeDueDate = formatShortDate(getTournamentSaturday(tournament?.start_date))
  const amountPaidCents = paymentQuote?.amountPaidCents ?? Number(pool.amount_paid_cents || 0)
  const savedCards = paymentQuote?.savedCards || []
  const selectedSavedCard = savedCards.find(card => card.id === selectedSavedCardId) || null
  const useSavedCard = Boolean(selectedSavedCard && finalAmountDueCents > 0)
  const feeLabel = paymentStatus === 'active'
    ? (amountPaidCents > 0 ? 'Paid' : 'Free')
    : finalAmountDueCents === 0
      ? 'Free'
      : paymentCollectionOpen
        ? `${formatCents(finalAmountDueCents)} due`
        : `${formatCents(finalAmountDueCents)} current fee`
  const feeStatusLabel = paymentStatus === 'active' && amountPaidCents > 0
    ? 'Paid'
    : finalAmountDueCents === 0
      ? 'Free'
      : paymentStatus === 'active'
        ? 'Paid'
        : 'Unpaid'
  const feeStatusClass = feeStatusLabel === 'Paid'
    ? 'border-[#b58a3a] bg-[#fff4cf] text-[#7a5a19]'
    : feeStatusLabel === 'Free'
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
  const fieldReady = field.length > 0
  const currentFieldNames = useMemo(() => new Set(field.map(player => player.name).filter(Boolean)), [field])
  const invalidMyPicks = !groupedFormat && fieldReady
    ? myPicks.filter(name => !currentFieldNames.has(name))
    : []
  const showGroupedFieldPreview = groupedFormat && groupsNeedLock && pickGroups.length > 0
  const showPickList = (pickSelectionOpen || showGroupedFieldPreview) && (fieldReady || showGroupedFieldPreview)
  const showSelectedPicks = myPicks.length > 0 || (!groupsNeedLock && (fieldReady || showGroupedFieldPreview))
  const visibleEntries = activeEntries

  const maskHiddenPicks = useCallback((poolEntries: any[]) => {
    if (picksAreLocked) return poolEntries
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
  }, [picksAreLocked, userId])

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
    setPublicLeaderboardUrl(`${window.location.origin}/leaderboard/${pool.id}`)
  }, [pool.id, pool.passcode])

  useEffect(() => {
    setEntryNameValue(myEntry?.display_name || '')
  }, [myEntry?.display_name])

  useEffect(() => {
    if (groupedFormat || picksAreLocked || !myEntry || !fieldReady || invalidMyPicks.length === 0) return

    const nextPicks = myPicks.filter(name => currentFieldNames.has(name))
    const updatedEntry = { ...myEntry, golfer_picks: nextPicks }
    setMyPicks(nextPicks)
    setMyEntry(updatedEntry)
    setEntries(current => current.map(entry => entry.id === myEntry.id ? updatedEntry : entry))

    supabase
      .from('gpp_entries')
      .update({ golfer_picks: nextPicks })
      .eq('id', myEntry.id)
      .then(({ error }) => {
        if (error) {
          showToast('Field updated. Review your picks before saving.', 'error')
          return
        }
        showToast('Field updated. Removed golfers no longer in the tournament.', 'info')
      })
  }, [currentFieldNames, fieldReady, groupedFormat, invalidMyPicks.length, myEntry, myPicks, picksAreLocked, showToast, supabase])

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
    if (quote.claimedPromo && (quote.amountDueCents || 0) > 0) {
      const discountCents = getAutoPromoDiscountCents(quote.amountDueCents || 0, quote.claimedPromo)
      if (discountCents > 0) {
        setAppliedPromo({
          code: quote.claimedPromo.code,
          label: quote.claimedPromo.label,
          discountCents,
          amountDueCents: Math.max(0, (quote.amountDueCents || 0) - discountCents),
        })
        setPromoCode(quote.claimedPromo.code)
        setPromoOpen(true)
      } else {
        setAppliedPromo(null)
      }
    } else if ((quote.amountDueCents || 0) <= 0) {
      setAppliedPromo(null)
    }
    if ((quote.savedCards || []).length > 0 && !selectedSavedCardId) {
      setSelectedSavedCardId(quote.savedCards[0].id)
    }
    return quote
  }, [isOwner, pool.id, selectedSavedCardId])

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
    if (typeof value === 'string') return formatDateOnly(value)
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCFullYear()).slice(-2)}`
  }


  function reviewActivation() {
    setTab('pool-settings')
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
      if (!isOwner || tab !== 'pool-settings' || !paymentQuote || paymentQuote.paymentStatus === 'active') return
      if (!paymentCollectionOpen) return
      if (paymentQuote.requiresCustomQuote || finalAmountDueCents <= 0 || useSavedCard) return
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
  }, [finalAmountDueCents, isOwner, paymentQuote, paymentCollectionOpen, showToast, tab, useSavedCard])

  useEffect(() => {
    const shouldKeepCard = isOwner && tab === 'pool-settings' && paymentQuote?.paymentStatus !== 'active' && paymentCollectionOpen && finalAmountDueCents > 0 && !useSavedCard
    if (shouldKeepCard) return
    if (paymentCardRef.current) {
      paymentCardRef.current.destroy?.()
      paymentCardRef.current = null
    }
    setPaymentCardReady(false)
  }, [finalAmountDueCents, isOwner, paymentCollectionOpen, tab, paymentQuote?.paymentStatus, useSavedCard])

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
    trackGppEvent('payment_started', {
      pool_id: pool.id,
      tournament: tournament?.name || null,
      entry_count: activeEntries.length,
      amount_due_cents: finalAmountDueCents,
      has_promo_code: Boolean(appliedPromo),
      uses_saved_card: useSavedCard,
    })
    try {
      const amountDue = finalAmountDueCents
      let sourceId = appliedPromo && amountDue === 0 ? 'promo-code' : 'free-entry-credit'

      if (amountDue > 0 && useSavedCard) {
        sourceId = 'saved-card'
      } else if (amountDue > 0) {
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
        body: JSON.stringify({
          poolId: pool.id,
          sourceId,
          promoCode: appliedPromo?.code || null,
          saveCard: amountDue > 0 && !useSavedCard && saveCard,
          savedCardId: useSavedCard ? selectedSavedCardId : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Payment failed.')

      setPaymentStatus('active')
      const successMessage = data.discountCents > 0 ? 'Promo applied. Pool is active.' : data.amountDueCents === 0 ? 'Pool is active.' : 'Payment received. Pool is active.'
      trackGppEvent('payment_completed', {
        pool_id: pool.id,
        tournament: tournament?.name || null,
        entry_count: activeEntries.length,
        amount_due_cents: finalAmountDueCents,
        amount_paid_cents: data.amountDueCents ?? finalAmountDueCents,
        discount_cents: data.discountCents ?? 0,
        is_paid: true,
      })
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

  // Fetch live leaderboard. Never refresh completed tournaments from ESPN here:
  // ESPN's old-event payload can degrade to anonymous/partial rows, which would
  // overwrite the stored final board in the browser and make finished pools look broken.
  const fetchScores = useCallback(async () => {
    if (!tournament?.external_id || tournament?.status === 'completed') return
    try {
      const res = await fetch(`/api/tournaments/leaderboard?id=${tournament.external_id}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const liveLeaderboard = data.leaderboard || []
        if (liveLeaderboard.length > 0) {
          setLeaderboard(liveLeaderboard)
          // Only overwrite field state when tournament is live, not upcoming.
          // For upcoming events, field comes from server-rendered field_json and
          // should not be replaced by empty or placeholder leaderboard data.
          if (tournament?.status === 'live') {
            setField(liveLeaderboard)
          }
          setLeaderboardLastUpdated(new Date().toISOString())
        }
        setCutLine(data.cutLine || null)
      }
      await refreshPoolEntries()
    } catch {}
    setRefreshCountdown(REFRESH_SECONDS)
  }, [refreshPoolEntries, tournament?.external_id, tournament?.status])

  useEffect(() => {
    // Load field from tournament data if available
    if (tournament?.field_json) {
      setField(tournament.field_json as GolfPlayer[])
    }
    if (scoringIsLive && tournament?.leaderboard_json && leaderboard.length === 0) {
      setLeaderboard(tournament.leaderboard_json as GolfPlayer[])
      setLeaderboardLastUpdated(tournament?.last_scores_fetch || null)
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
  }, [fetchScores, tournament, scoringIsLive, leaderboard.length])

  // Save picks
  async function savePicks() {
    if (!myEntry) return
    if (picksAreLocked || groupsNeedLock) {
      const message = groupsNeedLock ? 'Groups need to lock before picks can be saved.' : 'Picks are closed for this pool.'
      setStatusMessage(message)
      showToast(message, groupsNeedLock ? 'info' : 'error')
      setTimeout(() => setStatusMessage(''), 2500)
      return
    }
    if (!fieldReady && !(groupedFormat && pickGroups.length > 0)) {
      setStatusMessage('Tournament field is not loaded yet.')
      showToast('Tournament field is not loaded yet.', 'info')
      setTimeout(() => setStatusMessage(''), 2500)
      return
    }
    if (groupedFormat) {
      const validation = validateGroupedPicks(pickGroups, myPicks, picksPerGroup)
      if (!validation.valid) {
        const firstMissing = validation.missing[0]?.group.label
        const firstOver = validation.over[0]?.group.label
        const message = firstOver
          ? `${displayGroupLabel(firstOver)} has too many picks.`
          : firstMissing
            ? `${displayGroupLabel(firstMissing)} needs ${picksPerGroup} picks.`
            : `Pick ${picksPerGroup} from each ${groupName}.`
        setStatusMessage(message)
        showToast(message, 'error')
        setTimeout(() => setStatusMessage(''), 2500)
        return
      }
    } else {
      const invalidPicks = myPicks.filter(name => !currentFieldNames.has(name))
      if (invalidPicks.length > 0) {
        const nextPicks = myPicks.filter(name => currentFieldNames.has(name))
        setMyPicks(nextPicks)
        setStatusMessage('Field updated. Removed golfers no longer in the tournament.')
        showToast('Field updated. Removed golfers no longer in the tournament.', 'info')
        setTimeout(() => setStatusMessage(''), 2500)
        return
      }
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

  function jumpToMyEntry() {
    if (!myEntry?.id) return
    setTab('leaderboard')
    setForceOpenEntryId(myEntry.id)
    setHighlightedEntryId(myEntry.id)
    window.setTimeout(() => {
      const targetId = window.matchMedia('(min-width: 1024px)').matches ? `entry-row-${myEntry.id}` : `entry-card-${myEntry.id}`
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    window.setTimeout(() => setHighlightedEntryId(null), 2400)
  }


  // Toggle golfer in picks
  function togglePick(name: string) {
    if (!pickSelectionOpen) return
    setMyPicks(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name)
      if (groupedFormat) {
        const group = groupForPick(pickGroups, name)
        if (!group) return prev
        const groupPickCount = prev.filter(pick => group.players.some(player => player.name === pick)).length
        if (groupPickCount >= picksPerGroup) return prev
      }
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
    if (groupedFormat && !groupsFinalized) {
      showToast('Lock groups before locking picks.', 'error')
      return
    }
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

  async function finalizeGroups() {
    if (!isOwner || !groupedFormat || groupsFinalized || finalizingGroups) return
    setFinalizingGroups(true)
    try {
      const res = await fetch('/api/pools/finalize-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: pool.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        showToast(data.error || 'Could not finalize groups.', 'error')
        return
      }
      showToast('Groups finalized.', 'success')
      router.refresh()
    } catch {
      showToast('Could not finalize groups.', 'error')
    } finally {
      setFinalizingGroups(false)
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
  const scoredEntries: ScoredEntry[] = selectedScoringIsLive
    ? scoreEntriesForLeaderboard(
        visibleEntries,
        selectedLeaderboard,
        { countScores: pool.count_scores, obRuleEnabled: pool.ob_rule_enabled, obPenaltyStrokes: pool.ob_penalty_strokes }
      )
    : visibleEntries.map(entry => buildPreScoringEntry(entry, pool.count_scores))
  function orderPicksForDisplay(picks: PickScore[]) {
    if (!groupedFormat || pickGroups.length === 0) return picks
    const order = new Map<string, number>()
    pickGroups.forEach((group, groupIndex) => {
      group.players.forEach((player, playerIndex) => order.set(normalizePickName(player.name), groupIndex * 1000 + playerIndex))
    })
    return [...picks].sort((a, b) => {
      const aOrder = order.get(normalizePickName(a.name)) ?? 999999
      const bOrder = order.get(normalizePickName(b.name)) ?? 999999
      return aOrder - bOrder || a.name.localeCompare(b.name)
    })
  }
  function pickGroupShortLabel(name?: string) {
    if (!name || !groupedFormat) return null
    const group = groupForPick(pickGroups, name)
    return group ? group.label.replace('Group ', 'G') : null
  }
  useEffect(() => {
    const leaderId = scoredEntries[0]?.entryId
    if (!leaderId || defaultOpenedEntryId) return
    setDefaultOpenedEntryId(leaderId)
    setOpenEntryIds(current => {
      if (current.size > 0 || current.has(leaderId)) return current
      const next = new Set(current)
      next.add(leaderId)
      return next
    })
  }, [defaultOpenedEntryId, scoredEntries])
  const leaderboardRows = selectedLeaderboard.length ? selectedLeaderboard : field
  const leaderboardByName = new Map(leaderboardRows.map(player => [normalizePickName(player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim()), player]))
  const golferNamePeers = leaderboardRows
    .map(player => player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim())
    .filter(Boolean)
  const harePickMap = leaderboardModeIsCurrent && !publicView ? buildHarePickMap(scoredEntries, 2) : new Map()
  const tortoisePickMap = leaderboardModeIsCurrent && !publicView ? buildTortoisePickMap(scoredEntries, myEntry?.id, 2) : new Map()
  const showLeverageLegend = leaderboardModeIsCurrent && !publicView && (harePickMap.size > 0 || tortoisePickMap.size > 0)

  async function copyNeedsPicksReminder() {
    if (!entriesNeedingPicks.length) {
      showToast('Everyone has picks in.', 'success')
      return
    }
    const names = entriesNeedingPicks.map(entry => entry.display_name || 'Player').join('\n')
    const lockDay = formatDateOnlyWeekday(tournament?.start_date) || 'tournament day'
    const message = `Still need picks:\n\n${names}\n\nDon't forget to make your picks before the first tee time ${lockDay} for ${poolName} — ${tournament?.name || 'the tournament'}.${inviteUrl ? `\n\n${inviteUrl}` : ''}`
    try {
      await navigator.clipboard.writeText(message)
      showToast('Reminder copied.', 'success')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = message
      textarea.setAttribute('readonly', 'true')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showToast('Reminder copied.', 'success')
    }
  }

  async function copyPublicLeaderboardLink() {
    const url = publicLeaderboardUrl || `${window.location.origin}/leaderboard/${pool.id}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Public leaderboard link copied.', 'success')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.setAttribute('readonly', 'true')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showToast('Public leaderboard link copied.', 'success')
    }
  }

  async function shareFinalResultsImage() {
    if (scoredEntries.length === 0) {
      showToast('Board image is not ready yet.', 'info')
      return
    }

    const width = 1080
    const height = 1920
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const fitText = (text: string, x: number, y: number, maxWidth: number, font: string, fillStyle: string, align: CanvasTextAlign = 'left') => {
      ctx.font = font
      ctx.fillStyle = fillStyle
      ctx.textAlign = align
      ctx.textBaseline = 'alphabetic'
      const value = text.toUpperCase()
      if (ctx.measureText(value).width <= maxWidth) {
        ctx.fillText(value, x, y)
        return
      }
      let trimmed = value
      while (trimmed.length > 2 && ctx.measureText(`${trimmed}…`).width > maxWidth) trimmed = trimmed.slice(0, -1)
      ctx.fillText(`${trimmed}…`, x, y)
    }

    const loadLogo = () => new Promise<HTMLImageElement | null>(resolve => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => resolve(null)
      image.src = '/brand/golf-pools-pro-wordmark.png'
    })

    const drawRect = (x: number, y: number, w: number, h: number, fill: string, stroke?: string, lineWidth = 1) => {
      ctx.fillStyle = fill
      ctx.fillRect(x, y, w, h)
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = lineWidth
        ctx.strokeRect(x, y, w, h)
      }
    }

    const drawBoardDepth = (x: number, y: number, w: number, h: number, depthX: number, depthY: number) => {
      ctx.fillStyle = '#001f17'
      ctx.beginPath()
      ctx.moveTo(x + w, y)
      ctx.lineTo(x + w + depthX, y + depthY)
      ctx.lineTo(x + w + depthX, y + h + depthY)
      ctx.lineTo(x + w, y + h)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x, y + h)
      ctx.lineTo(x + w, y + h)
      ctx.lineTo(x + w + depthX, y + h + depthY)
      ctx.lineTo(x + depthX, y + h + depthY)
      ctx.closePath()
      ctx.fill()
    }

    const drawPostDepth = (x: number, y: number, w: number, h: number, depthX: number, depthY: number) => {
      ctx.fillStyle = '#001f17'
      ctx.beginPath()
      ctx.moveTo(x + w, y - depthY / 2)
      ctx.lineTo(x + w + depthX, y + depthY / 2)
      ctx.lineTo(x + w + depthX, y + h + depthY)
      ctx.lineTo(x + w, y + h)
      ctx.closePath()
      ctx.fill()
    }

    const drawPostFace = (x: number, y: number, w: number, h: number) => {
      drawRect(x, y, w, h, '#123c2f')
    }

    const boardModeLabel = selectedBoardIsHistorical
      ? leaderboardMode.type === 'day'
        ? `${selectedBoardLabel} scores`
        : `Scores through ${selectedBoardLabel.replace('Thru ', '')}`
      : 'Final board'
    const scoreHeader = selectedBoardIsHistorical && leaderboardMode.type === 'day'
      ? roundScoreLabel(leaderboardMode.round)
      : 'Score'

    drawRect(0, 0, width, height, '#f3ead7')
    for (let x = 0; x <= width; x += 54) drawRect(x, 0, 1, height, 'rgba(60,45,25,0.07)')
    for (let y = 0; y <= height; y += 54) drawRect(0, y, width, 1, 'rgba(60,45,25,0.07)')

    const logo = await loadLogo()
    if (logo) {
      const logoWidth = 420
      const logoHeight = logo.height * (logoWidth / logo.width)
      ctx.drawImage(logo, (width - logoWidth) / 2, 120, logoWidth, logoHeight)
    } else {
      fitText('GOLF POOLS PRO', width / 2, 190, 520, '900 48px Arial', '#123c2f', 'center')
    }

    const boardX = 58
    const boardY = 318
    const boardW = 924
    const frame = 40
    const headH = 200
    const labelH = 54
    const rowCount = Math.min(scoredEntries.length, 5)
    const rowAreaH = 690
    const trimW = 28
    const rowH = (rowAreaH - trimW * 2) / Math.max(rowCount, 1)
    const shareRows = scoredEntries.slice(0, rowCount)
    const topLabel = scoredEntries.length > rowCount
      ? `Top ${rowCount} of ${scoredEntries.length}`
      : rowCount === scoredEntries.length && rowCount > 1
        ? `Full field: ${rowCount}`
        : ''
    const boardModeLine = topLabel ? `${boardModeLabel} · ${topLabel}` : boardModeLabel
    const nameFontSize = rowCount <= 3 ? 56 : rowCount === 4 ? 52 : 48
    const rankFontSize = rowCount <= 3 ? 48 : rowCount === 4 ? 46 : 44
    const scoreFontSize = rowCount <= 3 ? 66 : rowCount === 4 ? 62 : 58
    const rowTextOffset = rowH / 2 + nameFontSize * 0.34
    const scoreTextOffset = rowH / 2 + scoreFontSize * 0.34
    const scoreFaceH = headH + labelH + rowAreaH
    const boardH = scoreFaceH + frame * 2
    const depthX = 48
    const depthY = 32
    const postW = 132
    const postDepthX = depthX
    const postDepthY = depthY
    const postX = boardX + boardW / 2 - postW / 2
    const postY = boardY + boardH + depthY / 2
    const footerBoxY = 1688
    const footerBoxH = 138
    const postH = height - postY + postDepthY

    drawPostDepth(postX, postY, postW, postH, postDepthX, postDepthY)
    drawBoardDepth(boardX, boardY, boardW, boardH, depthX, depthY)
    drawPostFace(postX, postY, postW, postH)
    drawRect(boardX, boardY, boardW, boardH, '#123c2f')

    const faceX = boardX + frame
    const faceY = boardY + frame
    const faceW = boardW - frame * 2
    const tableX = faceX + trimW
    const tableY = faceY + trimW
    const tableW = faceW - trimW * 2
    drawRect(faceX, faceY, faceW, scoreFaceH, '#d8b45d')
    drawRect(tableX, tableY, tableW, scoreFaceH - trimW * 2, '#f7f7f2')

    drawRect(tableX, tableY, tableW, headH, '#f7f7f2')
    ctx.strokeStyle = '#d8cab0'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(tableX, tableY + headH)
    ctx.lineTo(tableX + tableW, tableY + headH)
    ctx.stroke()
    fitText(poolName || 'Golf Pool', width / 2, tableY + 82, tableW - 78, '600 60px Arial', '#111111', 'center')
    fitText(tournament?.name || 'Tournament', width / 2, tableY + 132, tableW - 78, '700 31px Arial', '#005b3c', 'center')
    fitText(boardModeLine, width / 2, tableY + 168, tableW - 78, '700 24px Arial', '#657168', 'center')

    const labelY = tableY + headH
    drawRect(tableX, labelY, tableW, labelH, '#efeee6')
    ctx.strokeStyle = '#d8cab0'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(tableX, labelY + labelH)
    ctx.lineTo(tableX + tableW, labelY + labelH)
    ctx.moveTo(tableX + 112, labelY)
    ctx.lineTo(tableX + 112, labelY + labelH)
    ctx.moveTo(tableX + tableW - 190, labelY)
    ctx.lineTo(tableX + tableW - 190, labelY + labelH)
    ctx.stroke()
    fitText('Rank', tableX + 56, labelY + 35, 88, '800 21px Arial', '#111111', 'center')
    fitText('Entry', tableX + 144, labelY + 35, tableW - 360, '800 21px Arial', '#111111')
    fitText(scoreHeader, tableX + tableW - 95, labelY + 35, 142, '800 21px Arial', '#111111', 'center')

    shareRows.forEach((entry, index) => {
      const y = labelY + labelH + index * rowH
      drawRect(tableX, y, tableW, rowH, index % 2 === 0 ? '#f7f7f2' : '#fbfbf5')
      ctx.strokeStyle = '#d8cab0'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(tableX, y + rowH)
      ctx.lineTo(tableX + tableW, y + rowH)
      ctx.moveTo(tableX + 112, y)
      ctx.lineTo(tableX + 112, y + rowH)
      ctx.moveTo(tableX + tableW - 190, y)
      ctx.lineTo(tableX + tableW - 190, y + rowH)
      ctx.stroke()
      fitText(String(entry.rank || index + 1), tableX + 56, y + rowTextOffset, 90, `800 ${rankFontSize}px Arial`, '#b21e23', 'center')
      fitText(String(entry.displayName || 'Entry'), tableX + 144, y + rowTextOffset, tableW - 374, `600 ${nameFontSize}px Arial`, '#111111')
      fitText(formatScore(entry.totalScore), tableX + tableW - 95, y + scoreTextOffset, 150, `800 ${scoreFontSize}px Arial`, scoreClass(entry.totalScore).includes('b21e23') ? '#b21e23' : '#111111', 'center')
    })

    drawRect(134, footerBoxY, width - 268, footerBoxH, '#fbf7ed', '#123c2f', 6)
    drawRect(144, footerBoxY + 10, width - 288, footerBoxH - 20, 'rgba(255,255,255,0.78)')
    drawRect(178, footerBoxY + 30, width - 356, 8, '#d8b45d')
    drawRect(178, footerBoxY + footerBoxH - 38, width - 356, 8, '#d8b45d')
    fitText('GOLFPOOLSPRO.COM', width / 2, footerBoxY + 88, 650, '900 54px Arial', '#123c2f', 'center')

    canvas.toBlob(async blob => {
      if (!blob) return
      const fileSuffix = selectedBoardIsHistorical ? selectedBoardLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : 'final-results'
      const file = new File([blob], `${poolName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${fileSuffix}.png`, { type: 'image/png' })
      const nav = navigator as any
      if (nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: `${poolName} ${selectedBoardIsHistorical ? selectedBoardLabel : 'final results'}` })
          trackGppEvent('final_share_downloaded', {
            pool_id: pool.id,
            tournament: tournament?.name || null,
            entry_count: activeEntries.length,
            share_method: 'native_share',
            board_type: selectedBoardIsHistorical ? selectedBoardLabel : 'final_results',
          })
          showToast('Board image ready to share.', 'success')
          return
        } catch (error: any) {
          if (error?.name === 'AbortError') return
        }
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
      trackGppEvent('final_share_downloaded', {
        pool_id: pool.id,
        tournament: tournament?.name || null,
        entry_count: activeEntries.length,
        share_method: 'download',
        board_type: selectedBoardIsHistorical ? selectedBoardLabel : 'final_results',
      })
      showToast('Board image downloaded.', 'success')
    }, 'image/png')
  }

  return (
    <div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {/* Header */}
      <div className="mb-6">
        {!publicView ? <BackButton /> : null}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold">{poolName}</h1>
            <p className="mt-1 break-words text-stone-600">{tournament?.name || 'Tournament'} at {tournament?.course || 'TBD'}</p>
          </div>
          {showLivePulse && <LivePulseBadge />}
        </div>
        {!publicView && !scoringIsLive && <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-stone-600">Passcode: <span className="text-emerald-700 font-mono font-semibold">{pool.passcode}</span></span>
          <span className="text-stone-600">{activeEntries.length} {activeEntries.length === 1 ? 'entry' : 'entries'}</span>
          <span className="text-stone-600">Field: {field.length || ((tournament?.field_json as GolfPlayer[] | undefined)?.length || 0)} golfers</span>
          {picksAreLocked && <span className="text-amber-700">Picks closed</span>}
          {!picksAreLocked && groupsNeedLock && <span className="text-amber-700">Groups pending</span>}
          {pool.is_completed && <span className="text-emerald-700">Final results</span>}
        </div>}
      </div>

      {statusMessage && <div className="mb-4 rounded-none border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{statusMessage}</div>}

      {fieldUpdateAlerts.filter(alert => !dismissedFieldUpdateAlertIds.has(alert.id)).map(alert => {
        const payload = alert.payload || {}
        const isHostAlert = payload.role === 'host'
        const affectedCount = Number(payload.affectedCount || 0)
        const removedCount = Number(payload.removedCount || payload.removedPicks?.length || 0)
        const removedNames = Array.isArray(payload.removedPicks) ? payload.removedPicks.join(', ') : ''
        const affectedEntries = Array.isArray(payload.affectedEntries) ? payload.affectedEntries : []
        const poolLabel = payload.poolName || poolName
        const poolLink = typeof window !== 'undefined' ? `${window.location.origin}/pool/${pool.id}` : ''
        const hostCopyMessage = [
          `Heads up — the official field changed for ${poolLabel}.`,
          '',
          'These entries need replacement picks before the tournament starts:',
          ...affectedEntries.map(entry => {
            const removed = Array.isArray(entry.removed) ? entry.removed : []
            return `- ${entry.displayName}: ${removed.length} ${removed.length === 1 ? 'pick' : 'picks'} removed${removed.length ? ` (${removed.join(', ')})` : ''}`
          }),
          '',
          'Please open the pool and fill your open spots before picks lock.',
          poolLink ? `Pool link: ${poolLink}` : '',
        ].filter(Boolean).join('\n')
        return (
          <div key={alert.id} className="mb-4 border-2 border-[#b58a3a] bg-[#fff7dc] p-4 shadow-[5px_5px_0_#d8cab0]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7a5a19]">Official field changed</p>
                <p className="mt-1 text-lg font-black leading-6 text-[#123c2f]">
                  {isHostAlert
                    ? `${affectedCount} ${affectedCount === 1 ? 'entry needs' : 'entries need'} replacement picks.`
                    : `${removedCount} ${removedCount === 1 ? 'golfer was' : 'golfers were'} removed from your entry.`}
                </p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#5f4617]">
                  {isHostAlert
                    ? 'The field refreshed before lock. Check the affected entries and remind players to fill their open spots.'
                    : `Make replacement picks before the tournament starts.${removedNames ? ` Removed: ${removedNames}.` : ''}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTab('my-entry')
                    window.setTimeout(() => document.getElementById('make-picks')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
                  }}
                  className="border-2 border-[#123c2f] bg-[#123c2f] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-white"
                >
                  {isHostAlert ? 'Review pool' : 'Make picks'}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedFieldUpdateAlertIds(current => new Set(current).add(alert.id))}
                  className="border-2 border-[#123c2f] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#123c2f]"
                >
                  Dismiss
                </button>
              </div>
            </div>
            {isHostAlert && affectedEntries.length > 0 && (
              <div className="mt-4 border-2 border-[#d8cab0] bg-white p-3">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#123c2f]">Group chat message</p>
                    <p className="mt-1 text-xs font-semibold text-stone-600">Names are filled in. Copy this and drop it into your group chat.</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(hostCopyMessage)
                        showToast('Message copied.', 'success')
                      } catch {
                        showToast('Could not copy. Select the text box and copy it.', 'error')
                      }
                    }}
                    className="border-2 border-[#123c2f] bg-[#fbf7ed] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#123c2f]"
                  >
                    Copy message
                  </button>
                </div>
                <textarea
                  readOnly
                  value={hostCopyMessage}
                  rows={Math.min(8, Math.max(5, hostCopyMessage.split('\n').length))}
                  onFocus={event => event.currentTarget.select()}
                  className="w-full resize-y border border-[#d8cab0] bg-[#fbf7ed] p-3 font-mono text-xs leading-5 text-[#1f2a24] outline-none"
                />
              </div>
            )}
          </div>
        )
      })}

      {!publicView && isOwner && groupedFormat && !groupsFinalized && (
        <div className="mb-6 rounded-none border-2 border-[#123c2f] bg-[#fbf7ed] p-4 shadow-[5px_5px_0_#d8cab0]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg font-bold text-emerald-950">{pool.game_format === 'ranked_groups' ? 'Tiers are not locked yet.' : 'Groups are not locked yet.'}</p>
              <p className="mt-1 text-sm text-stone-700">{pool.game_format === 'ranked_groups' ? 'Tiers' : 'Groups'} auto-lock Tuesday morning of tournament week. You can lock them sooner once the official field is posted.</p>
            </div>
            <button
              type="button"
              onClick={finalizeGroups}
              disabled={finalizingGroups}
              className="gpp-3d gpp-button-3d gpp-button-wrap text-sm disabled:opacity-50"
            >
              <span className="gpp-button-face px-4 py-2">{finalizingGroups ? 'Locking...' : `Lock ${groupNamePlural} now`}</span>
            </button>
          </div>
        </div>
      )}

      {!publicView && groupedFormat && groupsNeedLock && (
        <section className="mb-6 overflow-hidden rounded-none border-2 border-[#123c2f] bg-white shadow-[5px_5px_0_#d8cab0]">
          <div className="border-b border-[#d8cab0] bg-[#fbf7ed] px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#123c2f]">{pool.game_format === 'ranked_groups' ? 'Tier preview' : 'Group preview'}</p>
            <p className="mt-1 text-sm font-semibold text-stone-700">
              {pickGroups.length > 0 || fieldReady
                ? `Current field view. Picks unlock after the pool runner locks ${groupNamePlural}.`
                : 'The field is not posted yet. This preview appears as soon as golfers load.'}
            </p>
          </div>
          {(pickGroups.length > 0 || fieldReady) ? (
            <div className="max-h-[28rem] overflow-y-auto p-2 sm:p-3">
              {pickGroups.length > 0 ? (
                <GroupedPickGrid
                  pickGroups={pickGroups}
                  myPicks={[]}
                  picksPerGroup={picksPerGroup}
                  readOnly={true}
                  golferListName={golferListName}
                  onTogglePick={() => {}}
                  groupLabelForDisplay={displayGroupLabel}
                  allSelectedCount={0}
                />
              ) : (
                [...field].sort((a, b) => golferListName(a.name).localeCompare(golferListName(b.name))).map(player => (
                  <div key={player.id || player.name}
                    className="flex w-full items-center justify-between border-b border-[#eadfca] px-4 py-2.5 text-left text-stone-500">
                    <span className="text-sm font-semibold">{golferListName(player.name)}</span>
                    <span className="border border-stone-300 bg-stone-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-stone-500">Field</span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="px-4 py-5 text-sm font-semibold text-stone-600">Check back closer to the tournament. The field will show here before picks open.</div>
          )}
        </section>
      )}

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

      {!publicView && canInvitePlayers && (
        <div className="mb-6">
          <PoolInvitePrepPanel
            poolName={poolName}
            tournamentName={tournament?.name || 'Tournament'}
            startDateLabel={formatShortDate(tournament?.start_date) || 'Date TBA'}
            entryCount={activeEntries.length}
            submittedPickCount={submittedPickCount}
            passcode={pool.passcode}
            joinLink={inviteUrl || `/pool/join?code=${pool.passcode}`}
            pickCount={pool.pick_count}
            countScores={pool.count_scores}
            posterHref={`/pool/${pool.id}/poster`}
            previousPlayerInviteNode={
              <PreviousPlayersInvitePanel
                poolId={pool.id}
                candidates={previousPlayerCandidates}
                summary={inviteSummary}
              />
            }
          />
        </div>
      )}
      {!publicView && (
      <div className="flex gap-1 mb-6 bg-stone-100 rounded-none p-1 inline-flex border border-stone-200">
        {(['leaderboard', 'my-entry', ...(isOwner ? ['pool-settings'] as Tab[] : [])] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-none text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-emerald-900' : 'text-stone-600 hover:text-emerald-800'
            }`}>
            {t === 'leaderboard' ? 'Leaderboard' : t === 'my-entry' ? 'My Entry' : 'Pool Settings'}
          </button>
        ))}
      </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div>
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
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              {canShareBoardImage && (
                <button
                  type="button"
                  onClick={shareFinalResultsImage}
                  className="border border-[#d8cab0] bg-[#fbf7ed] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#657168] transition-colors hover:border-[#123c2f] hover:bg-white hover:text-[#123c2f]"
                >
                  {shareBoardImageLabel}
                </button>
              )}
              {myEntry && scoredEntries.length >= 10 && scoredEntries.some(entry => entry.entryId === myEntry.id) && (
                <button
                  type="button"
                  onClick={jumpToMyEntry}
                  className="border-2 border-[#123c2f] bg-[#fbf7ed] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#123c2f] transition-colors hover:bg-white"
                >
                  Jump to my entry
                </button>
              )}
            </div>
            <div
              className="gpp-3d [--gpp-depth-x:12px] [--gpp-depth-y:8px] [--gpp-side-color:#001f17] [--gpp-bottom-color:#001f17] md:[--gpp-depth-x:22px] md:[--gpp-depth-y:14px]"
              style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}
            >
              <div className="gpp-board-depth-right" aria-hidden="true" />
              <div className="gpp-board-depth-bottom" aria-hidden="true" />
              <div className="gpp-3d-face gpp-board-frame border-[10px] border-[#123c2f] md:border-[16px]">
              <div className="gpp-score-face border-2 border-[#d8b45d] bg-[#f7f7f2] text-center">
                <div className="relative border-b-2 border-[#d8cab0] px-3 py-2">
                  <p className="mx-auto max-w-[84%] truncate text-xl font-black uppercase leading-none tracking-[0.1em] text-[#111] sm:max-w-[88%] sm:text-3xl sm:tracking-[0.16em]" title={tournament?.name || 'Leaderboard'}>{tournament?.name || 'Leaderboard'}</p>
                  <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#005b3c] sm:text-xs">{poolName}</p>
                  {availableHistoricalRounds.length > 0 && (
                    <details
                      className="relative z-50 mx-auto mt-2 w-fit text-left"
                      open={leaderboardMenuOpen}
                      onToggle={event => setLeaderboardMenuOpen(event.currentTarget.open)}
                    >
                      <summary className="list-none border-2 border-[#123c2f] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#123c2f] shadow-[2px_2px_0_#d8cab0] marker:hidden [&::-webkit-details-marker]:hidden">
                        <span className="mr-2 text-[#657168]">View</span>{selectedBoardLabel}
                        <span className="ml-2 inline-block text-[#123c2f]">▾</span>
                      </summary>
                      <div className="absolute left-1/2 top-[calc(100%+6px)] z-[220] w-44 -translate-x-1/2 border-2 border-[#123c2f] bg-[#fffdf8] p-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#123c2f] shadow-[5px_5px_0_#d8cab0]">
                        <button
                          type="button"
                          onClick={() => { setLeaderboardMode({ type: 'current' }); setLeaderboardMenuOpen(false) }}
                          className={`block w-full px-3 py-2 text-left ${leaderboardMode.type === 'current' ? 'bg-[#fbf7ed] shadow-[inset_4px_0_0_#b58a3a]' : 'border-b border-[#d8cab0]'}`}
                        >
                          Current
                        </button>
                        {availableHistoricalRounds.map(round => (
                          <div key={round} className="border-b border-[#d8cab0] py-1 last:border-b-0">
                            <div className="px-3 pb-1 pt-2 text-[9px] text-[#657168]">{roundMenuLabel(round)}</div>
                            <button
                              type="button"
                              onClick={() => { setLeaderboardMode({ type: 'thru', round }); setLeaderboardMenuOpen(false) }}
                              className={`block w-full px-3 py-2 text-left ${leaderboardMode.type === 'thru' && leaderboardMode.round === round ? 'bg-[#fbf7ed] shadow-[inset_4px_0_0_#b58a3a]' : ''}`}
                            >
                              Scores Through
                            </button>
                            <button
                              type="button"
                              onClick={() => { setLeaderboardMode({ type: 'day', round }); setLeaderboardMenuOpen(false) }}
                              className={`block w-full px-3 py-2 text-left ${leaderboardMode.type === 'day' && leaderboardMode.round === round ? 'bg-[#fbf7ed] shadow-[inset_4px_0_0_#b58a3a]' : ''}`}
                            >
                              Daily Winner
                            </button>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {selectedBoardIsHistorical ? <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#657168]">{leaderboardMode.type === 'day' ? `${selectedBoardLabel} daily scores only` : `Standings through ${selectedBoardLabel.replace('Thru ', '')}`}</p> : null}
                  {!selectedBoardIsHistorical && <div className="absolute right-2 top-2 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#005b3c]" title="Auto-refresh countdown">
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M13 8a5 5 0 1 1-1.46-3.54" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" />
                      <path d="M13 3v4H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter" />
                    </svg>
                    {refreshCountdown}s
                  </div>}
                </div>
                <div className="bg-[#f7f7f2] lg:hidden">
                  {scoredEntries.map((entry) => {
                    const isMe = entry.entryId === myEntry?.id
                    const picksHidden = entry.picks.includes('__hidden__')
                    const countingPicks = orderPicksForDisplay(entry.pickScores.filter(pick => pick.counted)).slice(0, pool.count_scores)
                    const outOfBoundsPicks = orderPicksForDisplay(entry.pickScores.filter(pick => !pick.counted))
                    const allPickNames = golferNamePeers
                    const hareNames = isMe ? harePickMap.get(entry.entryId) : undefined
                    const tortoiseNames = !isMe ? tortoisePickMap.get(entry.entryId) : undefined
                    const isEntryOpen = openEntryIds.has(entry.entryId) || forceOpenEntryId === entry.entryId
                    return (
                      <details
                        id={`entry-card-${entry.entryId}`}
                        key={entry.entryId}
                        open={isEntryOpen}
                        onToggle={event => {
                          const open = event.currentTarget.open
                          setOpenEntryIds(current => {
                            const next = new Set(current)
                            if (open) next.add(entry.entryId)
                            else next.delete(entry.entryId)
                            return next
                          })
                        }}
                        className={`group border-b-2 border-[#d8cab0] transition-colors ${highlightedEntryId === entry.entryId ? 'bg-[#fff4cf]' : ''}`}
                      >
                        <summary className={`grid min-h-[58px] cursor-pointer list-none grid-cols-[34px_minmax(0,1fr)_58px_18px] items-center gap-1 px-2 py-2 text-left transition-colors hover:bg-[#fffdf4] group-open:bg-[#fffdf4] sm:grid-cols-[44px_minmax(0,1fr)_74px_20px] sm:gap-2 [&::-webkit-details-marker]:hidden ${highlightedEntryId === entry.entryId ? 'bg-[#fff4cf]' : 'bg-[#f7f7f2]'}`}>
                          <div className="text-center text-xl font-black text-[#b21e23]">{entry.rank || '—'}</div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {isMe && <span aria-label="Your entry" className="h-2.5 w-2.5 shrink-0 bg-[#005b3c]" />}
                              <span className="min-w-0 flex-1 break-words text-sm font-black uppercase leading-tight tracking-[0.02em] text-[#111] sm:text-base sm:tracking-[0.04em]">{entry.displayName}</span>
                            </div>
                            {(picksHidden || !selectedScoringIsLive || entry.obStandIns > 0) && (
                              <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                                {picksHidden ? 'Picks hidden until lock' : selectedScoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-black leading-none ${scoreClass(entry.totalScore)}`}>{formatScore(entry.totalScore)}</div>
                            {totalScoreSubLabel && entry.todayScore !== null ? (
                              <div className="mt-0.5 whitespace-nowrap text-[8px] font-black uppercase tracking-normal text-[#777] sm:text-[9px] sm:tracking-[0.08em]">{totalScoreSubLabel}: {formatScore(entry.todayScore)}</div>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-center text-[#111]" aria-label={isEntryOpen ? 'Collapse entry' : 'Expand entry'}>
                            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d={isEntryOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
                            </svg>
                            <span className="sr-only">Toggle entry</span>
                          </div>
                        </summary>
                        <div className="grid grid-cols-4 border-t border-[#d8cab0] bg-[#fbfbf5]">
                          {Array.from({ length: pool.count_scores }, (_, i) => {
                            const pick = countingPicks[i]
                            return (
                              <div key={i} className={`relative border-r border-t border-[#d8cab0] px-1 py-1.5 text-center [&:nth-child(4n)]:border-r-0 ${picksHidden ? 'bg-[#efeee6]' : ''}`}>
                                <>{pick?.isObStandIn ? <ObMarkerCorner /> : <LeverageMarkerCorner kind={pick && hareNames?.has(normalizePickName(pick.name)) ? 'hare' : pick && tortoiseNames?.has(normalizePickName(pick.name)) ? 'tortoise' : undefined} />}</>
                                <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                <div className={`mt-1 truncate text-[clamp(8px,2.2vw,10px)] font-black uppercase leading-none tracking-[-0.03em] text-[#111] sm:text-xs sm:tracking-[-0.01em] ${picksHidden ? 'blur-[1px]' : ''}`}>
                                  {pick ? shortName(pick.name, allPickNames) : '—'}
                                </div>
                                <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? [pickGroupShortLabel(pick.name), activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)].filter(Boolean).join(' · ') : '—'}</div>
                              </div>
                            )
                          })}
                        </div>
                        {outOfBoundsPicks.length > 0 && (
                          <div className="border-t-2 border-[#d8cab0] bg-[#efeee6] px-2 py-1.5 text-left">
                            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#111]">Outside Top {pool.count_scores}</div>
                            <div className="flex flex-wrap gap-1">
                              {outOfBoundsPicks.map(pick => (
                                <span key={`${entry.entryId}-${pick.name}`} className="inline-flex items-center gap-1 border border-[#d8cab0] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                                  {pick.isObStandIn ? <ObMarker /> : null}
                                  {hareNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="hare" /> : null}
                                  {tortoiseNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="tortoise" /> : null}
                                  <span><span className={scoreClass(pick.scoreToPar)}>{formatScore(pick.scoreToPar)}</span> {shortName(pick.name, allPickNames)} <span className="text-[#555]">{activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)}</span></span>
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
                        <th className="w-[5%] border-b-2 border-r-2 border-[#d8cab0] bg-[#f7f7f2] px-1 py-1.5 text-center">Rank</th>
                        <th className="w-[19%] border-b-2 border-r-2 border-[#d8cab0] bg-[#f7f7f2] px-2 py-1.5 text-left">Entry</th>
                        <th className="border-b-2 border-r-2 border-[#d8cab0] px-1 py-1.5 text-center" colSpan={pool.count_scores}>Top {pool.count_scores} golfers</th>
                        <th className="w-[9%] border-b-2 border-[#d8cab0] px-1 py-1.5 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoredEntries.map(entry => {
                        const isMe = entry.entryId === myEntry?.id
                        const picksHidden = entry.picks.includes('__hidden__')
                        const countingPicks = orderPicksForDisplay(entry.pickScores.filter(pick => pick.counted)).slice(0, pool.count_scores)
                        const outOfBoundsPicks = orderPicksForDisplay(entry.pickScores.filter(pick => !pick.counted))
                        const allPickNames = golferNamePeers
                        const hareNames = isMe ? harePickMap.get(entry.entryId) : undefined
                        const tortoiseNames = !isMe ? tortoisePickMap.get(entry.entryId) : undefined
                        return (
                          <Fragment key={entry.entryId}>
                            <tr id={`entry-row-${entry.entryId}`} key={`${entry.entryId}-top`} className={`bg-[#f7f7f2] transition-colors ${highlightedEntryId === entry.entryId ? 'outline outline-4 outline-[#f3df9c]' : ''}`}>
                              <td className="border-b border-r-2 border-[#d8cab0] bg-[#f7f7f2] px-1 py-1.5 text-center text-xl font-black text-[#b21e23]">
                                {entry.rank || '—'}
                              </td>
                              <td className="border-b border-r-2 border-[#d8cab0] bg-[#f7f7f2] px-2 py-1.5 text-left">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  {isMe && <span aria-label="Your entry" className="h-2.5 w-2.5 shrink-0 bg-[#005b3c]" />}
                                  <span className="truncate text-base font-black uppercase tracking-[0.02em] text-[#111]" title={entry.displayName}>{entry.displayName}</span>
                                </div>
                                {(picksHidden || !selectedScoringIsLive || entry.obStandIns > 0) && (
                                  <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                                    {picksHidden ? 'Picks hidden until lock' : selectedScoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                                  </div>
                                )}
                              </td>
                              {Array.from({ length: pool.count_scores }, (_, i) => {
                                const pick = countingPicks[i]
                                return (
                                  <td key={i} title={picksHidden ? 'Picks hidden until the pool locks' : pick?.name || ''} className={`relative border-b border-r border-[#d8cab0] px-1 py-1 text-center align-middle shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] ${picksHidden ? 'bg-[#efeee6]' : 'bg-[#fbfbf5]'}`}>
                                    <>{pick?.isObStandIn ? <ObMarkerCorner /> : <LeverageMarkerCorner kind={pick && hareNames?.has(normalizePickName(pick.name)) ? 'hare' : pick && tortoiseNames?.has(normalizePickName(pick.name)) ? 'tortoise' : undefined} />}</>
                                    <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                    <div className={`mt-0.5 break-words text-[11px] font-black uppercase leading-tight tracking-[-0.01em] text-[#111] xl:text-xs ${picksHidden ? 'blur-[1px]' : ''}`}>{pick ? shortName(pick.name, allPickNames) : '—'}</div>
                                    <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? [pickGroupShortLabel(pick.name), activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)].filter(Boolean).join(' · ') : '—'}</div>
                                  </td>
                                )
                              })}
                              <td className={`border-b border-[#d8cab0] bg-[#fbfbf5] px-1 py-1.5 text-center align-middle ${scoreClass(entry.totalScore)}`}>
                                <div className="text-3xl font-black leading-none">{formatScore(entry.totalScore)}</div>
                                {totalScoreSubLabel && entry.todayScore !== null ? (
                                  <div className="mt-0.5 whitespace-nowrap text-[8px] font-black uppercase tracking-normal text-[#777] sm:text-[9px] sm:tracking-[0.08em]">{totalScoreSubLabel}: {formatScore(entry.todayScore)}</div>
                                ) : null}
                              </td>
                            </tr>
                            {outOfBoundsPicks.length > 0 && (
                              <tr key={`${entry.entryId}-out`} className="bg-[#efeee6]">
                                <td className="border-b border-r-2 border-[#d8cab0] bg-[#efeee6]" />
                                <td className="border-b border-r-2 border-[#d8cab0] bg-[#efeee6] px-2 py-1 text-left text-[9px] font-black uppercase tracking-[0.1em] text-[#111]">Outside Top {pool.count_scores}</td>
                                <td className="border-b border-[#d8cab0] bg-[#efeee6] px-2 py-1 text-left" colSpan={pool.count_scores + 1}>
                                  <div className="flex flex-wrap gap-1">
                                    {outOfBoundsPicks.map(pick => (
                                      <span key={`${entry.entryId}-${pick.name}`} className="inline-flex items-center gap-1 border border-[#d8cab0] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                                        {pick.isObStandIn ? <ObMarker /> : null}
                                        {hareNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="hare" /> : null}
                                        {tortoiseNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="tortoise" /> : null}
                                        <span><span className={scoreClass(pick.scoreToPar)}>{formatScore(pick.scoreToPar)}</span> {shortName(pick.name, allPickNames)} <span className="text-[#555]">{activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)}</span></span>
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
              {showLeverageLegend ? <LeverageMarkerLegend showTortoise={tortoisePickMap.size > 0} className="mt-1" /> : null}
              {!selectedScoringIsLive ? (
                <p className="mt-2 border-2 border-[#d8cab0] bg-[#f7f7f2] px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#111]">Live scoring appears here when the tournament starts.</p>
              ) : null}
            </div>
            </div>
            <div className="gpp-board-post mx-auto -mt-[4px] h-36 w-20 [--gpp-depth-x:12px] [--gpp-depth-y:8px] md:-mt-[7px] md:h-44 md:w-24 md:[--gpp-depth-x:22px] md:[--gpp-depth-y:14px]">
              <div className="gpp-board-post-depth" aria-hidden="true" />
              <div className="gpp-board-post-face" aria-hidden="true" />
            </div>
            <div>
              <TournamentLeaderboard
                leaderboard={leaderboard}
                tournamentName={tournament?.name}
                lastUpdated={leaderboardLastUpdated}
                pickedGolfers={myPicks}
                cutLine={cutLine}
                pickGroups={groupedFormat ? pickGroups : undefined}
              />
            </div>
            </>
          )}
        </div>
      )}

      {/* My Team Tab */}
      {tab === 'my-entry' && (
        <div id="make-picks" className="scroll-mt-24 space-y-6">
          {!myEntry ? (
            <div className="bg-white rounded-none p-8 border border-stone-200 text-center">
              <p className="text-stone-600">You haven't joined this pool yet.</p>
            </div>
          ) : (
            <>
              {!fieldReady && !picksAreLocked && (
                <div className="mb-4 border-2 border-[#b58a3a] bg-[#fff4cf] p-4 shadow-[5px_5px_0_#d8cab0]">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a5a19]">Tournament field pending</p>
                  <p className="mt-1 text-lg font-black leading-6 text-[#123c2f]">Golfers are not available for this event yet.</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#1f2a24]">Check back closer to the tournament. Your entry is in the pool; picks open here as soon as the field loads.</p>
                </div>
              )}

              <div className="mb-4 border-2 border-[#123c2f] bg-[#fbf7ed] shadow-[5px_5px_0_#d8cab0]">
                <div className="flex flex-col gap-3 border-b border-[#d8cab0] bg-[#123c2f] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f3df9c]">Make picks</p>
                    <h2 className="text-xl font-black text-white">{groupsNeedLock ? 'Picks open soon. Review the groups now.' : `Pick ${pool.pick_count}. Best ${pool.count_scores} count.`}</h2>
                  </div>
                  {pickSelectionOpen && fieldReady ? (
                    <button onClick={savePicks} disabled={saving}
                      className="border-2 border-[#f3df9c] bg-[#f3df9c] px-5 py-2 text-sm font-black uppercase text-[#123c2f] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save picks'}
                    </button>
                  ) : groupsNeedLock ? (
                    <span className="w-fit border border-[#f3df9c] bg-[#f3df9c] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#123c2f]">Picks open soon</span>
                  ) : picksAreLocked ? (
                    <span className="w-fit border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-800">Picks closed</span>
                  ) : (
                    <span className="w-fit border border-[#f3df9c] bg-[#f3df9c] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#123c2f]">Field pending</span>
                  )}
                </div>
                <div className="p-4">
                  {groupsNeedLock && (
                    <div className="mb-4 border-2 border-[#b58a3a] bg-[#fff4cf] p-3 shadow-[4px_4px_0_#d8cab0]">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7a5a19]">Picks open soon</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-[#1f2a24]">
                        {isOwner ? 'Review the groups now. Players can see this preview, but picking stays off until you lock groups. Groups also auto-lock Tuesday morning ET once the field is set.' : 'The pool runner is reviewing the groups. You can check the field now, but picks stay off until groups are locked. Groups auto-lock Tuesday morning ET once the field is set.'}
                      </p>
                    </div>
                  )}
                  <details className="group border border-[#d8cab0] bg-white" open={obRulesOpen} onToggle={event => setObRulesOpen(event.currentTarget.open)}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left text-xs font-black uppercase tracking-[0.12em] text-[#123c2f] [&::-webkit-details-marker]:hidden">
                      <span>How OB works</span>
                      <span className={`border border-[#123c2f] px-1.5 py-0.5 text-[10px] ${obRulesOpen ? 'bg-[#123c2f] text-white' : 'bg-white text-[#123c2f]'}`}>{obRulesOpen ? 'Close' : 'Open'}</span>
                    </summary>
                    <div className="space-y-2 border-t border-[#d8cab0] px-3 py-3 text-sm leading-6 text-stone-700">
                      <p>If one of your golfers misses the cut, withdraws, or never posts a usable score, that pick is out of bounds.</p>
                      <p>When an OB pick is needed to fill your counted scores, the app uses the worst active counted score in the pool plus {pool.ob_rule_enabled ? pool.ob_penalty_strokes : 2} strokes.</p>
                      <p className="border border-[#eadfca] bg-[#fbf7ed] px-2 py-2 text-xs font-semibold text-[#1f2a24]">Example: if your pool counts 4 golfers and only 3 of yours are active, the missing counted spot gets the worst active score plus the OB penalty.</p>
                    </div>
                  </details>
                </div>
              </div>

              {/* Selected picks */}
              {showSelectedPicks && (
                <div className="mb-4 rounded-none border-2 border-[#123c2f] bg-white shadow-[5px_5px_0_#d8cab0]">
                  <div className="flex flex-col gap-1 border-b border-[#d8cab0] bg-[#fbf7ed] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#123c2f]">
                      Your picks ({myPicks.length}/{pool.pick_count})
                    </h3>
                    {fieldReady && (
                      <span className="text-xs font-bold text-stone-500">
                        {pickSelectionOpen ? 'Tap a golfer below to add or remove' : groupsNeedLock ? 'Preview only until groups lock' : 'Review the field below'}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    {groupedFormat ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {groupPickCounts(pickGroups, myPicks).map(({ group, picks }) => (
                          <div key={group.id} className="border border-[#d8cab0] bg-[#fbf7ed] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-[0.1em] text-[#123c2f]">
                              <span>{displayGroupLabel(group.label)}</span>
                              <span>{picks.length}/{picksPerGroup}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {picks.map(name => (
                                <span key={name} className="flex items-center gap-2 rounded-none border border-[#123c2f] bg-white px-3 py-1.5 text-sm font-bold text-[#123c2f]">
                                  {golferListName(name)}
                                  {pickSelectionOpen && (
                                    <button type="button" onClick={() => togglePick(name)} className="border border-[#123c2f] px-1 text-[10px] font-black leading-4 text-[#123c2f] hover:border-[#b21e23] hover:text-[#b21e23]" aria-label={`Remove ${golferListName(name)}`}>×</button>
                                  )}
                                </span>
                              ))}
                              {picks.length === 0 && (
                                <div className="grid w-full gap-1">
                                  {group.players.map(player => (
                                    <span key={player.id || player.name} className="text-sm font-semibold text-stone-600">
                                      {golferListName(player.name)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {myPicks.map(name => (
                          <span key={name} className="flex items-center gap-2 rounded-none border border-[#123c2f] bg-[#eef7ef] px-3 py-1.5 text-sm font-bold text-[#123c2f]">
                            {golferListName(name)}
                            {pickSelectionOpen && fieldReady && (
                              <button type="button" onClick={() => togglePick(name)} className="border border-[#123c2f] px-1 text-[10px] font-black leading-4 text-[#123c2f] hover:border-[#b21e23] hover:text-[#b21e23]" aria-label={`Remove ${golferListName(name)}`}>×</button>
                            )}
                          </span>
                        ))}
                        {myPicks.length === 0 && <span className="text-sm font-semibold text-stone-500">No golfers selected yet.</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Golfer list */}
              {showPickList && (
                <div className="mb-4 overflow-hidden rounded-none border-2 border-[#123c2f] bg-white shadow-[5px_5px_0_#d8cab0]">
                  <div className="border-b border-[#d8cab0] bg-[#fbf7ed] px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#123c2f]">{groupedFormat ? (groupsNeedLock ? (pool.game_format === 'ranked_groups' ? 'Tier preview' : 'Group preview') : `${pool.game_format === 'random_groups' ? 'Random groups' : 'Tiered Picks'}`) : 'Tournament field'}</p>
                    <p className="mt-1 text-sm font-semibold text-stone-600">{groupedFormat ? (groupsNeedLock ? `Picks open after ${groupNamePlural} lock. ${pool.game_format === 'ranked_groups' ? 'Tiers' : 'Groups'} auto-lock Tuesday morning ET once the field is set.` : `Pick ${picksPerGroup} from each ${groupName}. ${pool.game_format === 'ranked_groups' ? 'Tiers' : 'Groups'} are locked for this pool.`) : 'Sorted by last name for quick scanning.'}</p>
                    {groupedFormat && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#d8cab0] pt-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#123c2f]">
                            {groupsNeedLock ? 'Preview only' : `${myPicks.length}/${groupedTotalPicks} picks`}
                          </span>
                          {groupsNeedLock && (
                            <span className="border border-[#b58a3a] bg-[#fff4cf] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#7a5a19]">
                              Picks not open yet
                            </span>
                          )}
                          {!groupsNeedLock && groupedGroupsRemaining === 0 && myPicks.length > 0 && (
                            <span className="border border-[#123c2f] bg-[#eef7ef] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#123c2f]">
                              Complete
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[#123c2f]">
                          <span>{myPicks.length}/{groupedTotalPicks} picks</span>
                          {groupedGroupsRemaining > 0 && (
                            <span className="text-[#b21e23]">
                              {groupedGroupsRemaining} group{groupedGroupsRemaining !== 1 ? 's' : ''} left
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="max-h-[28rem] overflow-y-auto">
                    {groupedFormat ? (
                      pickGroups.length > 0 ? (
                        <div className="p-2 sm:p-3">
                          <GroupedPickGrid
                            pickGroups={pickGroups}
                            myPicks={myPicks}
                            picksPerGroup={picksPerGroup}
                            readOnly={picksAreLocked || groupsNeedLock}
                            golferListName={golferListName}
                            onTogglePick={togglePick}
                            groupLabelForDisplay={displayGroupLabel}
                          />
                        </div>
                      ) : (
                        [...field].sort((a, b) => golferListName(a.name).localeCompare(golferListName(b.name))).map(player => (
                          <div key={player.id || player.name}
                            className="flex w-full items-center justify-between border-b border-[#eadfca] px-4 py-2.5 text-left text-stone-500">
                            <span className="text-sm font-semibold">{golferListName(player.name)}</span>
                            <span className="border border-stone-300 bg-stone-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-stone-500">Field</span>
                          </div>
                        ))
                      )
                    ) : [...field].sort((a, b) => golferListName(a.name).localeCompare(golferListName(b.name))).map(player => {
                      const selected = myPicks.includes(player.name)
                      return (
                        <button key={player.id}
                          onClick={() => togglePick(player.name)}
                          disabled={!selected && myPicks.length >= pool.pick_count}
                          className={`flex w-full items-center justify-between border-b border-[#eadfca] px-4 py-2.5 text-left transition-colors ${
                            selected ? 'bg-[#eef7ef] text-[#123c2f]' :
                            myPicks.length >= pool.pick_count ? 'cursor-not-allowed text-stone-400' :
                            'text-stone-800 hover:bg-[#fbf7ed]'
                          }`}>
                          <span className="text-sm font-semibold">{golferListName(player.name)}</span>
                          {selected && <span className="border border-[#123c2f] bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#123c2f]">Selected</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <details className="group rounded-none border border-stone-200 bg-white shadow-[4px_4px_0_#d8cab0]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-stone-700 [&::-webkit-details-marker]:hidden">
                  <span>Entry name</span>
                  <span className="border border-stone-300 px-1.5 py-0.5 text-[10px] group-open:hidden">Edit</span>
                </summary>
                <div className="border-t border-stone-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-sm font-medium text-stone-700">Name on leaderboard</label>
                      <input
                        type="text"
                        value={entryNameValue}
                        onChange={e => setEntryNameValue(e.target.value)}
                        placeholder="Name shown on leaderboard"
                        maxLength={60}
                        className="w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      />
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
              </details>

              {/* Leave pool — available to non-owners before picks close */}
              {myEntry && !isOwner && !picksAreLocked && (
                <details className="group rounded-none border border-stone-200 bg-white shadow-[4px_4px_0_#d8cab0]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-[#b21e23] [&::-webkit-details-marker]:hidden">
                    <span>Leave pool</span>
                    <span className="border border-stone-300 px-1.5 py-0.5 text-[10px] group-open:hidden">Open</span>
                  </summary>
                  <div className="border-t border-stone-200 p-4">
                    <p className="text-sm font-semibold text-stone-700">Remove your entry from <span className="font-black text-stone-900">{poolName}</span>? Your picks will be lost.</p>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(myEntry.id)}
                      className="mt-3 border-2 border-[#b21e23] bg-[#b21e23] px-4 py-2 text-sm font-black uppercase text-white transition-colors hover:bg-[#8a1719]"
                    >
                      Leave this pool
                    </button>
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {/* Pool Settings Tab */}
      {tab === 'pool-settings' && isOwner && (
        <div ref={adminSectionRef} className="scroll-mt-6 space-y-6">
          <section className="border-2 border-[#123c2f] bg-[#fbf7ed] p-5 shadow-[5px_5px_0_#d8cab0]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6724]">Public leaderboard</p>
                <h3 className="mt-1 text-xl font-black text-[#123c2f]">Share a view-only board</h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#657168]">Send this link to friends who are not in the pool. They can view the leaderboard without signing in.</p>
                <p className="mt-3 break-all border border-[#d8cab0] bg-white px-3 py-2 font-mono text-xs text-[#1f2a24]">{publicLeaderboardUrl || `/leaderboard/${pool.id}`}</p>
              </div>
              <button
                type="button"
                onClick={copyPublicLeaderboardLink}
                className="shrink-0 border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-white hover:bg-[#0f2f25]"
              >
                Copy link
              </button>
            </div>
          </section>
          <section className="border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">Pool fee</p>
                <h3 className="mt-1 text-2xl font-black text-emerald-950">{feeLabel}</h3>
                {paymentStatus === 'active' && amountPaidCents > 0 && (
                  <p className="mt-1 text-sm font-black uppercase tracking-[0.08em] text-emerald-800">Amount paid: {formatCents(amountPaidCents)}</p>
                )}
                <p className="mt-1 text-sm text-stone-600">
                  {(paymentQuote?.activeEntryCount ?? activeEntries.length)} active {(paymentQuote?.activeEntryCount ?? activeEntries.length) === 1 ? 'entry' : 'entries'} · first 5 free · $20 max through 100 · +$10 per started 100 after
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
                        {savedCards.length > 0 && (
                          <div className="space-y-2 border border-stone-200 bg-white p-3">
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-900">Saved card</p>
                            {savedCards.map(card => (
                              <label key={card.id} className="flex cursor-pointer items-center justify-between gap-3 border border-stone-200 bg-[#fbf7ed] px-3 py-2 text-sm font-semibold text-stone-800">
                                <span className="min-w-0 truncate">{card.brand || 'Card'} ending {card.last_4 || '••••'}</span>
                                <input
                                  type="radio"
                                  name="saved-card"
                                  checked={selectedSavedCardId === card.id}
                                  onChange={() => setSelectedSavedCardId(card.id)}
                                  className="h-4 w-4 accent-[#123c2f]"
                                />
                              </label>
                            ))}
                            <label className="flex cursor-pointer items-center justify-between gap-3 border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-800">
                              <span>Use a different card</span>
                              <input
                                type="radio"
                                name="saved-card"
                                checked={!selectedSavedCardId}
                                onChange={() => setSelectedSavedCardId('')}
                                className="h-4 w-4 accent-[#123c2f]"
                              />
                            </label>
                          </div>
                        )}
                        {!useSavedCard && (
                          <>
                            <div id="square-card-container" className="gpp-square-card-frame" />
                            {!paymentCardReady && (
                              <p className="text-xs font-semibold text-stone-600">Card form is loading.</p>
                            )}
                            <label className="flex cursor-pointer items-start gap-2 border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-800">
                              <input
                                type="checkbox"
                                checked={saveCard}
                                onChange={event => setSaveCard(event.target.checked)}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[#123c2f]"
                              />
                              <span>Save this card for faster pool payments. No auto-pay.</span>
                            </label>
                          </>
                        )}
                        {useSavedCard && selectedSavedCard && (
                          <p className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                            Paying with {selectedSavedCard.brand || 'card'} ending {selectedSavedCard.last_4 || '••••'}. No auto-pay.
                          </p>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={activatePool}
                      disabled={paymentLoading || !paymentQuote || (!useSavedCard && !paymentCardReady && finalAmountDueCents > 0)}
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

          {!picksAreLocked && (
            <section className="border border-[#d8cab0] bg-[#fbf7ed] p-5 shadow-[5px_5px_0_#d8cab0]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6724]">Pick reminders</p>
                  <h3 className="mt-1 text-xl font-black text-[#123c2f]">Still need picks: {entriesNeedingPicks.length}</h3>
                  <p className="mt-1 text-sm font-semibold text-[#657168]">Copy this list into your group text before picks lock.</p>
                </div>
                <button
                  type="button"
                  onClick={copyNeedsPicksReminder}
                  disabled={entriesNeedingPicks.length === 0}
                  className="border-2 border-[#123c2f] bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#123c2f] transition-colors hover:bg-[#eef7ef] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copy reminder
                </button>
              </div>
              {entriesNeedingPicks.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {entriesNeedingPicks.map(entry => (
                    <span key={entry.id} className="border border-[#d8cab0] bg-white px-2.5 py-1 text-sm font-bold text-[#1f2a24]">{entry.display_name || 'Player'}</span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Everyone has picks in.</p>
              )}
            </section>
          )}
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
                <p className="text-sm font-semibold text-red-800">Delete pool: <span className="font-black uppercase tracking-[0.04em]">{pool.name}</span></p>
                <p className="mt-1 text-sm text-stone-600">This removes <span className="font-black uppercase text-red-800">{pool.name}</span> and all entries. Type DELETE to confirm.</p>
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
