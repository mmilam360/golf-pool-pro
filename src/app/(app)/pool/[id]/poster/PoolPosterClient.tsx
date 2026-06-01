'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toJpeg, toPng } from 'html-to-image'

type PosterPool = {
  id: string
  name: string
  passcode: string
  pick_count: number
  count_scores: number
  ob_rule_enabled: boolean
  ob_penalty_strokes: number | null
  game_format: 'standard' | 'ranked_groups' | 'random_groups'
  group_count: number | null
  picks_per_group: number | null
}

type PosterTournament = {
  name: string
  course?: string | null
  start_date: string | null
  end_date: string | null
}

type Props = {
  pool: PosterPool
  tournament: PosterTournament | null
  joinUrl: string
  hostName: string
}

const POSTER_WIDTH = 816
const POSTER_HEIGHT = 1056
const POSTER_SETTINGS_VERSION = 1
const CUSTOM_NOTE_MAX_CHARS = 42

function formatDateOnly(value?: string | null) {
  if (!value) return 'Tournament week'
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'Tournament week'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function tournamentDateRange(tournament: PosterTournament | null) {
  if (!tournament?.start_date) return 'Tournament week'
  if (!tournament.end_date || tournament.end_date === tournament.start_date) return formatDateOnly(tournament.start_date)

  const start = new Date(`${tournament.start_date}T12:00:00Z`)
  const end = new Date(`${tournament.end_date}T12:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return formatDateOnly(tournament.start_date)

  return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(start)}-${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(end)}`
}

function cleanTournamentName(name?: string | null) {
  const cleaned = String(name || '')
    .replace(/\s+(presented|pres\.)\s+by\s+.+$/i, '')
    .replace(/\s+(sponsored|hosted)\s+by\s+.+$/i, '')
    .replace(/\s+benefiting\s+.+$/i, '')
    .replace(/\s+-\s+.+$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return cleaned || 'PGA tournament'
}

function obRuleExplainer(pool: PosterPool) {
  const penalty = pool.ob_penalty_strokes || 0
  return `OB: CUT, DNQ, DNF, or DQ gets the worst finisher's score +${penalty} ${penalty === 1 ? 'stroke' : 'strokes'}.`
}

function formatSummary(pool: PosterPool) {
  const groups = pool.group_count || 6
  const perGroup = pool.picks_per_group || 2

  if (pool.game_format === 'ranked_groups') {
    return {
      mode: 'Tiered Picks',
      picks: `Pick ${perGroup} per tier`,
      scoring: `Best ${pool.count_scores || 8} count`,
      explainer: `${groups} WGR tiers`,
    }
  }

  if (pool.game_format === 'random_groups') {
    return {
      mode: 'Clubhouse Chaos',
      picks: `Pick ${perGroup} per group`,
      scoring: `Best ${pool.count_scores || 8} count`,
      explainer: `${groups} random groups`,
    }
  }

  return {
    mode: 'Standard Picks',
    picks: `Pick ${pool.pick_count || 6} golfers`,
    scoring: `Best ${pool.count_scores || pool.pick_count || 4} count`,
    explainer: 'Full field',
  }
}

function lockTimingText(value?: string | null) {
  if (!value) return 'Before first tee time Thursday'
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'Before first tee time Thursday'
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date)
  return `Before first tee time ${weekday}`
}

type PosterExportFormat = 'pdf' | 'png' | 'jpeg'

function posterFileName(poolName: string, format: PosterExportFormat) {
  const slug = poolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return `${slug || 'golf-pool'}-signup-poster.${format === 'jpeg' ? 'jpg' : format}`
}

function dataUrlToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/data:([^;]+)/)
  const mimeType = mimeMatch?.[1] || 'application/octet-stream'
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

type BoardSection =
  | { type: 'format'; label: string; mode: string; picks: string; scoring: string; formatExplainer: string; obExplainer: string | null }
  | { type: 'rules'; label: string; lockLabel: string; lockText: string; deadlineLabel: string; deadlineText: string }
  | { type: 'note'; hostName: string; note: string }

function RulesScoreboard({ pool, tournament, entryDeadline, hostNote, hostName }: { pool: PosterPool; tournament: PosterTournament | null; entryDeadline: string; hostNote: string; hostName: string }) {
  const summary = formatSummary(pool)
  const boardSections: BoardSection[] = [
    {
      type: 'format',
      label: 'Format',
      mode: summary.mode,
      picks: summary.picks,
      scoring: summary.scoring,
      formatExplainer: summary.explainer,
      obExplainer: pool.ob_rule_enabled ? obRuleExplainer(pool) : null,
    },
    {
      type: 'rules',
      label: 'Rules',
      lockLabel: 'Entries lock',
      lockText: lockTimingText(tournament?.start_date),
      deadlineLabel: 'Entries due',
      deadlineText: entryDeadline || 'Tournament start',
    },
    ...(hostNote.trim() ? [{ type: 'note' as const, hostName, note: hostNote.trim() }] : []),
  ]

  return (
    <div className="relative mx-auto w-[760px] pb-[372px]" style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}>
      <div className="flex justify-center">
        <div className="gpp-3d w-[722px] [--gpp-depth-x:26px] [--gpp-depth-y:18px] [--gpp-side-color:#001f17] [--gpp-bottom-color:#001f17]">
          <div className="gpp-board-depth-right" aria-hidden="true" />
          <div className="gpp-board-depth-bottom" aria-hidden="true" />
          <div className="gpp-3d-face gpp-board-frame border-[18px] border-[#123c2f]">
            <div className="gpp-score-face border-2 border-[#111] bg-[#f7f7f2] text-[#111]">
            <div className="border-b-2 border-[#111] px-5 py-4 text-center">
              <p className="text-[14px] font-black uppercase tracking-[0.24em] text-[#b21e23]">Join Our Golf Pool</p>
              <p className="mt-1 text-[52px] font-black uppercase leading-none tracking-[-0.075em] text-[#123c2f]">{pool.name}</p>
              <p className="mt-2 text-[18px] font-black uppercase leading-none tracking-[-0.02em] text-[#111]">{cleanTournamentName(tournament?.name)} <span className="text-[#b58a3a]">/</span> {tournamentDateRange(tournament)}</p>
              {tournament?.course ? <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#657168]">{tournament.course}</p> : null}
            </div>
            {boardSections.map((section, index) => {
              const rowBg = index % 2 ? 'bg-[#fffdf8]' : 'bg-[#f0eadb]'
              if (section.type === 'format') {
                return (
                  <div key={section.type} className="border-b-2 border-[#111] last:border-b-0">
                    <div className="border-b-2 border-[#111] bg-[#123c2f] px-4 py-2 text-[14px] font-black uppercase tracking-[0.14em] text-[#fbf7ed]">{section.label}</div>
                    <div className={`${rowBg}`}>
                      <div className={`grid ${section.obExplainer ? 'grid-cols-4' : 'grid-cols-3'} border-b-2 border-[#111] text-[#111]`}>
                        <div className="border-r-2 border-[#111] px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#657168]">Game</p>
                          <p className="mt-1 text-[17px] font-black leading-[0.95] tracking-[-0.04em]">{section.mode}</p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#8a6724]">{section.formatExplainer}</p>
                        </div>
                        <div className="border-r-2 border-[#111] px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#657168]">Picks</p>
                          <p className="mt-1 text-[18px] font-black leading-[0.95] tracking-[-0.04em]">{section.picks}</p>
                        </div>
                        <div className={`${section.obExplainer ? 'border-r-2' : ''} border-[#111] px-4 py-3`}>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#657168]">Scoring</p>
                          <p className="mt-1 text-[18px] font-black leading-[0.95] tracking-[-0.04em]">{section.scoring}</p>
                        </div>
                        {section.obExplainer ? (
                          <div className="px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#657168]">OB rule</p>
                            <p className="mt-1 whitespace-nowrap text-[18px] font-black leading-none tracking-[-0.04em]">+{pool.ob_penalty_strokes || 0}</p>
                          </div>
                        ) : null}
                      </div>
                      {section.obExplainer ? <div className="px-4 py-3 text-[15px] font-black leading-[1.05] tracking-[-0.02em] text-[#123c2f]">{section.obExplainer}</div> : null}
                    </div>
                  </div>
                )
              }

              if (section.type === 'rules') {
                return (
                  <div key={section.type} className="border-b-2 border-[#111] last:border-b-0">
                    <div className="border-b-2 border-[#111] bg-[#123c2f] px-4 py-2 text-[14px] font-black uppercase tracking-[0.14em] text-[#fbf7ed]">{section.label}</div>
                    <div className={`grid min-h-[78px] grid-cols-2 text-[#111] ${rowBg}`}>
                      <div className="border-r-2 border-[#111] px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#657168]">{section.lockLabel}</p>
                        <p className="mt-1 text-[22px] font-black leading-[0.98] tracking-[-0.045em]">{section.lockText}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#657168]">{section.deadlineLabel}</p>
                        <p className="mt-1 text-[22px] font-black leading-[0.98] tracking-[-0.045em]">{section.deadlineText}</p>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={section.type} className="border-b-2 border-[#111] last:border-b-0">
                  <div className="h-[30px] border-b-2 border-[#111] bg-[#123c2f]" aria-label={`Note from ${section.hostName}`} />
                  <div className={`min-h-[82px] px-4 py-4 ${rowBg}`}>
                    <p className="overflow-hidden text-ellipsis whitespace-nowrap pb-1 text-[28px] font-black leading-[1.12] tracking-[-0.04em] text-[#111]">{section.note}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      </div>
      <div className="gpp-board-post absolute bottom-0 left-1/2 h-[370px] w-[66px] -translate-x-1/2 [--gpp-depth-x:26px] [--gpp-depth-y:18px]">
        <div className="gpp-board-post-depth" aria-hidden="true" />
        <div className="gpp-board-post-face" aria-hidden="true" />
      </div>
    </div>
  )
}

function FullFlagLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/golf-pools-pro-wordmark.png" alt="Golf Pools Pro" className="h-[82px] w-auto object-contain" />
  )
}

function displayUrl() {
  return 'golfpoolspro.com'
}

export default function PoolPosterClient({ pool, tournament, joinUrl, hostName }: Props) {
  const posterRef = useRef<HTMLDivElement>(null)
  const scaleHostRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const defaultEntryDeadline = useMemo(() => formatDateOnly(tournament?.start_date), [tournament?.start_date])
  const storageKey = useMemo(() => `gpp-poster:${pool.id}:settings:v${POSTER_SETTINGS_VERSION}`, [pool.id])
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [inkSaver, setInkSaver] = useState(false)
  const [entryDeadline, setEntryDeadline] = useState(defaultEntryDeadline)
  const [hostNote, setHostNote] = useState('Pay the host before picks lock.')
  const [hostLogoSrc, setHostLogoSrc] = useState('')
  const [qrSrc, setQrSrc] = useState('')
  const [exportFormat, setExportFormat] = useState<PosterExportFormat>('png')
  const [exportStatus, setExportStatus] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)


  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<{ entryDeadline: string; hostNote: string; hostLogoSrc: string; inkSaver: boolean }>
        if (typeof parsed.entryDeadline === 'string') setEntryDeadline(parsed.entryDeadline)
        if (typeof parsed.hostNote === 'string') setHostNote(parsed.hostNote.slice(0, CUSTOM_NOTE_MAX_CHARS))
        if (typeof parsed.hostLogoSrc === 'string') setHostLogoSrc(parsed.hostLogoSrc)
        if (typeof parsed.inkSaver === 'boolean') setInkSaver(parsed.inkSaver)
      }
    } catch {
      // Local poster settings are a convenience only; ignore bad saved data.
    } finally {
      setSettingsLoaded(true)
    }
  }, [storageKey])

  useEffect(() => {
    if (!settingsLoaded) return

    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ entryDeadline, hostNote, hostLogoSrc, inkSaver }))
    } catch {
      // Large uploaded logos can exceed browser storage. Keep the current page state working.
    }
  }, [entryDeadline, hostLogoSrc, hostNote, inkSaver, settingsLoaded, storageKey])

  useEffect(() => {
    const node = scaleHostRef.current
    if (!node) return

    function resize() {
      const width = node?.clientWidth || POSTER_WIDTH
      setScale(Math.min(1, width / POSTER_WIDTH))
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function handleBeforePrint() {
      setIsPrinting(true)
    }

    function handleAfterPrint() {
      setIsPrinting(false)
    }

    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function makeQr() {
      const QRCode = await import('qrcode')
      const dataUrl = await QRCode.toDataURL(joinUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 8,
        color: { dark: '#123c2f', light: '#fffdf8' },
      })
      if (!cancelled) setQrSrc(dataUrl)
    }

    makeQr().catch(() => setQrSrc(''))
    return () => {
      cancelled = true
    }
  }, [joinUrl])

  function handleHostLogoUpload(file: File | null) {
    if (!file) {
      setHostLogoSrc('')
      return
    }

    const reader = new FileReader()
    reader.onload = () => setHostLogoSrc(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
  }

  async function makePosterImage(format: Exclude<PosterExportFormat, 'pdf'>) {
    if (!posterRef.current) return null

    const options = {
      cacheBust: true,
      pixelRatio: 2,
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      backgroundColor: inkSaver ? '#ffffff' : '#fbf7ed',
    }

    return format === 'jpeg'
      ? toJpeg(posterRef.current, { ...options, quality: 0.95 })
      : toPng(posterRef.current, options)
  }

  async function makePosterPdf() {
    const pngDataUrl = await makePosterImage('png')
    if (!pngDataUrl) return null

    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
    pdf.addImage(pngDataUrl, 'PNG', 0, 0, 612, 792)
    return pdf.output('blob')
  }

  async function exportPosterFile(format: PosterExportFormat) {
    if (!posterRef.current) return
    setExportStatus(`Making ${format.toUpperCase()}...`)

    try {
      const fileName = posterFileName(pool.name, format)
      let blob: Blob | null = null
      if (format === 'pdf') {
        blob = await makePosterPdf()
      } else {
        const imageFormat = format as Exclude<PosterExportFormat, 'pdf'>
        const dataUrl = await makePosterImage(imageFormat)
        blob = dataUrl ? dataUrlToBlob(dataUrl) : null
      }

      if (!blob) return

      const file = new File([blob], fileName, { type: blob.type })
      const canUseMobileShare = window.matchMedia('(hover: none), (pointer: coarse)').matches

      if (canUseMobileShare && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${pool.name} signup poster` })
        setExportStatus(`${format.toUpperCase()} ready to share.`)
        return
      }

      downloadBlob(blob, fileName)
      setExportStatus(`${format.toUpperCase()} downloaded.`)
    } catch {
      setExportStatus('Download failed. Try another format or use Print.')
    }
  }

  function printPoster() {
    setIsPrinting(true)
    window.requestAnimationFrame(() => window.print())
  }

  return (
    <main className="min-h-screen bg-[#fbf7ed] px-4 py-5 text-[#1f2a24] print:min-h-0 print:bg-white print:p-0 sm:px-6 lg:px-8">
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0;
          }

          html,
          body {
            width: 8.5in;
            height: 11in;
            margin: 0 !important;
            background: #ffffff !important;
          }
        }
      `}</style>
      <div className="mx-auto mb-5 flex max-w-6xl flex-col gap-3 print:hidden md:flex-row md:items-end md:justify-between">
        <div>
          <Link href={`/pool/${pool.id}`} className="text-xs font-black uppercase tracking-[0.16em] text-[#657168] underline decoration-[#b58a3a] underline-offset-4">Back to pool</Link>
          <h1 className="mt-2 font-black uppercase leading-none tracking-[-0.05em] text-[#123c2f] text-[clamp(2rem,7vw,4rem)]">Signup poster</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-[#4f5b54]">Edit the details, then print it or download it as a PDF, PNG, or JPEG.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 border-2 border-[#123c2f] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#123c2f] shadow-[3px_3px_0_#d8cab0]">
            Format
            <select
              value={exportFormat}
              onChange={event => setExportFormat(event.target.value as PosterExportFormat)}
              className="bg-white text-xs font-black uppercase tracking-[0.08em] text-[#123c2f] outline-none"
            >
              <option value="pdf">PDF</option>
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
          </label>
          <button type="button" onClick={() => exportPosterFile(exportFormat)} className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white shadow-[3px_3px_0_#b58a3a]">Download</button>
          <button type="button" onClick={printPoster} className="border-2 border-[#123c2f] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#123c2f] shadow-[3px_3px_0_#d8cab0]">Print</button>
        </div>
      </div>

      <div className="mx-auto mb-5 grid max-w-6xl gap-3 rounded-none border border-[#d8cab0] bg-white p-4 shadow-sm print:hidden md:grid-cols-2">
        <label className="block text-sm font-bold text-[#1f2a24]">
          Entry deadline
          <input value={entryDeadline} onChange={event => setEntryDeadline(event.target.value)} className="mt-1 w-full rounded-none border border-[#d8cab0] bg-[#fffdf8] px-3 py-2 text-sm font-semibold text-[#1f2a24] outline-none focus:border-[#123c2f]" />
        </label>
        <label className="block text-sm font-bold text-[#1f2a24] md:col-span-2">
          Custom note / payment instructions <span className="font-semibold text-[#657168]">({hostNote.length}/{CUSTOM_NOTE_MAX_CHARS})</span>
          <input value={hostNote} maxLength={CUSTOM_NOTE_MAX_CHARS} onChange={event => setHostNote(event.target.value.slice(0, CUSTOM_NOTE_MAX_CHARS))} placeholder="Pay Michael cash, Venmo @michaelmay, or PayPal @michaelmay" className="mt-1 w-full rounded-none border border-[#d8cab0] bg-[#fffdf8] px-3 py-2 text-sm font-semibold text-[#1f2a24] outline-none focus:border-[#123c2f]" />
        </label>
        <label className="block text-sm font-bold text-[#1f2a24]">
          Add your logo
          <input type="file" accept="image/*" onChange={event => handleHostLogoUpload(event.target.files?.[0] ?? null)} className="mt-1 w-full rounded-none border border-[#d8cab0] bg-[#fffdf8] px-3 py-2 text-sm font-semibold text-[#1f2a24] file:mr-3 file:border-0 file:bg-[#123c2f] file:px-3 file:py-1 file:text-xs file:font-black file:uppercase file:text-white" />
        </label>
              <label className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.1em] text-[#123c2f]">
          <input type="checkbox" checked={inkSaver} onChange={event => setInkSaver(event.target.checked)} className="h-5 w-5 accent-[#123c2f]" />
          Ink saver
        </label>
        {exportStatus ? <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f6b4a] md:col-span-2">{exportStatus}</p> : null}
      </div>

      <div ref={scaleHostRef} className="mx-auto max-w-6xl pb-8 print:m-0 print:max-w-none print:p-0">
        <div className="mx-auto print:contents" style={{ width: isPrinting ? POSTER_WIDTH : POSTER_WIDTH * scale, height: isPrinting ? POSTER_HEIGHT : POSTER_HEIGHT * scale }}>
          <section
            ref={posterRef}
            className={`relative origin-top-left overflow-hidden border-0 print:h-[11in] print:w-[8.5in] print:shadow-none ${inkSaver ? 'bg-white shadow-none' : 'bg-[#fbf7ed] shadow-[12px_12px_0_#d8cab0]'}`}
            style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT, transform: isPrinting ? 'none' : `scale(${scale})` }}
          >
            {!inkSaver ? <div className="pointer-events-none absolute inset-0 z-50 border-[10px] border-[#123c2f]" aria-hidden="true" /> : null}
            <div className="absolute bottom-0 left-0 z-20 h-[74px] w-full bg-[#123c2f]" aria-hidden="true" />

            <div className="relative z-10 flex h-full flex-col p-[28px]">
              <div>
                <RulesScoreboard pool={pool} tournament={tournament} entryDeadline={entryDeadline} hostNote={hostNote} hostName={hostName} />
              </div>

              <div className="absolute bottom-[98px] left-[42px] right-[42px] grid h-[204px] grid-cols-2 items-center gap-[120px]">
                <div className="grid h-full place-items-center">
                  {hostLogoSrc ? (
                    <div className="grid h-[178px] w-[178px] place-items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={hostLogoSrc} alt="Pool host logo" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-[300px] text-[#123c2f]">
                      <p className="font-black uppercase leading-[0.86] tracking-[-0.075em] text-[58px]">Scan.</p>
                      <p className="font-black uppercase leading-[0.86] tracking-[-0.075em] text-[58px]">Pick.</p>
                      <p className="font-black uppercase leading-[0.86] tracking-[-0.075em] text-[58px]">Follow.</p>
                      <div className="mt-4 h-[6px] w-[170px] bg-[#b58a3a]" aria-hidden="true" />
                      <p className="mt-3 text-[13px] font-black uppercase tracking-[0.18em] text-[#657168]">Live leaderboard all week</p>
                    </div>
                  )}
                </div>

                <div className="grid h-full place-items-center">
                  <div className="flex h-[178px] w-[178px] flex-col items-center justify-center border-[6px] border-[#123c2f] bg-white p-[9px] text-center shadow-[6px_6px_0_#d8cab0]">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#123c2f]">Scan to join</p>
                    <div className="mx-auto mt-2 grid h-[116px] w-[116px] place-items-center bg-[#fffdf8] p-1">
                      {qrSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrSrc} alt="QR code to join this golf pool" className="h-full w-full" />
                      ) : <div className="h-full w-full bg-[#fbf7ed]" />}
                    </div>
                    <p className="mt-2 text-[8px] font-black uppercase tracking-[0.14em] text-[#657168]">No app needed</p>
                  </div>
                </div>
              </div>

            </div>

            <div className="absolute bottom-[3px] left-[18px] right-[18px] z-30 text-center text-[6px] font-semibold leading-tight text-[#d8cab0]/75">
              Entry fees and prizes are handled privately by the pool host. Golf Pools Pro does not collect or distribute prize money.
            </div>

            <div className="absolute bottom-[26px] left-[40px] right-[40px] z-30 flex flex-col items-center justify-center">
              <FullFlagLogo />
              <p className="mt-[-2px] text-[13px] font-black uppercase tracking-[0.2em] text-[#fbf7ed]">{displayUrl()}</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
