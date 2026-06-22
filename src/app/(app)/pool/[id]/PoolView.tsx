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
import { availableCompletedRounds, buildHarePickMap, buildTortoisePickMap, currentLeaderboardRound, leaderboardForCompletedRound, leaderboardForRoundOnly, leaderboardHasPlayoffScores, normalizePickName, scoreEntriesForLeaderboard, type PickScore, type ScoredEntry } from '@/lib/scoring'
import { getPoolPaymentStatus, getTournamentSaturday, isPoolFeePastDue } from '@/lib/payments/pricing'
import { formatDateOnly, formatDateOnlyWeekday, getDateOnly, todayDateOnly } from '@/lib/date-utils'
import { hasOnCourseScores } from '@/lib/golf-live'
import { leaderboardBackedPickProgressLabel } from '@/lib/golfer-status'
import type { GolfCutLine, GolfPlayer } from '@/lib/golf-api'
import { buildPickGroups, groupForPick, groupPickCounts, validateGroupedPicks, type PickGroup } from '@/lib/pool-formats'
import { GroupedPickGrid } from '@/components/GroupedPickGrid'
import { DUPLICATE_ENTRY_NAME_MESSAGE, normalizeEntryName } from '@/lib/entry-name'
import { buildFrozenResultEntry, hasCompleteFrozenResults } from '@/lib/frozen-results'
import { pickGridColumnCount } from '@/lib/pick-card-layout'

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
  guestEntryToken?: string
  initialHighlightedEntryId?: string | null
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

function formatPickScore(pick?: PickScore | null) {
  if (!pick) return ''
  if (pick.scoreToPar === null) return ''
  return formatScore(pick.scoreToPar)
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

function highlightedEntryRowBg(highlighted: boolean) {
  return highlighted ? 'bg-[#eaf5ec]' : 'bg-[#f7f7f2]'
}

function highlightedEntryCellBg(highlighted: boolean) {
  return highlighted ? 'bg-[#eaf5ec]' : 'bg-[#fbfbf5]'
}

function highlightedEntrySummaryBg(highlighted: boolean) {
  return highlighted
    ? 'bg-[#eaf5ec] hover:bg-[#eaf5ec] group-open:bg-[#eaf5ec]'
    : 'bg-[#f7f7f2] hover:bg-[#fffdf4] group-open:bg-[#fffdf4]'
}

function buildPlaceholderPick(name: 'Picks hidden' | 'Waiting', counted: boolean): PickScore {
  return {
    name,
    scoreToPar: null,
    strokes: null,
    thru: '',
    status: 'active',
    counted,
    isObStandIn: false,
    finalNineScore: null,
    tiebreakScores: [],
  }
}

function buildPreScoringEntry(entry: any, countScores: number, playerByName: Map<string, GolfPlayer>): ScoredEntry {
  if (entry.picks_hidden) {
    const submittedCount = Number(entry.submitted_pick_count || 0)
    const label = submittedCount > 0 ? 'Picks hidden' : 'Waiting'
    const pickScores = Array.from({ length: countScores }, () => buildPlaceholderPick(label, true))
    return {
      entryId: entry.id,
      displayName: entry.display_name,
      picks: pickScores.map(pick => pick.name),
      pickScores,
      totalScore: null,
      todayScore: null,
      finalNineScore: null,
      tiebreakScores: [],
      rank: null,
      obStandIns: 0,
    }
  }

  const orderedPicks = sortPickNamesForPreScoring([...(entry.golfer_picks || [])] as string[], playerByName)
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
    finalNineScore: null,
    tiebreakScores: [],
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

function parsedTeeTimeMs(player?: GolfPlayer | null) {
  if (!player?.teeTime) return null
  const parsed = new Date(player.teeTime).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function pickNameSortValue(name: string) {
  return `${lastNameFor(name)} ${name}`.toLowerCase()
}

function sortPickNamesForPreScoring(names: string[], playerByName: Map<string, GolfPlayer>) {
  const hasTeeTimes = names.some(name => parsedTeeTimeMs(playerByName.get(normalizePickName(name))) !== null)
  return [...names].sort((a, b) => {
    if (hasTeeTimes) {
      const aPlayer = playerByName.get(normalizePickName(a))
      const bPlayer = playerByName.get(normalizePickName(b))
      const aTeeTime = parsedTeeTimeMs(aPlayer) ?? Number.POSITIVE_INFINITY
      const bTeeTime = parsedTeeTimeMs(bPlayer) ?? Number.POSITIVE_INFINITY
      if (aTeeTime !== bTeeTime) return aTeeTime - bTeeTime
      const aStartTee = aPlayer?.startTee ?? 1
      const bStartTee = bPlayer?.startTee ?? 1
      if (aStartTee !== bStartTee) return aStartTee - bStartTee
    }
    return pickNameSortValue(a).localeCompare(pickNameSortValue(b))
  })
}

function outOfBoundsLabel(scoringIsLive: boolean, countScores: number) {
  return scoringIsLive ? `Outside Top ${countScores}` : 'Other picks'
}

function shortName(name: string, peerNames: string[] = []) {
  if (name === 'Picks hidden') return 'Hidden'
  if (name === 'Waiting') return 'Waiting'
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

function playerNameKey(player: GolfPlayer) {
  return normalizePickName(player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim())
}

function playerStatusByName(scoringRows: GolfPlayer[], fieldRows: GolfPlayer[]) {
  const byName = new Map<string, GolfPlayer>()
  for (const player of fieldRows) {
    const key = playerNameKey(player)
    if (key) byName.set(key, player)
  }
  for (const player of scoringRows) {
    const key = playerNameKey(player)
    if (!key) continue
    const fieldPlayer = byName.get(key)
    byName.set(key, {
      ...fieldPlayer,
      ...player,
      teeTime: player.teeTime || fieldPlayer?.teeTime,
      startTee: player.startTee ?? fieldPlayer?.startTee,
    })
  }
  return byName
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

function cleanPickList(value: unknown) {
  return Array.isArray(value) ? value.filter((pick): pick is string => typeof pick === 'string' && Boolean(pick.trim())) : []
}

function picksMatch(left: string[], right: string[]) {
  return left.length === right.length && left.every((pick, index) => pick === right[index])
}

function pickDraftKey(poolId: string, entryId: string) {
  return `gpp_pick_draft:${poolId}:${entryId}`
}

function readPickDraft(key: string) {
  if (!key || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    const parsed = JSON.parse(raw || 'null')
    return cleanPickList(Array.isArray(parsed) ? parsed : parsed?.picks)
  } catch {
    return null
  }
}

function writePickDraft(key: string, picks: string[]) {
  if (!key || typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify({ picks, updatedAt: new Date().toISOString() }))
}

function clearPickDraft(key: string) {
  if (!key || typeof window === 'undefined') return
  window.localStorage.removeItem(key)
}

function runnerEmailForEntry(entry: any) {
  const accountEmail = typeof entry?.account_email === 'string' ? entry.account_email.trim() : ''
  const notificationEmail = typeof entry?.notification_email === 'string' ? entry.notification_email.trim() : ''
  return accountEmail || notificationEmail
}

function runnerFullNameForEntry(entry: any) {
  const entryFullName = entry?.full_name_confirmed_at && typeof entry?.full_name === 'string' ? entry.full_name.trim() : ''
  const accountFullName = entry?.account_full_name_confirmed_at && typeof entry?.account_full_name === 'string' ? entry.account_full_name.trim() : ''
  return entryFullName || accountFullName
}

function runnerCanEmailEntry(entry: any) {
  return Boolean(runnerEmailForEntry(entry) || entry?.user_id)
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

type LeaderboardMode = { type: 'current' } | { type: 'thru'; round: number } | { type: 'day'; round: number }

function roundMenuLabel(round: number) {
  return `R${round}`
}

function roundScoreLabel(round: number) {
  return `R${round}`
}

function isFinalRound(round: number, hasPlayoffScores: boolean) {
  return round === 4 && !hasPlayoffScores
}

function cumulativeRoundLabel(round: number, hasPlayoffScores: boolean) {
  return isFinalRound(round, hasPlayoffScores) ? 'Final' : `Through ${roundMenuLabel(round)}`
}

function selectedBoardLabelForMode(mode: LeaderboardMode, hasPlayoffScores: boolean) {
  if (mode.type === 'current') return 'Current'
  if (mode.type === 'thru') return cumulativeRoundLabel(mode.round, hasPlayoffScores)
  return roundMenuLabel(mode.round)
}

function historicalBoardCaption(mode: LeaderboardMode, hasPlayoffScores: boolean) {
  if (mode.type === 'current') return null
  if (mode.type === 'day') return `${roundMenuLabel(mode.round)} scores only`
  return isFinalRound(mode.round, hasPlayoffScores) ? 'Final standings' : `Standings through ${roundMenuLabel(mode.round)}`
}

export default function PoolView({ pool, tournament, entries: initialEntries, myEntry: initialMyEntry, isOwner, userId, previousPlayerCandidates, inviteSummary, publicView = false, guestEntryToken = '', initialHighlightedEntryId = null }: Props) {
  const router = useRouter()
  const guestMode = Boolean(guestEntryToken)
  const defaultTab: Tab = guestMode ? 'my-entry' : publicView ? 'leaderboard' : initialMyEntry?.golfer_picks?.length ? 'leaderboard' : 'my-entry'
  const [tab, setTab] = useState<Tab>(defaultTab)
  const [entries, setEntries] = useState(initialEntries)
  const entriesRef = useRef(initialEntries)
  const [myEntry, setMyEntry] = useState(initialMyEntry)
  const [poolName, setPoolName] = useState(pool.name)
  const [poolLocked, setPoolLocked] = useState(pool.is_locked)
  const [leaderboard, setLeaderboard] = useState<GolfPlayer[]>(() => Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json as GolfPlayer[] : [])
  const [leaderboardLastUpdated, setLeaderboardLastUpdated] = useState<string | null>(() => tournament?.last_scores_fetch || null)
  const [cutLine, setCutLine] = useState<GolfCutLine | null>(() => tournament?.cutLine || null)
  const [field, setField] = useState<GolfPlayer[]>(() => Array.isArray(tournament?.field_json) ? tournament.field_json as GolfPlayer[] : Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json as GolfPlayer[] : [])
  const [myPicks, setMyPicks] = useState<string[]>(initialMyEntry?.golfer_picks || [])
  const currentPickDraftKey = myEntry?.id ? pickDraftKey(pool.id, myEntry.id) : ''
  const [entryNameValue, setEntryNameValue] = useState(initialMyEntry?.display_name || '')
  const [fullNameValue, setFullNameValue] = useState(runnerFullNameForEntry(initialMyEntry) || '')
  const [notificationEmailValue, setNotificationEmailValue] = useState(initialMyEntry?.notification_email || '')
  const [entryNameSaving, setEntryNameSaving] = useState(false)
  const [fullNameSaving, setFullNameSaving] = useState(false)
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_SECONDS)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [publicLeaderboardUrl, setPublicLeaderboardUrl] = useState('')
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const [removingEntryId, setRemovingEntryId] = useState<string | null>(null)
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
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(initialHighlightedEntryId)
  const [forceOpenEntryId, setForceOpenEntryId] = useState<string | null>(initialHighlightedEntryId)
  const initialActiveEntryCount = initialEntries.filter(entry => !entry.is_removed).length
  const [paymentStatus, setPaymentStatus] = useState(getPoolPaymentStatus(pool.payment_status || 'draft', initialActiveEntryCount, Number(pool.amount_paid_cents || 0)))
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [teeTimeZone, setTeeTimeZone] = useState(DEFAULT_TEE_TIME_ZONE)
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>({ type: 'current' })
  const [leaderboardMenuOpen, setLeaderboardMenuOpen] = useState(false)
  const [defaultOpenedEntryId, setDefaultOpenedEntryId] = useState<string | null>(null)
  const [showGuestSavePanel, setShowGuestSavePanel] = useState(false)
  const [guestSaveStep, setGuestSaveStep] = useState<'email' | 'account'>('email')
  const [guestAccountPassword, setGuestAccountPassword] = useState('')
  const [guestAccountLoading, setGuestAccountLoading] = useState(false)
  const [guestAccountError, setGuestAccountError] = useState('')
  const [guestEmailSaving, setGuestEmailSaving] = useState(false)
  const [finalizingGroups, setFinalizingGroups] = useState(false)
  const [missingReminderSending, setMissingReminderSending] = useState(false)
  const [missingReminderFeedback, setMissingReminderFeedback] = useState('')
  const [entryEditOnly, setEntryEditOnly] = useState(false)
  const paymentCardRef = useRef<any>(null)
  const adminSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected) setTeeTimeZone(detected)
  }, [])

  useEffect(() => {
    const applyRouteState = () => {
      const requestedTab = new URLSearchParams(window.location.search).get('tab')
      const settingsRequested = requestedTab === 'pool-settings' && isOwner
      const editPicksRoute = !settingsRequested && !publicView && window.location.hash === '#make-picks'
      setEntryEditOnly(editPicksRoute)

      if (settingsRequested) {
        setTab('pool-settings')
        window.setTimeout(() => {
          const scrollTarget = window.location.hash === '#pick-reminders'
            ? document.getElementById('pick-reminders')
            : adminSectionRef.current
          scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 80)
      } else if (editPicksRoute) {
        setTab('my-entry')
        window.setTimeout(() => document.getElementById('make-picks')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
      } else if (requestedTab === 'leaderboard') {
        setTab('leaderboard')
      } else if (requestedTab === 'my-entry' && !publicView) {
        setTab('my-entry')
      } else {
        setTab(defaultTab)
      }
    }

    applyRouteState()
    window.addEventListener('hashchange', applyRouteState)
    window.addEventListener('popstate', applyRouteState)
    return () => {
      window.removeEventListener('hashchange', applyRouteState)
      window.removeEventListener('popstate', applyRouteState)
    }
  }, [defaultTab, isOwner, publicView])

  const selectPoolTab = useCallback((nextTab: Tab) => {
    setEntryEditOnly(false)
    setTab(nextTab)
    if (typeof window === 'undefined' || guestMode || publicView) return
    const url = new URL(window.location.href)
    url.hash = ''
    url.searchParams.set('tab', nextTab)
    const nextPath = `${url.pathname}${url.search}`
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (nextPath !== currentPath) window.history.pushState({}, '', nextPath)
  }, [guestMode, publicView])

  useEffect(() => {
    if (!initialHighlightedEntryId) return
    setTab('leaderboard')
    setForceOpenEntryId(initialHighlightedEntryId)
    setHighlightedEntryId(initialHighlightedEntryId)
    window.setTimeout(() => {
      const targetId = window.matchMedia('(min-width: 1024px)').matches ? `entry-row-${initialHighlightedEntryId}` : `entry-card-${initialHighlightedEntryId}`
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    window.setTimeout(() => setHighlightedEntryId(null), 2600)
  }, [initialHighlightedEntryId])
  const supabase = useMemo(() => createClient(), [])

  const dismissToast = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts(current => [...current.slice(-2), { id, message, tone }])
    window.setTimeout(() => dismissToast(id), 3500)
  }, [dismissToast])

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => {
    const url = new URL(window.location.href)
    const claimStatus = url.searchParams.get('claim')
    if (!claimStatus) return

    if (claimStatus === 'linked') {
      window.localStorage.removeItem(`gpp_guest_entry:${pool.id}`)
      showToast('Entry linked to your account.', 'success')
    } else if (claimStatus === 'existing-entry') {
      showToast('Your account already has an entry in this pool.', 'info')
    } else if (claimStatus === 'already-linked') {
      showToast('That entry is already linked.', 'info')
    } else if (claimStatus === 'not-found' || claimStatus === 'error') {
      showToast('Could not link that saved entry.', 'error')
    }

    url.searchParams.delete('claim')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [pool.id, showToast])

  const activeEntries = entries.filter(e => !e.is_removed)
  const currentEntryId = myEntry?.id || initialMyEntry?.id || ''
  const isCurrentEntry = useCallback((entry: any) => {
    if (!entry || entry.is_removed) return false
    if (currentEntryId && entry.id === currentEntryId) return true
    if (!guestMode && userId && entry.user_id === userId) return true
    return false
  }, [currentEntryId, guestMode, userId])
  const storedPickGroups: PickGroup[] = Array.isArray(pool.pick_groups_json) ? pool.pick_groups_json : []
  const groupedFormat = pool.game_format === 'ranked_groups' || pool.game_format === 'random_groups'
  const pickGroups: PickGroup[] = useMemo(() => {
    if (!groupedFormat) return []
    if (storedPickGroups.length > 0) return storedPickGroups
    if (!field.length) return []
    return buildPickGroups({
      field,
      format: pool.game_format,
      groupCount: Number(pool.group_count || 6),
      seed: `${pool.id}:${tournament?.id || tournament?.external_id || tournament?.name || 'group-preview'}`,
    })
  }, [field, groupedFormat, pool.game_format, pool.group_count, pool.id, storedPickGroups, tournament?.external_id, tournament?.id, tournament?.name])
  const groupsFinalized = !groupedFormat || (storedPickGroups.length > 0 && Boolean(pool.groups_finalized_at))
  const picksPerGroup = groupedFormat ? Number(pool.picks_per_group || 1) : 0
  const groupedTotalPicks = groupedFormat ? pickGroups.length * picksPerGroup : 0
  const requiredPickCount = groupedFormat ? groupedTotalPicks : Number(pool.pick_count || 0)
  const groupedPickValidation = useMemo(() => (
    groupedFormat && pickGroups.length > 0
      ? validateGroupedPicks(pickGroups, myPicks, picksPerGroup)
      : { valid: !groupedFormat, missing: [], over: [] }
  ), [groupedFormat, myPicks, pickGroups, picksPerGroup])
  const groupedGroupsRemaining = groupedFormat ? pickGroups.filter(g => {
    const sc = g.players.filter(p => myPicks.includes(p.name)).length
    return sc < picksPerGroup
  }).length : 0
  const entryRequiredPickCount = groupedFormat
    ? ((pickGroups.length || Number(pool.group_count || 0)) * picksPerGroup) || Number(pool.pick_count || 0)
    : Number(pool.pick_count || 0)
  const pickCountForEntry = (entry: any) => {
    const picks = Array.isArray(entry?.golfer_picks) ? entry.golfer_picks as string[] : []
    return Number(entry?.submitted_pick_count ?? picks.length)
  }
  const entriesNeedingPicks = activeEntries.filter(entry => {
    const pickCount = pickCountForEntry(entry)
    if (entryRequiredPickCount <= 0) return pickCount <= 0
    return pickCount < entryRequiredPickCount
  })
  const entriesNeedingPicksWithEmail = entriesNeedingPicks.filter(entry => runnerCanEmailEntry(entry))
  const entriesNeedingPicksNoEmail = entriesNeedingPicks.filter(entry => !runnerCanEmailEntry(entry))
  const wdPickNames = useMemo(() => new Set(field
    .filter(player => String(player.status || '').toLowerCase() === 'wd')
    .map(player => player.name)
    .filter(Boolean)), [field])
  const entriesWithWdPicks = activeEntries
    .map(entry => {
      const storedWithdrawnPicks = Array.isArray(entry.withdrawn_picks) ? entry.withdrawn_picks : []
      const withdrawnPicks = storedWithdrawnPicks.length
        ? storedWithdrawnPicks
        : (((entry.golfer_picks as string[]) || []).filter(name => wdPickNames.has(name)))
      return { entry, withdrawnPicks }
    })
    .filter(item => item.withdrawnPicks.length > 0)
  const wdPicksNoEmail = entriesWithWdPicks.filter(item => !runnerCanEmailEntry(item.entry))
  const submittedPickCount = activeEntries.length - entriesNeedingPicks.length
  const isLocked = poolLocked
  const scoringIsLive = tournament?.status === 'live' || tournament?.status === 'completed' || hasOnCourseScores(leaderboard)
  const tournamentEndDate = getDateOnly(tournament?.end_date)
  const tournamentIsPastOrCompleted = Boolean(
    pool.is_completed ||
    tournament?.status === 'completed' ||
    (tournamentEndDate && tournamentEndDate < todayDateOnly())
  )
  const showLivePulse = hasRecentOnCourseScores(tournament, leaderboard)
  const availableHistoricalRounds = useMemo(() => availableCompletedRounds(leaderboard), [leaderboard])
  const hasPlayoffScores = useMemo(() => leaderboardHasPlayoffScores(leaderboard), [leaderboard])
  const selectedLeaderboard = useMemo(() => {
    if (leaderboardMode.type === 'thru') return leaderboardForCompletedRound(leaderboard, leaderboardMode.round)
    if (leaderboardMode.type === 'day') return leaderboardForRoundOnly(leaderboard, leaderboardMode.round)
    return leaderboard
  }, [leaderboard, leaderboardMode])
  const leaderboardModeIsCurrent = leaderboardMode.type === 'current'
  const selectedBoardLabel = selectedBoardLabelForMode(leaderboardMode, hasPlayoffScores)
  const selectedBoardIsHistorical = !leaderboardModeIsCurrent
  const canShareBoardImage = (pool.is_completed || tournament?.status === 'completed') || (isOwner && selectedBoardIsHistorical)
  const shareBoardImageLabel = selectedBoardIsHistorical ? 'Share board image' : 'Share final results'
  const currentRound = leaderboardModeIsCurrent ? currentLeaderboardRound(leaderboard) : null
  const totalScoreSubLabel = leaderboardMode.type === 'current'
    ? (currentRound ? roundScoreLabel(currentRound) : 'TODAY')
    : leaderboardMode.type === 'thru' && leaderboardMode.round > 1
      ? roundScoreLabel(leaderboardMode.round)
      : null
  const selectedScoringIsLive = scoringIsLive || selectedBoardIsHistorical
  useEffect(() => {
    if (leaderboardModeIsCurrent) return
    if (!availableHistoricalRounds.includes(leaderboardMode.round)) {
      setLeaderboardMode({ type: 'current' })
      return
    }
    if (leaderboardMode.type === 'day' && leaderboardMode.round === 1) setLeaderboardMode({ type: 'thru', round: 1 })
  }, [availableHistoricalRounds, leaderboardMode, leaderboardModeIsCurrent])
  const groupsNeedLock = groupedFormat && !groupsFinalized
  const picksAreLocked = isLocked || scoringIsLive
  const pickSelectionOpen = !picksAreLocked && !groupsNeedLock
  const baseAmountDueCents = paymentQuote?.amountDueCents ?? 0
  const finalAmountDueCents = appliedPromo ? appliedPromo.amountDueCents : baseAmountDueCents
  const paymentCollectionOpen = isLocked || scoringIsLive
  const feeDueDate = formatShortDate(getTournamentSaturday(tournament?.start_date))
  const amountPaidCents = paymentQuote?.amountPaidCents ?? Number(pool.amount_paid_cents || 0)
  const paymentStatusForDisplay = tournamentIsPastOrCompleted ? 'active' : paymentStatus
  const showPaymentActions = !tournamentIsPastOrCompleted && paymentStatus !== 'active'
  const savedCards = paymentQuote?.savedCards || []
  const selectedSavedCard = savedCards.find(card => card.id === selectedSavedCardId) || null
  const useSavedCard = Boolean(selectedSavedCard && finalAmountDueCents > 0)
  const feeLabel = paymentStatusForDisplay === 'active'
    ? (amountPaidCents > 0 ? 'Paid' : 'Closed')
    : finalAmountDueCents === 0
      ? 'Free'
      : paymentCollectionOpen
        ? `${formatCents(finalAmountDueCents)} due`
        : `${formatCents(finalAmountDueCents)} current fee`
  const feeStatusLabel = paymentStatusForDisplay === 'active' && amountPaidCents > 0
    ? 'Paid'
    : paymentStatusForDisplay === 'active' && tournamentIsPastOrCompleted
      ? 'Closed'
      : finalAmountDueCents === 0
      ? 'Free'
      : paymentStatusForDisplay === 'active'
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
    ? paymentStatusForDisplay === 'active'
      ? (amountPaidCents > 0 ? `Results are live. Amount paid: ${formatCents(amountPaidCents)}.` : 'Results are live.')
      : 'No pool fee with the current entry count.'
    : paymentStatusForDisplay === 'active'
      ? amountPaidCents > 0
        ? `Results are live. Amount paid: ${formatCents(amountPaidCents)}.`
        : 'Results are live.'
      : isPoolFeePastDue(tournament?.start_date)
        ? `Payment is due${feeDueDate ? ` by ${feeDueDate}` : ' now'}.`
        : `Final fee is due Saturday of tournament week${feeDueDate ? ` (${feeDueDate})` : ''}.`
  const canInvitePlayers = isOwner && !isLocked && !scoringIsLive
  const canLeaveOwnEntry = !guestMode && Boolean(myEntry) && !isOwner
  const activeField = useMemo(() => field.filter(player => String(player.status || '').toLowerCase() !== 'wd'), [field])
  const fieldReady = activeField.length > 0
  const currentFieldNames = useMemo(() => new Set(activeField.map(player => player.name).filter(Boolean)), [activeField])
  const invalidMyPicks = !groupedFormat && fieldReady
    ? myPicks.filter(name => !currentFieldNames.has(name))
    : []
  const savedMyPicks = cleanPickList(myEntry?.golfer_picks)
  const myEntryPickActionLabel = groupsNeedLock ? 'View groups' : savedMyPicks.length > 0 ? 'Edit picks' : 'Make picks'
  const showMyEntryPickAction = Boolean(!publicView && !guestMode && myEntry && !picksAreLocked)
  const myEntryTabLabel = showMyEntryPickAction ? myEntryPickActionLabel : 'My Entry'
  const openMyEntryPicks = () => {
    setTab('my-entry')
    window.setTimeout(() => document.getElementById('make-picks')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }
  const picksChangedSinceSave = !picksMatch(myPicks, savedMyPicks)
  const hasRequiredPickCount = requiredPickCount > 0 && myPicks.length === requiredPickCount
  const picksComplete = groupedFormat
    ? hasRequiredPickCount && groupedPickValidation.valid
    : hasRequiredPickCount && invalidMyPicks.length === 0
  const savePicksDisabled = saving || !picksComplete || !picksChangedSinceSave
  const savePicksLabel = saving
    ? 'Saving...'
    : picksComplete
      ? picksChangedSinceSave ? 'Save picks' : 'Picks saved'
      : requiredPickCount > 0
        ? `Pick ${requiredPickCount} to save`
        : 'Save picks'
  const guestPicksSaved = guestMode && showGuestSavePanel
  const showGroupPreview = groupedFormat && groupsNeedLock && (fieldReady || pickGroups.length > 0)
  const showPickList = !guestPicksSaved && ((pickSelectionOpen && (fieldReady || (groupedFormat && pickGroups.length > 0))) || showGroupPreview)
  const showSelectedPicks = !guestPicksSaved && (myPicks.length > 0 || (!groupsNeedLock && (fieldReady || (groupedFormat && pickGroups.length > 0))))
  const visibleEntries = activeEntries
  const guestClaimUrl = guestEntryToken && myEntry?.id
    ? `/api/pool/claim-guest-entry?poolId=${encodeURIComponent(pool.id)}&token=${encodeURIComponent(guestEntryToken)}`
    : ''
  const guestClaimRedirect = guestClaimUrl ? encodeURIComponent(guestClaimUrl) : ''
  const guestLeaderboardUrl = myEntry?.id
    ? `${publicLeaderboardUrl || `/leaderboard/${pool.id}`}?entry=${encodeURIComponent(myEntry.id)}`
    : (publicLeaderboardUrl || `/leaderboard/${pool.id}`)
  const entryHasSavedFullName = Boolean(myEntry?.full_name_confirmed_at && typeof myEntry?.full_name === 'string' && myEntry.full_name.trim().length > 0)
  const fullNamePromptOpen = guestMode && !publicView && Boolean(myEntry && !entryHasSavedFullName)
  const entryDetailsDirty = entryNameValue.trim() !== (myEntry?.display_name || '') || fullNameValue.trim() !== runnerFullNameForEntry(myEntry)

  useEffect(() => {
    if (!currentPickDraftKey || picksAreLocked || guestPicksSaved) return
    const draftPicks = readPickDraft(currentPickDraftKey)
    if (draftPicks && !picksMatch(draftPicks, myPicks)) {
      setMyPicks(draftPicks)
    }
  }, [currentPickDraftKey, guestPicksSaved, picksAreLocked])

  useEffect(() => {
    if (!currentPickDraftKey || picksAreLocked || guestPicksSaved) return
    const savedPicks = cleanPickList(myEntry?.golfer_picks)
    if (!picksMatch(myPicks, savedPicks)) {
      writePickDraft(currentPickDraftKey, myPicks)
    }
  }, [currentPickDraftKey, guestPicksSaved, myEntry?.golfer_picks, myPicks, picksAreLocked])

  const maskHiddenPicks = useCallback((poolEntries: any[]) => {
    return poolEntries.map(entry => {
      const submittedPickCount = Array.isArray(entry.golfer_picks) ? entry.golfer_picks.length : 0
      const withdrawnPicks = isOwner && wdPickNames.size > 0 && Array.isArray(entry.golfer_picks)
        ? entry.golfer_picks.filter((name: string) => wdPickNames.has(name))
        : []
      const ownerWdMeta = isOwner ? { withdrawn_picks: withdrawnPicks } : {}
      const currentEntry = isCurrentEntry(entry)
      const privateMeta = isOwner || currentEntry
        ? {}
        : { user_id: null, full_name: null, full_name_confirmed_at: null, account_full_name: '', account_full_name_confirmed_at: null, notification_email: null, guest_entry_token_hash: null }
      if (picksAreLocked || currentEntry) return { ...entry, ...ownerWdMeta, ...privateMeta }
      return {
        ...entry,
        ...ownerWdMeta,
        ...privateMeta,
        submitted_pick_count: submittedPickCount,
        golfer_picks: [],
        picks_hidden: true,
      }
    })
  }, [isCurrentEntry, isOwner, picksAreLocked, wdPickNames])

  const refreshPoolEntries = useCallback(async () => {
    let data: any[] | null = null
    if (isOwner) {
      const res = await fetch(`/api/pools/${pool.id}/entries`, { cache: 'no-store' })
      if (res.ok) {
        const payload = await res.json().catch(() => ({}))
        data = Array.isArray(payload.entries) ? payload.entries : null
      }
    }

    if (!data) {
      if (!isOwner) return
      const query = supabase
        .from('gpp_entries')
        .select('id, pool_id, user_id, display_name, golfer_picks, total_score, counting_scores, rank, has_paid, payout_amount, is_removed, removed_reason, removed_at, created_at')
        .eq('pool_id', pool.id)

      const result = await query.order('created_at', { ascending: true })
      data = result.data || null
    }

    if (data) {
      const accountEmailByUserId = new Map(entriesRef.current
        .filter((entry: any) => entry.user_id && entry.account_email)
        .map((entry: any) => [entry.user_id, entry.account_email]))
      const accountFullNameByUserId = new Map(entriesRef.current
        .filter((entry: any) => entry.user_id && entry.account_full_name && entry.account_full_name_confirmed_at)
        .map((entry: any) => [entry.user_id, entry.account_full_name]))
      const accountFullNameConfirmedByUserId = new Map(entriesRef.current
        .filter((entry: any) => entry.user_id && entry.account_full_name_confirmed_at)
        .map((entry: any) => [entry.user_id, entry.account_full_name_confirmed_at]))
      const currentPrivateByEntryId = new Map(entriesRef.current
        .filter((entry: any) => isCurrentEntry(entry))
        .map((entry: any) => [entry.id, {
          full_name: entry.full_name || null,
          full_name_confirmed_at: entry.full_name_confirmed_at || null,
          notification_email: entry.notification_email || null,
        }]))
      const dataWithKnownEmails = data.map((entry: any) => {
        const currentPrivate = currentPrivateByEntryId.get(entry.id) as any
        const withAccountMeta = entry.user_id && !entry.account_email && (accountEmailByUserId.has(entry.user_id) || accountFullNameByUserId.has(entry.user_id))
          ? { ...entry, account_email: accountEmailByUserId.get(entry.user_id) || '', account_full_name: entry.account_full_name || accountFullNameByUserId.get(entry.user_id) || '', account_full_name_confirmed_at: entry.account_full_name_confirmed_at || accountFullNameConfirmedByUserId.get(entry.user_id) || null }
          : entry
        return currentPrivate ? { ...withAccountMeta, ...currentPrivate } : withAccountMeta
      })
      const safeData = maskHiddenPicks(dataWithKnownEmails)
      const nextMyEntry = safeData.find(isCurrentEntry) || null
      setEntries(safeData)
      setMyEntry(nextMyEntry)
      if (nextMyEntry) {
        const savedPicks = cleanPickList(nextMyEntry.golfer_picks)
        const draftPicks = readPickDraft(pickDraftKey(pool.id, nextMyEntry.id))
        setMyPicks(draftPicks && !picksMatch(draftPicks, savedPicks) ? draftPicks : savedPicks)
      }
    }
  }, [isCurrentEntry, isOwner, maskHiddenPicks, pool.id, supabase])

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
    if (!guestEntryToken || !myEntry?.id) return
    try {
      window.localStorage.setItem(`gpp_guest_entry:${pool.id}`, JSON.stringify({
        entryId: myEntry.id,
        token: guestEntryToken,
        displayName: myEntry.display_name || 'Your entry',
        fullName: runnerFullNameForEntry(myEntry),
      }))
    } catch {
      // Same-browser recovery is best effort.
    }
  }, [guestEntryToken, myEntry?.id, myEntry?.display_name, myEntry?.full_name, myEntry?.full_name_confirmed_at, pool.id])

  useEffect(() => {
    setEntryNameValue(myEntry?.display_name || '')
    setFullNameValue(runnerFullNameForEntry(myEntry) || '')
    setNotificationEmailValue(myEntry?.notification_email || '')
  }, [myEntry?.display_name, myEntry?.full_name, myEntry?.full_name_confirmed_at, myEntry?.notification_email])

  const updateGuestEntry = useCallback(async (payload: Record<string, unknown>) => {
    if (!myEntry?.id || !guestEntryToken) throw new Error('Missing guest entry token.')
    const res = await fetch('/api/pool/guest-entry', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: myEntry.id, token: guestEntryToken, ...payload }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not update guest entry.')
    return data.entry
  }, [guestEntryToken, myEntry?.id])

  const updateAccountEntry = useCallback(async (payload: Record<string, unknown>) => {
    if (!myEntry?.id) throw new Error('Missing entry.')
    const res = await fetch('/api/pool/account-entry', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: myEntry.id, poolId: pool.id, ...payload }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not update entry.')
    return data.entry
  }, [myEntry?.id, pool.id])

  useEffect(() => {
    if (groupedFormat || picksAreLocked || !myEntry || !fieldReady || invalidMyPicks.length === 0) return

    const nextPicks = myPicks.filter(name => currentFieldNames.has(name))
    const updatedEntry = { ...myEntry, golfer_picks: nextPicks }
    setMyPicks(nextPicks)
    setMyEntry(updatedEntry)
    setEntries(current => current.map(entry => entry.id === myEntry.id ? updatedEntry : entry))

    const saveTrimmedPicks = guestEntryToken
      ? updateGuestEntry({ golferPicks: nextPicks })
      : updateAccountEntry({ golferPicks: nextPicks })
    saveTrimmedPicks
      .then(() => {
        showToast('Field updated. Removed golfers no longer in the tournament.', 'info')
      })
      .catch(() => {
        showToast('Field updated. Review your picks before saving.', 'error')
      })
  }, [currentFieldNames, fieldReady, groupedFormat, guestEntryToken, invalidMyPicks.length, myEntry, myPicks, picksAreLocked, showToast, updateAccountEntry, updateGuestEntry])

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
      if (!isOwner || tab !== 'pool-settings' || !paymentQuote || paymentQuote.paymentStatus === 'active' || !showPaymentActions) return
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
  }, [finalAmountDueCents, isOwner, paymentQuote, paymentCollectionOpen, showPaymentActions, showToast, tab, useSavedCard])

  useEffect(() => {
    const shouldKeepCard = isOwner && tab === 'pool-settings' && showPaymentActions && paymentQuote?.paymentStatus !== 'active' && paymentCollectionOpen && finalAmountDueCents > 0 && !useSavedCard
    if (shouldKeepCard) return
    if (paymentCardRef.current) {
      paymentCardRef.current.destroy?.()
      paymentCardRef.current = null
    }
    setPaymentCardReady(false)
  }, [finalAmountDueCents, isOwner, paymentCollectionOpen, showPaymentActions, tab, paymentQuote?.paymentStatus, useSavedCard])

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
      const paymentMessage = data.savedCardError ? `${successMessage} Card was not saved.` : successMessage
      trackGppEvent('payment_completed', {
        pool_id: pool.id,
        tournament: tournament?.name || null,
        entry_count: activeEntries.length,
        amount_due_cents: finalAmountDueCents,
        amount_paid_cents: data.amountDueCents ?? finalAmountDueCents,
        discount_cents: data.discountCents ?? 0,
        is_paid: true,
      })
      setPaymentFeedback(paymentMessage)
      setStatusMessage(paymentMessage)
      showToast(paymentMessage, data.savedCardError ? 'info' : 'success')
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
      const res = await fetch(`/api/tournaments/leaderboard?id=${tournament.external_id}`)
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
          setLeaderboardLastUpdated(data.lastScoresFetch || null)
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
    if (!picksComplete) {
      const firstMissing = groupedPickValidation.missing[0]?.group.label
      const firstOver = groupedPickValidation.over[0]?.group.label
      const message = firstOver
        ? `${firstOver} has too many picks.`
        : firstMissing
          ? `${firstMissing} needs ${picksPerGroup} picks.`
          : requiredPickCount > 0
            ? `Pick ${requiredPickCount} golfers to save.`
            : 'Complete your picks to save.'
      setStatusMessage(message)
      showToast(message, 'error')
      setTimeout(() => setStatusMessage(''), 2500)
      return
    }
    if (groupedFormat) {
      const validation = groupedPickValidation
      if (!validation.valid) {
        const firstMissing = validation.missing[0]?.group.label
        const firstOver = validation.over[0]?.group.label
        const message = firstOver
          ? `${firstOver} has too many picks.`
          : firstMissing
            ? `${firstMissing} needs ${picksPerGroup} picks.`
            : `Pick ${picksPerGroup} from each group.`
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
    if (!picksChangedSinceSave) {
      setStatusMessage('Picks already saved.')
      showToast('Picks already saved.', 'info')
      setTimeout(() => setStatusMessage(''), 2500)
      return
    }
    setSaving(true)
    let error: any = null
    let savedEntry: any = null
    try {
      savedEntry = guestEntryToken
        ? await updateGuestEntry({ golferPicks: myPicks })
        : await updateAccountEntry({ golferPicks: myPicks })
    } catch (saveError: any) {
      error = saveError
    }
    if (!error) {
      const updatedEntry = savedEntry ? { ...myEntry, ...savedEntry } : { ...myEntry, golfer_picks: myPicks }
      clearPickDraft(currentPickDraftKey)
      setMyEntry(updatedEntry)
      setEntries(entries.map(entry => entry.id === myEntry.id ? updatedEntry : entry))
      setStatusMessage('Picks saved.')
      showToast('Picks saved.', 'success')
      if (guestEntryToken) {
        setGuestSaveStep('email')
        setShowGuestSavePanel(true)
      }
      if (!guestEntryToken && !entryEditOnly) setTab('leaderboard')
      setTimeout(() => setStatusMessage(''), 2500)
    } else {
      showToast('Could not save picks.', 'error')
    }
    setSaving(false)
  }

  async function saveEntryName() {
    if (!myEntry) return
    const nextName = entryNameValue.trim()
    const nextFullName = fullNameValue.trim().replace(/\s+/g, ' ')
    const nextEmail = notificationEmailValue.trim().toLowerCase()
    if (!nextName) {
      setStatusMessage('Entry name cannot be blank.')
      showToast('Entry name cannot be blank.', 'error')
      return
    }
    if (!nextFullName) {
      setStatusMessage('Full name cannot be blank.')
      showToast('Enter your full name for the pool runner.', 'error')
      return
    }
    if (guestEntryToken && nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setStatusMessage('Enter a valid email address or leave it blank.')
      showToast('Enter a valid email address or leave it blank.', 'error')
      return
    }
    if (!entryDetailsDirty && (!guestEntryToken || nextEmail === (myEntry.notification_email || ''))) return
    const duplicateEntry = entries.find(entry => !entry.is_removed && entry.id !== myEntry.id && normalizeEntryName(entry.display_name) === normalizeEntryName(nextName))
    if (duplicateEntry) {
      setStatusMessage(DUPLICATE_ENTRY_NAME_MESSAGE)
      showToast(DUPLICATE_ENTRY_NAME_MESSAGE, 'error')
      return
    }

    setEntryNameSaving(true)
    let error: any = null
    let updatedEntry: any = null
    try {
      if (guestEntryToken) {
        updatedEntry = await updateGuestEntry({ displayName: nextName, fullName: nextFullName, notificationEmail: nextEmail || null })
      } else {
        updatedEntry = await updateAccountEntry({ displayName: nextName, fullName: nextFullName })
        if (updatedEntry) {
          const { data: { user } } = await supabase.auth.getUser()
          await supabase
            .from('gpp_profiles')
            .upsert({ id: userId, email: user?.email || '', display_name: nextName, full_name: nextFullName, full_name_confirmed_at: new Date().toISOString() } as any)
          if (user) {
            await supabase.auth.updateUser({
              data: {
                ...user.user_metadata,
                display_name: nextName,
                full_name: nextFullName,
              },
            }).catch(() => undefined)
          }
        }
      }
    } catch (guestError: any) {
      error = guestError
    }

    if (error) {
      const message = String(error?.message || '').includes('gpp_entries_active_pool_name_unique') || String(error?.message || '').includes(DUPLICATE_ENTRY_NAME_MESSAGE)
        ? DUPLICATE_ENTRY_NAME_MESSAGE
        : 'Could not update entry details.'
      setStatusMessage(message)
      showToast(message, 'error')
    } else {
      const nextEntry = updatedEntry || { ...myEntry, display_name: nextName, full_name: nextFullName, full_name_confirmed_at: new Date().toISOString(), notification_email: nextEmail || null }
      setMyEntry(nextEntry)
      setEntries(entries.map(entry => entry.id === myEntry.id ? nextEntry : entry))
      setStatusMessage('Entry details updated.')
      showToast('Entry details updated.', 'success')
      setTimeout(() => setStatusMessage(''), 2500)
    }
    setEntryNameSaving(false)
  }

  async function saveFullNamePrompt() {
    if (!myEntry) return
    const nextFullName = fullNameValue.trim().replace(/\s+/g, ' ')
    if (!nextFullName) {
      showToast('Enter your full name for the pool runner.', 'error')
      return
    }

    setFullNameSaving(true)
    let error: any = null
    let updatedEntry: any = null
    try {
      if (guestEntryToken) {
        updatedEntry = await updateGuestEntry({ fullName: nextFullName })
      } else {
        updatedEntry = await updateAccountEntry({ fullName: nextFullName })
        if (updatedEntry) {
          const profileName = myEntry.display_name || entryNameValue.trim() || nextFullName
          const { data: { user } } = await supabase.auth.getUser()
          await supabase
            .from('gpp_profiles')
            .upsert({ id: userId, email: user?.email || '', display_name: profileName, full_name: nextFullName, full_name_confirmed_at: new Date().toISOString() } as any)
          if (user) {
            await supabase.auth.updateUser({
              data: {
                ...user.user_metadata,
                full_name: nextFullName,
              },
            }).catch(() => undefined)
          }
        }
      }
    } catch (guestError: any) {
      error = guestError
    }

    if (error) {
      showToast('Could not save full name.', 'error')
    } else {
      const nextEntry = updatedEntry || { ...myEntry, full_name: nextFullName, full_name_confirmed_at: new Date().toISOString() }
      setMyEntry(nextEntry)
      setEntries(entries.map(entry => entry.id === myEntry.id ? nextEntry : entry))
      setFullNameValue(nextFullName)
      showToast('Full name saved.', 'success')
    }
    setFullNameSaving(false)
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

  // Remove entry: owners can remove entrants; signed-in non-owners can leave their own unlocked pool.
  async function removeEntry(entryId: string) {
    if (removingEntryId) return
    const leavingOwnEntry = !isOwner && myEntry?.id === entryId
    setRemovingEntryId(entryId)
    try {
      const res = await fetch(`/api/pools/${pool.id}/entries`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leavingOwnEntry ? { action: 'leave', entryId } : { entryId, removedReason: removeReason }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const nextRemovedReason = leavingOwnEntry ? 'Left pool' : data.removedReason || removeReason || 'Removed by pool runner'
        setEntries(current => current.map(e => e.id === entryId ? { ...e, is_removed: true, removed_reason: nextRemovedReason } : e))
        setRemoveTarget(null); setRemoveReason('')
        if (leavingOwnEntry) {
          setMyEntry(null)
          setMyPicks([])
          setEntryNameValue('')
          setFullNameValue('')
          showToast('You left the pool.', 'success')
        } else {
          showToast('Entry removed.', 'success')
          refreshPaymentQuote()
          void refreshPoolEntries()
        }
      } else {
        showToast(data.error || (leavingOwnEntry ? 'Could not leave pool.' : 'Could not remove entry.'), 'error')
      }
    } catch {
      showToast(leavingOwnEntry ? 'Could not leave pool.' : 'Could not remove entry.', 'error')
    } finally {
      setRemovingEntryId(null)
    }
  }

  // Lock pool permanently (admin)
  async function lockPool() {
    if (scoringIsLive || isLocked) return
    if (groupedFormat && !groupsFinalized) {
      showToast('Lock groups before locking picks.', 'error')
      return
    }
    const res = await fetch(`/api/pools/${pool.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock' }),
    })
    if (res.ok) {
      setPoolLocked(true)
      setShowLockConfirm(false)
      setStatusMessage('Pool locked. New entries and pick changes are closed.')
      showToast('Pool locked. Picks are closed.', 'success')
      refreshPaymentQuote()
    } else {
      const data = await res.json().catch(() => ({}))
      setStatusMessage(data.error || 'Could not lock pool.')
      showToast(data.error || 'Could not lock pool.', 'error')
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
    const res = await fetch(`/api/pools/${pool.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', name: nextName }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setStatusMessage(data.error || 'Could not update pool name.')
      showToast(data.error || 'Could not update pool name.', 'error')
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
    const res = await fetch(`/api/pools/${pool.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: deleteConfirm }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setStatusMessage(data.error || 'Could not delete pool.')
      showToast(data.error || 'Could not delete pool.', 'error')
      return
    }
    showToast('Pool deleted. Sending you back to the dashboard.', 'success')
    router.push('/dashboard')
  }

  // Compute scored entries
  const preScoringPlayerByName = playerStatusByName(leaderboard, field)
  const useFrozenResults = leaderboardModeIsCurrent && pool.is_completed && hasCompleteFrozenResults(visibleEntries)
  const scoredEntries: ScoredEntry[] = useFrozenResults
    ? visibleEntries
        .filter(entry => !entry.is_removed)
        .map(buildFrozenResultEntry)
        .sort((a, b) => (a.rank ?? 999999) - (b.rank ?? 999999) || (a.totalScore ?? 999999) - (b.totalScore ?? 999999) || a.displayName.localeCompare(b.displayName))
    : selectedScoringIsLive
      ? scoreEntriesForLeaderboard(
          visibleEntries,
          selectedLeaderboard,
          { countScores: pool.count_scores, obRuleEnabled: pool.ob_rule_enabled, obPenaltyStrokes: pool.ob_penalty_strokes }
        )
      : visibleEntries.map(entry => buildPreScoringEntry(entry, pool.count_scores, preScoringPlayerByName))
  function orderPicksForDisplay(picks: PickScore[]) {
    if (!selectedScoringIsLive || !groupedFormat || pickGroups.length === 0) return picks
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
  const leaderboardByName = playerStatusByName(leaderboardRows, field)
  const golferNamePeers = leaderboardRows
    .map(player => player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim())
    .filter(Boolean)
  const harePickMap = leaderboardModeIsCurrent && !publicView ? buildHarePickMap(scoredEntries, 2) : new Map()
  const tortoisePickMap = leaderboardModeIsCurrent && !publicView ? buildTortoisePickMap(scoredEntries, myEntry?.id, 2) : new Map()
  const showLeverageLegend = leaderboardModeIsCurrent && !publicView && (harePickMap.size > 0 || tortoisePickMap.size > 0)

  async function copyTextWithToast(message: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(message)
      showToast(successMessage, 'success')
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
      showToast(successMessage, 'success')
    }
  }

  async function copyNeedsPicksReminder() {
    const entriesToCopy = entriesNeedingPicksNoEmail.length ? entriesNeedingPicksNoEmail : entriesNeedingPicks
    if (!entriesToCopy.length) {
      showToast('Everyone has picks in.', 'success')
      return
    }
    const names = entriesToCopy.map(entry => entry.display_name || 'Player').join('\n')
    const lockDay = formatDateOnlyWeekday(tournament?.start_date) || 'tournament day'
    const message = `Still need picks:\n\n${names}\n\nDon't forget to make your picks before the first tee time ${lockDay} for ${poolName} — ${tournament?.name || 'the tournament'}.${inviteUrl ? `\n\n${inviteUrl}` : ''}`
    await copyTextWithToast(message, entriesNeedingPicksNoEmail.length ? 'No-email reminder copied.' : 'Reminder copied.')
  }

  async function sendMissingPicksReminder() {
    if (!entriesNeedingPicksWithEmail.length) {
      showToast('No unfinished entries have email on file.', 'info')
      return
    }
    setMissingReminderSending(true)
    setMissingReminderFeedback('')
    try {
      const res = await fetch('/api/pools/missing-picks-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: pool.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send reminders.')
      const message = `Sent ${data.sent || 0}. ${data.noEmail || entriesNeedingPicksNoEmail.length} need manual follow-up.${data.duplicate ? ` ${data.duplicate} already got one today.` : ''}`
      setMissingReminderFeedback(message)
      showToast(message, 'success')
    } catch (error: any) {
      const message = error?.message || 'Could not send reminders.'
      setMissingReminderFeedback(message)
      showToast(message, 'error')
    } finally {
      setMissingReminderSending(false)
    }
  }

  async function copyWdTextReminder() {
    if (!wdPicksNoEmail.length) {
      showToast('No WD picks need manual follow-up.', 'success')
      return
    }
    const lines = wdPicksNoEmail.map(item => `${item.entry.display_name || 'Player'} — ${item.withdrawnPicks.join(', ')}`).join('\n')
    const message = `WD picks need replacement:\n\n${lines}\n\nThese players need to swap picks before entries lock for ${poolName}.${inviteUrl ? `\n\n${inviteUrl}` : ''}`
    await copyTextWithToast(message, 'WD follow-up copied.')
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

  async function copyGuestLeaderboardLink() {
    const url = guestLeaderboardUrl.startsWith('http') ? guestLeaderboardUrl : `${window.location.origin}${guestLeaderboardUrl}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Leaderboard link copied.', 'success')
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
      showToast('Leaderboard link copied.', 'success')
    }
  }

  async function saveGuestEmailForUpdates() {
    if (!myEntry?.id || !guestEntryToken) return
    const email = notificationEmailValue.trim().toLowerCase()
    if (!email) {
      showToast('Enter your email first.', 'info')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Enter a valid email address.', 'error')
      return
    }

    setGuestEmailSaving(true)
    const hadNotificationEmail = Boolean(myEntry.notification_email?.trim())
    try {
      const updatedEntry = await updateGuestEntry({ notificationEmail: email })
      setMyEntry(updatedEntry)
      setEntries(current => current.map(entry => entry.id === myEntry.id ? updatedEntry : entry))
      setNotificationEmailValue(email)
      if (!hadNotificationEmail) {
        await fetch('/api/pools/entry-saved-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poolId: pool.id, entryId: myEntry.id, token: guestEntryToken }),
        }).catch(() => {})
      }
      showToast(hadNotificationEmail ? 'Email updated.' : 'Email saved. We sent your entry link.', 'success')
      setGuestSaveStep('account')
    } catch (error: any) {
      showToast(error?.message || 'Could not save email.', 'error')
    } finally {
      setGuestEmailSaving(false)
    }
  }

  async function createGuestAccount() {
    if (!myEntry?.id || !guestEntryToken || !guestClaimUrl) return
    const email = notificationEmailValue.trim().toLowerCase()
    const password = guestAccountPassword.trim()
    setGuestAccountError('')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGuestAccountError('Enter your email first.')
      setGuestSaveStep('email')
      return
    }
    if (password.length < 6) {
      setGuestAccountError('Use at least 6 characters.')
      return
    }

    setGuestAccountLoading(true)
    try {
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: myEntry.display_name || 'Player',
          fullName: runnerFullNameForEntry(myEntry) || myEntry.display_name || 'Player',
          marketingOptIn: false,
        }),
      })
      const signupData = await signupRes.json().catch(() => ({}))
      if (!signupRes.ok) throw new Error(signupData.error || 'Could not create account.')

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      window.localStorage.removeItem(`gpp_guest_entry:${pool.id}`)
      window.location.href = guestClaimUrl
    } catch (error: any) {
      setGuestAccountError(error?.message || 'Could not create account.')
    } finally {
      setGuestAccountLoading(false)
    }
  }

  function csvCell(value: unknown) {
    const text = value === null || value === undefined ? '' : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }

  function downloadEntriesCsv() {
    const rows = entries.map(entry => {
      const scored = scoredEntries.find(scoredEntry => scoredEntry.entryId === entry.id)
      const picks = Array.isArray(entry.golfer_picks) ? entry.golfer_picks : []
      return [
        entry.display_name || 'Player',
        runnerFullNameForEntry(entry),
        runnerEmailForEntry(entry),
        picks.length > 0 ? 'Yes' : 'No',
        entry.is_removed ? 'removed' : 'active',
        picks.length,
        scored?.rank || entry.rank || '',
        scored?.totalScore ?? entry.total_score ?? '',
      ]
    })
    const csv = [
      ['Leaderboard name', 'Full name', 'Email', 'Confirmed', 'Status', 'Picks made', 'Rank', 'Total score'],
      ...rows,
    ].map(row => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${poolName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'pool'}-entries.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('Entries CSV downloaded.', 'success')
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
        ? `${roundMenuLabel(leaderboardMode.round)} scores`
        : isFinalRound(leaderboardMode.round, hasPlayoffScores) ? 'Final standings' : `Scores through ${roundMenuLabel(leaderboardMode.round)}`
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
      link.rel = 'noopener'
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
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

  const entryDetailsPanel = !guestMode && myEntry ? (
    <section className="mb-4 border-2 border-[#123c2f] bg-white shadow-[5px_5px_0_#d8cab0]">
      <div className="border-b border-[#d8cab0] bg-[#fbf7ed] px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6724]">Entry details</p>
        <h3 className="mt-1 text-lg font-black text-[#123c2f]">Change your leaderboard name</h3>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-1 block text-sm font-medium text-stone-700">Leaderboard name</label>
          <input
            type="text"
            value={entryNameValue}
            onChange={e => setEntryNameValue(e.target.value)}
            placeholder="Name shown on leaderboard"
            maxLength={60}
            disabled={picksAreLocked}
            className="w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-stone-100 disabled:text-stone-500"
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-sm font-medium text-stone-700">Full name</label>
          <input
            type="text"
            value={fullNameValue}
            onChange={e => setFullNameValue(e.target.value.slice(0, 80))}
            placeholder="Name for the pool runner"
            maxLength={80}
            autoComplete="name"
            disabled={picksAreLocked}
            className="w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-stone-100 disabled:text-stone-500"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-[#d8cab0] bg-[#fbf7ed] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold text-stone-600">Leaderboard name is public. Full name stays private for the runner.</p>
        <button
          type="button"
          onClick={saveEntryName}
          disabled={entryNameSaving || picksAreLocked || !entryNameValue.trim() || !fullNameValue.trim() || !entryDetailsDirty}
          className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black uppercase text-white transition-colors hover:bg-[#0f2f25] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {picksAreLocked ? 'Names locked' : entryNameSaving ? 'Saving...' : entryDetailsDirty ? 'Save entry details' : 'Saved'}
        </button>
      </div>
    </section>
  ) : null

  const removeTargetEntry = removeTarget ? entries.find(entry => entry.id === removeTarget) : null
  const removeTargetName = typeof removeTargetEntry?.display_name === 'string' && removeTargetEntry.display_name.trim() ? removeTargetEntry.display_name.trim() : 'this entry'
  const removingOwnEntry = Boolean(removeTarget && !isOwner && myEntry?.id === removeTarget)

  return (
    <div className={guestMode ? 'mx-auto max-w-4xl' : undefined}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {fullNamePromptOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#123c2f]/65 px-4 py-6">
          <div className="w-full max-w-md border-2 border-[#123c2f] bg-white p-5 shadow-[8px_8px_0_#d8cab0]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6724]">Pool runner</p>
            <h2 className="mt-1 text-2xl font-black text-[#123c2f]">Add your full name</h2>
            <p className="mt-1 text-sm font-semibold text-[#657168]">Only the pool runner sees this.</p>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-bold text-stone-700">Full name</label>
              <input
                type="text"
                value={fullNameValue}
                onChange={event => setFullNameValue(event.target.value.slice(0, 80))}
                maxLength={80}
                autoComplete="name"
                autoFocus
                className="w-full rounded-none border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-[#123c2f] focus:outline-none focus:ring-2 focus:ring-[#d8cab0]"
              />
            </div>
            <button
              type="button"
              onClick={saveFullNamePrompt}
              disabled={fullNameSaving || !fullNameValue.trim()}
              className="mt-4 w-full border-2 border-[#123c2f] bg-[#123c2f] px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#0f2f25] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fullNameSaving ? 'Saving...' : 'Save and continue'}
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      {!guestMode && (
      <div className="mb-6">
        {!publicView ? <BackButton /> : null}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold">{poolName}</h1>
            <p className="mt-1 break-words text-stone-600">{tournament?.name || 'Tournament'} at {tournament?.course || 'TBD'}</p>
          </div>
          {showLivePulse && <LivePulseBadge />}
        </div>
        {!publicView && !entryEditOnly && !scoringIsLive && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {isOwner && pool.passcode ? <span className="text-stone-600">Passcode: <span className="text-emerald-700 font-mono font-semibold">{pool.passcode}</span></span> : null}
          <span className="text-stone-600">{activeEntries.length} {activeEntries.length === 1 ? 'entry' : 'entries'}</span>
          <span className="text-stone-600">{submittedPickCount} with picks</span>
          <span className="text-stone-600">Field: {activeField.length || ((tournament?.field_json as GolfPlayer[] | undefined)?.filter(player => String(player.status || '').toLowerCase() !== 'wd').length || 0)} golfers</span>
          {showMyEntryPickAction && (
            <button type="button" onClick={openMyEntryPicks} className="border border-[#123c2f] bg-white px-2.5 py-1 text-xs font-black uppercase tracking-[0.08em] text-[#123c2f] hover:bg-[#fbf7ed]">
              {myEntryPickActionLabel}
            </button>
          )}
          {picksAreLocked && <span className="text-amber-700">Picks closed</span>}
          {!picksAreLocked && groupsNeedLock && <span className="text-amber-700">Groups pending</span>}
          {pool.is_completed && <span className="text-emerald-700">Final results</span>}
        </div>}
      </div>
      )}

      {statusMessage && <div className="mb-4 rounded-none border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{statusMessage}</div>}

      {!entryEditOnly && !publicView && isOwner && groupedFormat && !groupsFinalized && (
        <div className="mb-6 rounded-none border-2 border-[#123c2f] bg-[#fbf7ed] p-4 shadow-[5px_5px_0_#d8cab0]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg font-bold text-emerald-950">Groups are not locked yet.</p>
              <p className="mt-1 text-sm text-stone-700">Groups auto-lock Tuesday morning of tournament week. You can lock them sooner once the official field is posted.</p>
            </div>
            <button
              type="button"
              onClick={finalizeGroups}
              disabled={finalizingGroups}
              className="gpp-3d gpp-button-3d gpp-button-wrap text-sm disabled:opacity-50"
            >
              <span className="gpp-button-face px-4 py-2">{finalizingGroups ? 'Locking...' : 'Lock groups now'}</span>
            </button>
          </div>
        </div>
      )}

      {!entryEditOnly && isOwner && showPaymentActions && (
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

      {!entryEditOnly && !publicView && canInvitePlayers && (
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
      {!entryEditOnly && !publicView && !guestMode && (
      <div className="flex gap-1 mb-6 bg-stone-100 rounded-none p-1 inline-flex border border-stone-200">
        {(['leaderboard', 'my-entry', ...(isOwner ? ['pool-settings'] as Tab[] : [])] as Tab[]).map(t => (
          <button key={t} onClick={() => selectPoolTab(t)}
            className={`px-4 py-2 rounded-none text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-emerald-900' : 'text-stone-600 hover:text-emerald-800'
            }`}>
            {t === 'leaderboard' ? 'Leaderboard' : t === 'my-entry' ? myEntryTabLabel : 'Pool Settings'}
          </button>
        ))}
      </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div>
          {scoredEntries.length === 0 ? (
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
              {showMyEntryPickAction && (
                <button
                  type="button"
                  onClick={openMyEntryPicks}
                  className="border-2 border-[#123c2f] bg-[#fbf7ed] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#123c2f] transition-colors hover:bg-white"
                >
                  {myEntryPickActionLabel}
                </button>
              )}
              {myEntry && scoredEntries.length >= 10 && scoredEntries.some(entry => entry.entryId === myEntry.id) && (
                <button
                  type="button"
                  onClick={jumpToMyEntry}
                  className="border-2 border-[#123c2f] bg-[#123c2f] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-white shadow-[2px_2px_0_#b58a3a] transition-colors hover:bg-[#0f2f25]"
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
                  <p className="mx-auto mt-1 max-w-[98%] truncate text-[10px] font-black uppercase tracking-[0.04em] text-[#005b3c] sm:text-xs sm:tracking-[0.08em]" title={poolName}>{poolName}</p>
                  {availableHistoricalRounds.length > 0 && (
                    <details
                      className="relative z-50 mx-auto mt-2 w-fit text-left"
                      open={leaderboardMenuOpen}
                      onToggle={event => setLeaderboardMenuOpen(event.currentTarget.open)}
                    >
                      <summary className="inline-flex h-9 cursor-pointer list-none items-center justify-center border-2 border-[#123c2f] bg-white px-3 text-[10px] font-black uppercase leading-none tracking-[0.1em] text-[#123c2f] shadow-[2px_2px_0_#d8cab0] marker:hidden [&::-webkit-details-marker]:hidden">
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
                            <div className="px-3 pb-1 pt-2 text-[9px] text-[#657168]">{isFinalRound(round, hasPlayoffScores) ? 'Final' : roundMenuLabel(round)}</div>
                            <button
                              type="button"
                              onClick={() => { setLeaderboardMode({ type: 'thru', round }); setLeaderboardMenuOpen(false) }}
                              className={`block w-full px-3 py-2 text-left ${leaderboardMode.type === 'thru' && leaderboardMode.round === round ? 'bg-[#fbf7ed] shadow-[inset_4px_0_0_#b58a3a]' : ''}`}
                            >
                              {cumulativeRoundLabel(round, hasPlayoffScores)}
                            </button>
                            {round > 1 ? (
                              <button
                                type="button"
                                onClick={() => { setLeaderboardMode({ type: 'day', round }); setLeaderboardMenuOpen(false) }}
                                className={`block w-full px-3 py-2 text-left ${leaderboardMode.type === 'day' && leaderboardMode.round === round ? 'bg-[#fbf7ed] shadow-[inset_4px_0_0_#b58a3a]' : ''}`}
                              >
                                {roundMenuLabel(round)} Only
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {selectedBoardIsHistorical ? <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#657168]">{historicalBoardCaption(leaderboardMode, hasPlayoffScores)}</p> : null}
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
                    const hasPicks = entry.picks.length > 0
                    const picksHidden = entry.picks.includes('Picks hidden')
                    const showPreScoringWaiting = !selectedScoringIsLive && !hasPicks
                    const countingPicks = hasPicks ? orderPicksForDisplay(entry.pickScores.filter(pick => pick.counted)).slice(0, pool.count_scores) : []
                    const outOfBoundsPicks = hasPicks ? orderPicksForDisplay(entry.pickScores.filter(pick => !pick.counted)) : []
                    const pickGridColumns = pickGridColumnCount(pool.count_scores)
                    const allPickNames = golferNamePeers
                    const hareNames = isMe ? harePickMap.get(entry.entryId) : undefined
                    const tortoiseNames = !isMe ? tortoisePickMap.get(entry.entryId) : undefined
                    const isEntryOpen = openEntryIds.has(entry.entryId) || forceOpenEntryId === entry.entryId
                    const isHighlighted = highlightedEntryId === entry.entryId
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
                        className={`group border-b-2 border-[#d8cab0] transition-colors ${isHighlighted ? 'bg-[#eaf5ec]' : ''}`}
                      >
                        <summary className={`grid min-h-[58px] cursor-pointer list-none grid-cols-[34px_minmax(0,1fr)_58px_18px] items-center gap-1 px-2 py-2 text-left transition-colors sm:grid-cols-[44px_minmax(0,1fr)_74px_20px] sm:gap-2 [&::-webkit-details-marker]:hidden ${highlightedEntrySummaryBg(isHighlighted)}`}>
                          <div className="text-center text-xl font-black text-[#b21e23]">{entry.rank || '—'}</div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {isMe && <span aria-label="Your entry" className="h-2.5 w-2.5 shrink-0 bg-[#005b3c]" />}
                              <span className="min-w-0 flex-1 truncate text-sm font-black uppercase leading-tight tracking-[0.02em] text-[#111] sm:text-base sm:tracking-[0.04em]" title={entry.displayName}>{entry.displayName}</span>
                            </div>
                            {(picksHidden || showPreScoringWaiting || entry.obStandIns > 0) && (
                              <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                                {picksHidden ? 'Picks hidden until lock' : selectedScoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-black leading-none ${scoreClass(entry.totalScore)}`}>{formatScore(entry.totalScore)}</div>
                            {totalScoreSubLabel && entry.todayScore !== null ? (
                              <div className="mt-0.5 whitespace-nowrap text-[8px] font-black uppercase tracking-normal text-[#777] sm:text-[9px] sm:tracking-[0.08em]">{totalScoreSubLabel} {formatScore(entry.todayScore)}</div>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-center text-[#111]" aria-label={isEntryOpen ? 'Collapse entry' : 'Expand entry'}>
                            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d={isEntryOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
                            </svg>
                            <span className="sr-only">Toggle entry</span>
                          </div>
                        </summary>
                        <div className="grid border-t border-[#d8cab0] bg-[#fbfbf5]" style={{ gridTemplateColumns: `repeat(${pickGridColumns}, minmax(0, 1fr))` }}>
                          {Array.from({ length: pool.count_scores }, (_, i) => {
                            const pick = countingPicks[i]
                            const isEndOfGridRow = (i + 1) % pickGridColumns === 0
                            return (
                              <div key={i} className="relative border-r border-t border-[#d8cab0] px-1 py-1.5 text-center" style={{ borderRightWidth: isEndOfGridRow ? 0 : undefined }}>
                                <>{pick?.isObStandIn ? <ObMarkerCorner /> : <LeverageMarkerCorner kind={pick && hareNames?.has(normalizePickName(pick.name)) ? 'hare' : pick && tortoiseNames?.has(normalizePickName(pick.name)) ? 'tortoise' : undefined} />}</>
                                {pick && pickGroupShortLabel(pick.name) ? (
                                  <span className="absolute left-0.5 top-0.5 z-[2] inline-flex items-center border border-[#123c2f] bg-[#123c2f] px-[3px] py-[1px] text-[8px] font-black leading-none text-white">
                                    {pickGroupShortLabel(pick.name)}
                                  </span>
                                ) : null}
                                <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{formatPickScore(pick)}</div>
                                <div className="mt-1 truncate text-[clamp(8px,2.2vw,10px)] font-black uppercase leading-none tracking-[-0.03em] text-[#111] sm:text-xs sm:tracking-[-0.01em]">
                                  {pick ? shortName(pick.name, allPickNames) : 'Waiting'}
                                </div>
                                <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? (pick.name === 'Waiting' ? 'Waiting' : [pickGroupShortLabel(pick.name), activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)].filter(Boolean).join(' · ')) : 'Waiting'}</div>
                              </div>
                            )
                          })}
                        </div>
                        {outOfBoundsPicks.length > 0 && (
                          <div className="border-t-2 border-[#d8cab0] bg-[#efeee6] px-2 py-1.5 text-left">
                            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#111]">{outOfBoundsLabel(selectedScoringIsLive, pool.count_scores)}</div>
                            <div className="flex flex-wrap gap-1">
                              {outOfBoundsPicks.map(pick => (
                                <span key={`${entry.entryId}-${pick.name}`} className="relative inline-flex items-center gap-1 border border-[#d8cab0] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                                  {pick.isObStandIn ? <ObMarker /> : null}
                                  {hareNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="hare" /> : null}
                                  {tortoiseNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="tortoise" /> : null}
                                  {pickGroupShortLabel(pick.name) ? (
                                    <span className="inline-flex shrink-0 items-center border border-[#123c2f] bg-[#123c2f] px-[3px] py-[1px] text-[7px] font-black leading-none text-white">
                                      {pickGroupShortLabel(pick.name)}
                                    </span>
                                  ) : null}
                                  <span><span className={scoreClass(pick.scoreToPar)}>{formatPickScore(pick)}</span> {shortName(pick.name, allPickNames)} <span className="text-[#555]">{activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)}</span></span>
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
                        const hasPicks = entry.picks.length > 0
                        const picksHidden = entry.picks.includes('Picks hidden')
                        const showPreScoringWaiting = !selectedScoringIsLive && !hasPicks
                        const countingPicks = hasPicks ? orderPicksForDisplay(entry.pickScores.filter(pick => pick.counted)).slice(0, pool.count_scores) : []
                        const outOfBoundsPicks = hasPicks ? orderPicksForDisplay(entry.pickScores.filter(pick => !pick.counted)) : []
                        const allPickNames = golferNamePeers
                        const hareNames = isMe ? harePickMap.get(entry.entryId) : undefined
                        const tortoiseNames = !isMe ? tortoisePickMap.get(entry.entryId) : undefined
                        const isHighlighted = highlightedEntryId === entry.entryId
                        return (
                          <Fragment key={entry.entryId}>
                            <tr id={`entry-row-${entry.entryId}`} key={`${entry.entryId}-top`} className={`transition-colors ${highlightedEntryRowBg(isHighlighted)}`}>
                              <td className={`border-b border-r-2 border-[#d8cab0] px-1 py-1.5 text-center text-xl font-black text-[#b21e23] ${highlightedEntryRowBg(isHighlighted)}`}>
                                {entry.rank || '—'}
                              </td>
                              <td className={`border-b border-r-2 border-[#d8cab0] px-2 py-1.5 text-left ${highlightedEntryRowBg(isHighlighted)}`}>
                                <div className="flex min-w-0 items-center gap-1.5">
                                  {isMe && <span aria-label="Your entry" className="h-2.5 w-2.5 shrink-0 bg-[#005b3c]" />}
                                  <span className="truncate text-base font-black uppercase tracking-[0.02em] text-[#111]" title={entry.displayName}>{entry.displayName}</span>
                                </div>
                                {(picksHidden || showPreScoringWaiting || entry.obStandIns > 0) && (
                                  <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                                    {picksHidden ? 'Picks hidden until lock' : selectedScoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                                  </div>
                                )}
                              </td>
                              {Array.from({ length: pool.count_scores }, (_, i) => {
                                const pick = countingPicks[i]
                                return (
                                  <td key={i} title={pick?.name || ''} className={`relative border-b border-r border-[#d8cab0] px-1 py-1 text-center align-middle shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] ${highlightedEntryCellBg(isHighlighted)}`}>
                                    <>{pick?.isObStandIn ? <ObMarkerCorner /> : <LeverageMarkerCorner kind={pick && hareNames?.has(normalizePickName(pick.name)) ? 'hare' : pick && tortoiseNames?.has(normalizePickName(pick.name)) ? 'tortoise' : undefined} />}</>
                                    {pick && pickGroupShortLabel(pick.name) ? (
                                      <span className="absolute left-0.5 top-0.5 z-[2] inline-flex items-center border border-[#123c2f] bg-[#123c2f] px-[3px] py-[1px] text-[8px] font-black leading-none text-white">
                                        {pickGroupShortLabel(pick.name)}
                                      </span>
                                    ) : null}
                                    <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{formatPickScore(pick)}</div>
                                    <div className="mt-0.5 truncate text-[11px] font-black uppercase leading-tight tracking-[-0.01em] text-[#111] xl:text-xs">{pick ? shortName(pick.name, allPickNames) : 'Waiting'}</div>
                                    <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? (pick.name === 'Waiting' ? 'Waiting' : [pickGroupShortLabel(pick.name), activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)].filter(Boolean).join(' · ')) : 'Waiting'}</div>
                                  </td>
                                )
                              })}
                              <td className={`border-b border-[#d8cab0] px-1 py-1.5 text-center align-middle ${highlightedEntryCellBg(isHighlighted)} ${scoreClass(entry.totalScore)}`}>
                                <div className="text-3xl font-black leading-none">{formatScore(entry.totalScore)}</div>
                                {totalScoreSubLabel && entry.todayScore !== null ? (
                                  <div className="mt-0.5 whitespace-nowrap text-[8px] font-black uppercase tracking-normal text-[#777] sm:text-[9px] sm:tracking-[0.08em]">{totalScoreSubLabel} {formatScore(entry.todayScore)}</div>
                                ) : null}
                              </td>
                            </tr>
                            {outOfBoundsPicks.length > 0 && (
                              <tr key={`${entry.entryId}-out`} className="bg-[#efeee6]">
                                <td className="border-b border-r-2 border-[#d8cab0] bg-[#efeee6]" />
                                <td className="border-b border-r-2 border-[#d8cab0] bg-[#efeee6] px-2 py-1 text-left text-[9px] font-black uppercase tracking-[0.1em] text-[#111]">{outOfBoundsLabel(selectedScoringIsLive, pool.count_scores)}</td>
                                <td className="border-b border-[#d8cab0] bg-[#efeee6] px-2 py-1 text-left" colSpan={pool.count_scores + 1}>
                                  <div className="flex flex-wrap gap-1">
                                    {outOfBoundsPicks.map(pick => (
                                      <span key={`${entry.entryId}-${pick.name}`} className="relative inline-flex items-center gap-1 border border-[#d8cab0] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                                        {pick.isObStandIn ? <ObMarker /> : null}
                                        {hareNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="hare" /> : null}
                                        {tortoiseNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="tortoise" /> : null}
                                        {pickGroupShortLabel(pick.name) ? (
                                          <span className="inline-flex shrink-0 items-center border border-[#123c2f] bg-[#123c2f] px-[3px] py-[1px] text-[7px] font-black leading-none text-white">
                                            {pickGroupShortLabel(pick.name)}
                                          </span>
                                        ) : null}
                                        <span><span className={scoreClass(pick.scoreToPar)}>{formatPickScore(pick)}</span> {shortName(pick.name, allPickNames)} <span className="text-[#555]">{activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)}</span></span>
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
                leaderboard={leaderboard.length ? leaderboard : field}
                tournamentName={tournament?.name}
                lastUpdated={leaderboardLastUpdated}
                defaultOpen
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

              {!guestPicksSaved && (
              <div className="mb-4 border-2 border-[#123c2f] bg-[#fbf7ed] shadow-[5px_5px_0_#d8cab0]">
                <div className="flex flex-col gap-3 border-b border-[#d8cab0] bg-[#123c2f] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f3df9c]">Make picks</p>
                    <h2 className="text-xl font-black text-white">{groupsNeedLock ? 'Picks open soon. Review the groups now.' : `Pick ${requiredPickCount || pool.pick_count}. Best ${pool.count_scores} count.`}</h2>
                  </div>
                  {pickSelectionOpen && fieldReady ? (
                    <button onClick={savePicks} disabled={savePicksDisabled}
                      className="border-2 border-[#f3df9c] bg-[#f3df9c] px-5 py-2 text-sm font-black uppercase text-[#123c2f] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-100">
                      {savePicksLabel}
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
                  {!guestMode && (
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
                  )}
                </div>
              </div>
              )}

              {entryDetailsPanel}

              {guestEntryToken && showGuestSavePanel && (
                <div className="mb-4 border-2 border-[#123c2f] bg-white p-4 shadow-[5px_5px_0_#d8cab0]">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6724]">Picks saved</p>
                  <h3 className="mt-1 text-xl font-black text-[#123c2f]">{myEntry.display_name || 'Your entry'} is in.</h3>
                  <div className="mt-3 border border-[#d8cab0] bg-[#fbf7ed] p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#123c2f]">Final picks</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {myPicks.map(name => (
                        <span key={name} className="border border-[#123c2f] bg-white px-2.5 py-1 text-sm font-bold text-[#123c2f]">{golferListName(name)}</span>
                      ))}
                    </div>
                  </div>

                  {guestSaveStep === 'email' ? (
                    <div className="mt-5">
                      <h4 className="text-lg font-black text-[#123c2f]">Want the leaderboard sent to you?</h4>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="email"
                          value={notificationEmailValue}
                          onChange={event => setNotificationEmailValue(event.target.value)}
                          placeholder="you@example.com"
                          autoComplete="email"
                          className="min-w-0 flex-1 border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 focus:border-[#123c2f] focus:outline-none focus:ring-2 focus:ring-[#d8cab0]"
                        />
                        <button
                          type="button"
                          onClick={saveGuestEmailForUpdates}
                          disabled={guestEmailSaving}
                          className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black text-white hover:bg-[#0f2f25] disabled:opacity-50"
                        >
                          {guestEmailSaving ? 'Saving...' : 'Email me'}
                        </button>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <a href={guestLeaderboardUrl} className="border-2 border-[#123c2f] bg-white px-4 py-2 text-center text-sm font-black text-[#123c2f] hover:bg-[#fbf7ed]">
                          Continue to leaderboard
                        </a>
                        <button type="button" onClick={copyGuestLeaderboardLink} className="border border-[#d8cab0] bg-white px-4 py-2 text-sm font-black text-stone-600 hover:border-[#123c2f] hover:text-[#123c2f]">
                          Copy leaderboard link
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 border-2 border-[#d8cab0] bg-[#fbf7ed] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6724]">Optional account</p>
                      <h4 className="mt-1 text-lg font-black text-[#123c2f]">Add a password</h4>
                      <p className="mt-1 text-sm font-semibold leading-6 text-stone-600">An account links this entry, gives you a quick My Entry view, lets you edit picks before lock, and makes the next pool faster.</p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="password"
                          value={guestAccountPassword}
                          onChange={event => setGuestAccountPassword(event.target.value)}
                          placeholder="Create password"
                          minLength={6}
                          className="min-w-0 flex-1 border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 focus:border-[#123c2f] focus:outline-none focus:ring-2 focus:ring-[#d8cab0]"
                        />
                        <button
                          type="button"
                          onClick={createGuestAccount}
                          disabled={guestAccountLoading}
                          className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black text-white hover:bg-[#0f2f25] disabled:opacity-50"
                        >
                          {guestAccountLoading ? 'Creating...' : 'Create account'}
                        </button>
                      </div>
                      {guestAccountError && <p className="mt-2 border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{guestAccountError}</p>}
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <a href={guestLeaderboardUrl} className="border-2 border-[#123c2f] bg-white px-4 py-2 text-center text-sm font-black text-[#123c2f] hover:bg-white">
                          Continue to leaderboard
                        </a>
                        {guestClaimRedirect && <a href={`/login?redirect=${guestClaimRedirect}`} className="border border-[#d8cab0] bg-white px-4 py-2 text-center text-sm font-black text-stone-600 hover:border-[#123c2f] hover:text-[#123c2f]">Account sign in</a>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Selected picks */}
              {showSelectedPicks && (
                <div className="mb-4 rounded-none border-2 border-[#123c2f] bg-white shadow-[5px_5px_0_#d8cab0]">
                  <div className="flex flex-col gap-1 border-b border-[#d8cab0] bg-[#fbf7ed] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#123c2f]">
                      Your picks ({myPicks.length}/{requiredPickCount || pool.pick_count})
                    </h3>
                    {fieldReady && groupsNeedLock && <span className="text-xs font-bold text-stone-500">Preview only until groups lock</span>}
                  </div>
                  <div className="p-4">
                    {groupedFormat ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {groupPickCounts(pickGroups, myPicks).map(({ group, picks }) => (
                          <div key={group.id} className="border border-[#d8cab0] bg-[#fbf7ed] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-[0.1em] text-[#123c2f]">
                              <span>{group.label}</span>
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
                              {picks.length === 0 && <span className="text-sm font-semibold text-stone-500">No pick yet.</span>}
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
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#123c2f]">{groupedFormat ? (groupsNeedLock ? 'Group preview' : `${pool.game_format === 'random_groups' ? 'Random' : 'Ranked'} groups`) : 'Tournament field'}</p>
                    {groupedFormat && (
                      <p className="mt-1 text-sm font-semibold text-stone-600">{groupsNeedLock ? 'Picks open after groups lock. Groups auto-lock Tuesday morning ET once the field is set.' : `Pick ${picksPerGroup} from each group.`}</p>
                    )}
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
                          />
                        </div>
                      ) : (
                        [...activeField].sort((a, b) => golferListName(a.name).localeCompare(golferListName(b.name))).map(player => (
                          <div key={player.id || player.name}
                            className="flex w-full items-center justify-between border-b border-[#eadfca] px-4 py-2.5 text-left text-stone-500">
                            <span className="text-sm font-semibold">{golferListName(player.name)}</span>
                            <span className="border border-stone-300 bg-stone-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-stone-500">Field</span>
                          </div>
                        ))
                      )
                    ) : [...activeField].sort((a, b) => golferListName(a.name).localeCompare(golferListName(b.name))).map(player => {
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

              {/* Leave pool — server route enforces lock/live/completed eligibility */}
              {canLeaveOwnEntry && (
                <div className="rounded-none border border-[#f0c8c3] bg-[#fff8f4] p-4 shadow-[4px_4px_0_#d8cab0]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#b21e23]">Leave pool</p>
                      <p className="mt-1 text-sm font-semibold text-stone-700">Remove your entry from <span className="font-black text-stone-900">{poolName}</span>? Your picks will be lost.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(myEntry.id)}
                      className="border-2 border-[#b21e23] bg-[#b21e23] px-4 py-2 text-sm font-black uppercase text-white transition-colors hover:bg-[#8a1719]"
                    >
                      Leave this pool
                    </button>
                  </div>
                </div>
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
                {paymentStatusForDisplay === 'active' && amountPaidCents > 0 && (
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

            {showPaymentActions && paymentQuote?.requiresCustomQuote && (
              <p className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">This pool needs manual pricing.</p>
            )}
            {showPaymentActions && !paymentQuote?.requiresCustomQuote && (
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
            <section id="pick-reminders" className="scroll-mt-6 border border-[#d8cab0] bg-[#fbf7ed] p-5 shadow-[5px_5px_0_#d8cab0]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6724]">Pick reminders</p>
                  <h3 className="mt-1 text-xl font-black text-[#123c2f]">Still need picks: {entriesNeedingPicks.length}</h3>
                  <p className="mt-1 text-sm font-semibold text-[#657168]">Email the players we can reach. Copy the rest for your group text.</p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={sendMissingPicksReminder}
                    disabled={missingReminderSending || entriesNeedingPicksWithEmail.length === 0}
                    className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#0f2f25] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {missingReminderSending ? 'Sending...' : `Email ${entriesNeedingPicksWithEmail.length}`}
                  </button>
                  <button
                    type="button"
                    onClick={copyNeedsPicksReminder}
                    disabled={entriesNeedingPicks.length === 0}
                    className="border-2 border-[#123c2f] bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#123c2f] transition-colors hover:bg-[#eef7ef] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copy text list
                  </button>
                </div>
              </div>
              {missingReminderFeedback && <p className="mt-3 border border-[#d8cab0] bg-white px-3 py-2 text-sm font-semibold text-[#1f2a24]">{missingReminderFeedback}</p>}
              {entriesNeedingPicks.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="border border-[#d8cab0] bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a6724]">Can email</p>
                    {entriesNeedingPicksWithEmail.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {entriesNeedingPicksWithEmail.map(entry => (
                          <span key={entry.id} className="border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-900">{entry.display_name || 'Player'}</span>
                        ))}
                      </div>
                    ) : <p className="mt-2 text-sm font-semibold text-[#657168]">No unfinished entries have email on file.</p>}
                  </div>
                  <div className="border border-[#d8cab0] bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a6724]">Needs text</p>
                    {entriesNeedingPicksNoEmail.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {entriesNeedingPicksNoEmail.map(entry => (
                          <span key={entry.id} className="border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm font-bold text-amber-900">{entry.display_name || 'Player'}</span>
                        ))}
                      </div>
                    ) : <p className="mt-2 text-sm font-semibold text-emerald-800">Everyone missing picks has email.</p>}
                  </div>
                </div>
              ) : (
                <p className="mt-4 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Everyone has picks in.</p>
              )}
            </section>
          )}

          {!picksAreLocked && wdPicksNoEmail.length > 0 && (
            <section className="border border-amber-300 bg-amber-50 p-5 shadow-[5px_5px_0_#e7dbc3]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">WD follow-up</p>
                  <h3 className="mt-1 text-xl font-black text-amber-950">WD picks without email: {wdPicksNoEmail.length}</h3>
                  <p className="mt-1 text-sm font-semibold text-amber-900">Email alerts go out automatically when an entrant has email. Copy these names for text follow-up.</p>
                </div>
                <button
                  type="button"
                  onClick={copyWdTextReminder}
                  className="border-2 border-amber-900 bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-amber-950 transition-colors hover:bg-amber-100"
                >
                  Copy WD list
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {wdPicksNoEmail.map(item => (
                  <div key={item.entry.id} className="border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-950">
                    <span className="font-black">{item.entry.display_name || 'Player'}</span>
                    <span className="ml-2">{item.withdrawnPicks.join(', ')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {/* Entries management */}
          <div className="bg-white rounded-none border border-stone-200 overflow-hidden shadow-[5px_5px_0_#d8cab0]">
            <div className="px-5 py-4 border-b border-stone-200 bg-stone-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-emerald-950">Manage entries</h3>
                <p className="mt-1 text-xs font-semibold text-stone-500">{activeEntries.length} total · {submittedPickCount} with picks. CSV includes optional player emails for score updates.</p>
              </div>
              <button
                type="button"
                onClick={downloadEntriesCsv}
                className="w-fit border-2 border-[#123c2f] bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#123c2f] transition-colors hover:bg-[#eef7ef]"
              >
                Download CSV
              </button>
            </div>
            {entries.map(entry => {
              const pickCount = pickCountForEntry(entry)
              const rowPickTarget = entryRequiredPickCount || Number(pool.pick_count || 0)
              const picksComplete = rowPickTarget > 0 ? pickCount >= rowPickTarget : pickCount > 0
              return (
                <div key={entry.id} className={`px-5 py-3 border-b border-stone-100 flex items-center justify-between gap-3 ${entry.is_removed ? 'opacity-40' : ''}`}>
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900">{entry.display_name}</p>
                    <p className="text-stone-500 text-xs">
                      {pickCount}/{rowPickTarget || pool.pick_count} Picks
                      {runnerEmailForEntry(entry) ? <span className="ml-2 break-all">{runnerEmailForEntry(entry)}</span> : null}
                      {entry.is_removed && <span className="text-red-700 ml-2">Removed: {entry.removed_reason}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!entry.is_removed && (
                      <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${picksComplete ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {picksComplete ? 'Picks in' : `Needs ${Math.max((rowPickTarget || Number(pool.pick_count || 0)) - pickCount, 0)}`}
                      </span>
                    )}
                    {!entry.is_removed && entry.user_id !== userId && (
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(entry.id)}
                        disabled={Boolean(removingEntryId)}
                        className="px-2 text-xs text-red-700 hover:text-red-800 disabled:cursor-wait disabled:opacity-50"
                      >
                        {removingEntryId === entry.id ? 'Removing...' : 'Remove'}
                      </button>
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
        </div>
      )}

      {/* Remove confirmation modal — used by owner entry removal and non-owner Leave pool */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-none border-2 border-[#123c2f] bg-white p-6 shadow-[8px_8px_0_#d8cab0]">
            <h3 className="mb-3 text-lg font-black text-[#123c2f]">{removingOwnEntry ? 'Leave pool' : `Remove ${removeTargetName}`}</h3>
            <p className="mb-4 text-sm font-semibold leading-6 text-stone-700">
              {removingOwnEntry ? `Leave ${poolName}? Your picks will be removed.` : `Remove ${removeTargetName} from this pool? They won't be able to rejoin.`}
            </p>
            {!removingOwnEntry && (
              <input
                type="text"
                value={removeReason}
                onChange={e => setRemoveReason(e.target.value)}
                placeholder="Reason"
                disabled={Boolean(removingEntryId)}
                className="mb-4 w-full rounded-none border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:cursor-wait disabled:bg-stone-100"
              />
            )}
            <div className="flex justify-end gap-3">
              <button disabled={Boolean(removingEntryId)} onClick={() => { setRemoveTarget(null); setRemoveReason('') }}
                className="px-4 py-2 text-sm font-semibold text-stone-600 hover:text-stone-900 disabled:cursor-wait disabled:opacity-50">Cancel</button>
              <button disabled={Boolean(removingEntryId)} onClick={() => removeEntry(removeTarget)}
                className="rounded-none bg-[#b21e23] px-4 py-2 text-sm font-black uppercase text-white hover:bg-[#8a1719] disabled:cursor-wait disabled:opacity-60">{removingEntryId === removeTarget ? (removingOwnEntry ? 'Leaving...' : 'Removing...') : removingOwnEntry ? 'Leave pool' : 'Remove'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
