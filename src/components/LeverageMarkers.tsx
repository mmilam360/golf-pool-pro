type MarkerKind = 'hare' | 'tortoise'

export function LeverageMarkerIcon({ kind }: { kind: MarkerKind }) {
  if (kind === 'hare') {
    return (
      <svg className="block h-4 w-6 overflow-visible" viewBox="0 0 120 90" fill="currentColor" aria-hidden="true">
        <path d="M8 54c9-9 17-15 27-17 10-2 19-1 30 2 7 2 14 1 22-2l-13-15c-4-5-2-10 3-10 6 0 13 8 20 23 10 3 17 10 17 18 0 9-8 15-20 15H75c-8 0-14 2-21 7-8 6-16 9-26 9H13c-7 0-10-7-5-13Zm72-32c-2-9-1-17 3-19 5-2 11 4 17 18l7 18c-5-2-10-4-14-5-5-8-9-12-13-12Zm-55 46c7 0 13-2 19-7l8-7c-11 1-20 0-27-3-5 3-9 7-13 13 3 3 7 4 13 4Zm80-17c0-3-3-5-6-5-2 0-4 1-4 3 0 3 4 6 7 6 2 0 3-2 3-4Z" />
      </svg>
    )
  }

  return (
    <svg className="block h-4 w-6 overflow-visible" viewBox="0 0 120 90" fill="currentColor" aria-hidden="true">
      <path d="M12 51c4 0 8-2 12-5 2-20 25-35 54-28 13 3 22 11 25 23l9-4c5-2 10 1 10 6 0 7-7 12-17 12h-5c-6 7-17 11-31 11H38c-5 0-9 4-13 8H10c-5 0-7-6-3-9l8-7c-3-1-5-3-5-5 0-1 1-2 2-2Zm10 13h12c4-4 8-7 13-8H28c-2 2-4 5-6 8Zm57-45c-16-3-31 0-40 8h52c-4-4-8-6-12-8Zm-48 15c-2 4-4 9-4 14h22l5-14H31Zm31 0-5 14h25l-4-14H62Zm24 0 4 14h9c-1-5-3-10-6-14h-7Zm22 9c-2 0-3 1-3 3s1 3 3 3 3-1 3-3-1-3-3-3Z" />
    </svg>
  )
}

export function LeverageMarker({ kind }: { kind: MarkerKind }) {
  const label = kind === 'hare' ? 'Hare: your golfer to root for' : 'Tortoise: opponent golfer to root against'
  const className = 'text-[#111]'
  return (
    <span title={label} aria-label={label} className={`inline-flex h-4 w-6 shrink-0 items-center justify-center overflow-visible leading-none ${className}`}>
      <LeverageMarkerIcon kind={kind} />
    </span>
  )
}

export function LeverageMarkerCorner({ kind }: { kind?: MarkerKind }) {
  if (!kind) return null
  return (
    <span className="absolute left-0.5 top-0.5 z-[1] overflow-visible leading-none">
      <LeverageMarker kind={kind} />
    </span>
  )
}

export function LeverageMarkerLegend({ showTortoise = true, className = '' }: { showTortoise?: boolean; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#f3df9c] ${className}`}>
      <span className="inline-flex items-center gap-1"><LeverageMarker kind="hare" /> Hare = root for</span>
      {showTortoise ? <span className="inline-flex items-center gap-1"><LeverageMarker kind="tortoise" /> Tortoise = root against</span> : null}
    </div>
  )
}
