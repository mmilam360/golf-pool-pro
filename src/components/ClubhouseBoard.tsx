import type { ReactNode } from 'react'

type ClubhouseBoardProps = {
  label?: string
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function ClubhouseBoard({ label = 'Board', title, subtitle, children, footer, className = '' }: ClubhouseBoardProps) {
  return (
    <div className={`gpp-3d [--gpp-depth-x:12px] [--gpp-depth-y:8px] [--gpp-side-color:#00281e] [--gpp-bottom-color:#001f17] md:[--gpp-depth-x:22px] md:[--gpp-depth-y:14px] ${className}`} style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}>
      <div className="gpp-3d-face gpp-board-frame border-[9px] border-[#123c2f]">
        <div className="gpp-score-face border-2 border-[#111] bg-[#f7f7f2] text-[#111]">
          <div className="relative border-b-2 border-[#111] px-3 py-2 text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#005b3c]">{label}</p>
            <h2 className="text-2xl font-black uppercase leading-none tracking-[0.18em] text-[#111] sm:text-3xl">{title}</h2>
            {subtitle && <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#005b3c] sm:text-xs">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="border-t-2 border-[#111] bg-[#efeee6] px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.1em] text-[#111] sm:text-xs">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

type BoardMetricProps = {
  label: string
  value: ReactNode
  tone?: 'red' | 'green' | 'ink'
}

export function BoardMetric({ label, value, tone = 'red' }: BoardMetricProps) {
  const valueColor = tone === 'green' ? 'text-[#005b3c]' : tone === 'ink' ? 'text-[#111]' : 'text-[#b21e23]'
  return (
    <div className="border-r border-t border-[#111] bg-[#fbfbf5] px-2 py-2 text-center last:border-r-0">
      <div className={`text-2xl font-black leading-none ${valueColor}`}>{value}</div>
      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#111]">{label}</div>
    </div>
  )
}

export function CodeCells({ value, length = 6 }: { value: string; length?: number }) {
  const chars = value.padEnd(length, ' ').slice(0, length).split('')
  return (
    <div className="grid grid-cols-6 border-t-2 border-[#111] bg-[#fbfbf5]">
      {chars.map((char, index) => (
        <div key={`${char}-${index}`} className="border-r-2 border-[#111] px-1 py-4 text-center text-3xl font-black uppercase tracking-[0.02em] text-[#b21e23] last:border-r-0 sm:text-4xl">
          {char.trim() || '—'}
        </div>
      ))}
    </div>
  )
}
