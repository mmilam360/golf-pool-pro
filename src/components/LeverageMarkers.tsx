type MarkerKind = 'hare' | 'tortoise'

export function LeverageMarkerIcon({ kind }: { kind: MarkerKind }) {
  if (kind === 'hare') {
    return (
      <svg className="h-3.5 w-4" viewBox="0 0 64 40" fill="currentColor" aria-hidden="true">
        <path d="M7 32c5.7-7.7 10.2-11.7 17.4-12.2 7.2-.5 11.7 1.9 17.7.2l-8.6-9.6c-1.9-2.1-1.6-4.7.8-5.2 2.5-.5 5.7 2.9 9.7 10.3l1.5-.6-4.2-11c-1-2.8.3-4.9 2.7-4.7 2.8.3 5.2 4.8 7.1 13.6 5.7 1.8 9 5.1 9 9 0 4.7-4.3 8.2-9.8 8.2H38.8c-4.9 0-8.2 1.3-12.1 4.6-3.2 2.8-6.5 4.1-10.3 4.1H7.7c-3.3 0-4.7-3.8-.7-6.7Zm2.4 3.5h8.3c2.6 0 4.7-.8 7.1-2.9l4.7-4.2c-5.6.5-9.7.5-13.1-.5-2.8 1.6-5 4-7 7.6Zm45.3-13.8c0-1.7-1.5-2.9-3.2-2.9-1.2 0-2 .7-2 1.7 0 1.8 2 3 3.5 3 .9 0 1.7-.6 1.7-1.8Z" />
      </svg>
    )
  }

  return (
    <svg className="h-3.5 w-4" viewBox="0 0 64 40" fill="currentColor" aria-hidden="true">
      <path d="M7.8 31.5h6.5c-1.7-2.4-2.4-5-2.4-7.6 0-9.9 8.6-17.1 20.1-17.1 10.7 0 18.6 5.6 20.2 14.1l5.2-2.5c2.7-1.3 5.8.6 5.8 3.6 0 3.7-3.7 6.5-8.6 6.5h-2.3c-.7 1.1-1.5 2.2-2.5 3h5.2c2 0 3.5 1.4 3.5 3.3S57 38 55.1 38h-9.8c-2.1 0-3.6-1.5-3.6-3.4v-1.1H25.6v1.1c0 1.9-1.5 3.4-3.6 3.4h-9.8c-2 0-3.5-1.3-3.5-3.2 0-1.9 1.4-3.3 3.5-3.3ZM18.1 23c0 2.8 1.1 5.1 3.1 6.7h22c2-1.6 3.2-3.9 3.2-6.7 0-6.2-5.9-10.8-14.2-10.8S18.1 16.8 18.1 23Zm39.6-.4c-.8 0-1.5.7-1.5 1.5s.7 1.4 1.5 1.4 1.4-.6 1.4-1.4-.6-1.5-1.4-1.5Z" />
    </svg>
  )
}

export function LeverageMarker({ kind }: { kind: MarkerKind }) {
  const label = kind === 'hare' ? 'Hare: your golfer to root for' : 'Tortoise: opponent golfer to root against'
  const className = kind === 'hare' ? 'text-[#123c2f]' : 'text-[#7a5a19]'
  return (
    <span title={label} aria-label={label} className={`inline-flex h-4 w-4 shrink-0 items-center justify-center ${className}`}>
      <LeverageMarkerIcon kind={kind} />
    </span>
  )
}

export function LeverageMarkerCorner({ kind }: { kind?: MarkerKind }) {
  if (!kind) return null
  return (
    <span className="absolute left-1 top-1 z-[1]">
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
