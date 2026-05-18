'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { ScoredEntry } from '@/lib/scoring'
import { formatScore, ordinal } from '@/lib/final-result-announcements'

type FinalResultAnnouncement = {
  entryId: string
  poolId: string
  poolName: string
  tournamentName: string
  rank: number
  totalScore: number | null
  fieldSize: number
  scoredEntries: ScoredEntry[]
  showSharePreview: boolean
  isOwner?: boolean
  runItBackHref?: string
  runItBackTournamentName?: string
}

type Props = {
  announcement: FinalResultAnnouncement | null
  dismissAction: (formData: FormData) => void | Promise<void>
}

function drawShareImage(announcement: FinalResultAnnouncement) {
  const width = 1080
  const height = 1920
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const drawRect = (x: number, y: number, w: number, h: number, fill: string, stroke?: string, lineWidth = 1) => {
    ctx.fillStyle = fill
    ctx.fillRect(x, y, w, h)
    if (stroke) {
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineWidth
      ctx.strokeRect(x, y, w, h)
    }
  }

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

  drawRect(0, 0, width, height, '#f3ead7')
  for (let x = 0; x <= width; x += 54) drawRect(x, 0, 1, height, 'rgba(60,45,25,0.07)')
  for (let y = 0; y <= height; y += 54) drawRect(0, y, width, 1, 'rgba(60,45,25,0.07)')

  fitText('GOLF POOLS PRO', width / 2, 190, 560, '900 52px Arial', '#123c2f', 'center')

  const boardX = 58
  const boardY = 318
  const boardW = 924
  const frame = 40
  const headH = 200
  const labelH = 54
  const trimW = 28
  const rowCount = Math.min(announcement.scoredEntries.length, 5)
  const rowAreaH = 690
  const rowH = (rowAreaH - trimW * 2) / Math.max(rowCount, 1)
  const scoreFaceH = headH + labelH + rowAreaH
  const boardH = scoreFaceH + frame * 2
  const depthX = 48
  const depthY = 32
  const postW = 132
  const postX = boardX + boardW / 2 - postW / 2
  const postY = boardY + boardH + depthY / 2
  const footerBoxY = 1688
  const footerBoxH = 138
  const postH = height - postY + depthY

  drawPostDepth(postX, postY, postW, postH, depthX, depthY)
  drawBoardDepth(boardX, boardY, boardW, boardH, depthX, depthY)
  drawRect(postX, postY, postW, postH, '#123c2f')
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
  fitText(announcement.poolName || 'Golf Pool', width / 2, tableY + 82, tableW - 78, '600 60px Arial', '#111111', 'center')
  fitText(announcement.tournamentName || 'Tournament', width / 2, tableY + 132, tableW - 78, '700 31px Arial', '#005b3c', 'center')
  fitText('Final board', width / 2, tableY + 168, tableW - 78, '700 24px Arial', '#657168', 'center')

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
  fitText('Score', tableX + tableW - 95, labelY + 35, 142, '800 21px Arial', '#111111', 'center')

  announcement.scoredEntries.slice(0, rowCount).forEach((entry, index) => {
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
    const textY = y + rowH / 2 + 18
    fitText(String(entry.rank || index + 1), tableX + 56, textY, 90, '800 44px Arial', '#b21e23', 'center')
    fitText(String(entry.displayName || 'Entry'), tableX + 144, textY, tableW - 374, '600 48px Arial', '#111111')
    fitText(formatScore(entry.totalScore), tableX + tableW - 95, y + rowH / 2 + 23, 150, '800 58px Arial', entry.totalScore !== null && entry.totalScore < 0 ? '#b21e23' : '#111111', 'center')
  })

  drawRect(134, footerBoxY, width - 268, footerBoxH, '#fbf7ed', '#123c2f', 6)
  drawRect(144, footerBoxY + 10, width - 288, footerBoxH - 20, 'rgba(255,255,255,0.78)')
  drawRect(178, footerBoxY + 30, width - 356, 8, '#d8b45d')
  drawRect(178, footerBoxY + footerBoxH - 38, width - 356, 8, '#d8b45d')
  fitText('GOLFPOOLSPRO.COM', width / 2, footerBoxY + 88, 650, '900 54px Arial', '#123c2f', 'center')

  return canvas.toDataURL('image/png')
}

function dataUrlToFile(dataUrl: string, fileName: string) {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png'
  const binary = window.atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], fileName, { type: mime })
}

export default function FinalResultPopup({ announcement, dismissAction }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const fileName = useMemo(() => {
    if (!announcement) return 'golf-pools-pro-final-board.png'
    return `${announcement.poolName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-final-board.png`
  }, [announcement])

  useEffect(() => {
    setDismissed(false)
    if (!announcement?.showSharePreview) {
      setPreviewUrl(null)
      return
    }
    setPreviewUrl(drawShareImage(announcement))
  }, [announcement])

  const saveShareImage = async () => {
    if (!previewUrl || isSaving) return
    setIsSaving(true)
    try {
      const file = dataUrlToFile(previewUrl, fileName)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Golf Pools Pro final board' })
        return
      }

      const blobUrl = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } finally {
      setIsSaving(false)
    }
  }

  if (!announcement || dismissed) return null

  const finish = ordinal(announcement.rank)
  const canCopySettings = Boolean(announcement.isOwner && announcement.runItBackHref && announcement.runItBackTournamentName)

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#001f17]/75 px-3 py-6">
      <section className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto border-2 border-[#123c2f] bg-[#fbf7ed] shadow-[9px_9px_0_#d8cab0]">
        <form action={dismissAction} onSubmit={() => setDismissed(true)} className="absolute right-3 top-3 z-10">
          <input type="hidden" name="poolId" value={announcement.poolId} />
          <input type="hidden" name="entryId" value={announcement.entryId} />
          <button
            type="submit"
            aria-label="Close final results"
            className="flex h-10 w-10 items-center justify-center border-2 border-[#123c2f] bg-[#fbf7ed] text-2xl font-black leading-none text-[#123c2f] shadow-[3px_3px_0_#d8cab0] hover:bg-[#fff4cf]"
          >
            ×
          </button>
        </form>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="p-5 pt-14 sm:p-7 sm:pt-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6724]">Final results</p>
            <h2 className="mt-2 font-display text-4xl font-bold uppercase tracking-[-0.03em] text-[#0f2f25] sm:text-5xl">
              You finished {finish}
            </h2>
            <div className="mt-5 border-2 border-[#123c2f] bg-white p-4 shadow-[5px_5px_0_#d8cab0]">
              <p className="font-display text-2xl font-bold text-[#0f2f25]">{announcement.poolName}</p>
              <p className="mt-1 text-sm font-semibold text-[#657168]">{announcement.tournamentName}</p>
              <div className="mt-4 grid grid-cols-3 border border-[#d8cab0] bg-[#f7f7f2] text-center">
                <div className="border-r border-[#d8cab0] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#657168]">Rank</p>
                  <p className="mt-1 font-display text-3xl font-bold text-[#b21e23]">#{announcement.rank}</p>
                </div>
                <div className="border-r border-[#d8cab0] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#657168]">Score</p>
                  <p className="mt-1 font-display text-3xl font-bold text-[#0f2f25]">{formatScore(announcement.totalScore)}</p>
                </div>
                <div className="p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#657168]">Field</p>
                  <p className="mt-1 font-display text-3xl font-bold text-[#0f2f25]">{announcement.fieldSize}</p>
                </div>
              </div>
            </div>

            {announcement.showSharePreview ? (
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#314339]">
                Top five. Nice finish. Your share image is ready if you want to post the final board.
              </p>
            ) : (
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#314339]">
                Final standings are posted. You can still open the pool anytime from Past Pools.
              </p>
            )}

            {!announcement.showSharePreview && canCopySettings ? (
              <div className="mt-6 border-2 border-[#123c2f] bg-[#fbf7ed] p-4 shadow-[4px_4px_0_#d8cab0]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6724]">Run it back</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#314339]">Same settings, same player list.</p>
                <Link
                  href={announcement.runItBackHref}
                  className="mt-3 block w-full border-2 border-[#123c2f] bg-[#123c2f] px-4 py-3 text-center text-white hover:bg-[#0f2f25]"
                >
                  <span className="block text-xs font-black uppercase tracking-[0.12em]">Copy settings for</span>
                  <span className="mt-1 block font-display text-xl font-bold leading-tight">{announcement.runItBackTournamentName}</span>
                </Link>
              </div>
            ) : null}

          </div>

          {announcement.showSharePreview ? (
            <div className="border-t-2 border-[#123c2f] bg-[#123c2f] p-5 lg:border-l-2 lg:border-t-0">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[#d8b45d]">Share preview</p>
              {previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt={`${announcement.poolName} final leaderboard share preview`} className="mx-auto max-h-[70vh] w-auto border-2 border-[#d8b45d] bg-[#f3ead7]" />
                  <button
                    type="button"
                    onClick={saveShareImage}
                    disabled={isSaving}
                    className="mt-4 w-full border-2 border-[#d8b45d] bg-[#fbf7ed] px-5 py-4 text-sm font-black uppercase tracking-[0.08em] text-[#123c2f] shadow-[4px_4px_0_#001f17] hover:bg-white disabled:cursor-wait disabled:opacity-70"
                  >
                    {isSaving ? 'Opening image…' : 'Save image'}
                  </button>
                  {canCopySettings ? (
                    <div className="mt-5 border-2 border-[#d8b45d] bg-[#fbf7ed] p-4 text-[#123c2f] shadow-[4px_4px_0_#001f17]">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6724]">Next tournament</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-[#314339]">Same settings, same player list.</p>
                      <Link
                        href={announcement.runItBackHref}
                        className="mt-3 block w-full border-2 border-[#123c2f] bg-[#123c2f] px-4 py-3 text-center text-white hover:bg-[#0f2f25]"
                      >
                        <span className="block text-xs font-black uppercase tracking-[0.12em]">Copy settings for</span>
                        <span className="mt-1 block font-display text-xl font-bold leading-tight">{announcement.runItBackTournamentName}</span>
                      </Link>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex min-h-[520px] items-center justify-center border-2 border-[#d8b45d] bg-[#f3ead7] text-sm font-black uppercase tracking-[0.12em] text-[#123c2f]">
                  Building image…
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
