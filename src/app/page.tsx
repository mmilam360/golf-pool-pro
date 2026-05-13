import Image from 'next/image'
import Link from 'next/link'

const leaderboardRows = [
  {
    rank: '1',
    name: 'Lonnie',
    total: '-38',
    golfers: [
      ['-8', 'Scheffler', 'F'],
      ['-6', 'McIlroy', '17'],
      ['-6', 'Schauffele', 'F'],
      ['-5', 'Morikawa', '16'],
    ],
    other: ['+2 Spieth F', '+4 Fowler F'],
  },
  {
    rank: '2',
    name: 'Jeff Mac',
    total: '-34',
    golfers: [
      ['-7', 'McIlroy', '17'],
      ['-6', 'Scheffler', 'F'],
      ['-5', 'Cantlay', 'F'],
      ['-5', 'Homa', '15'],
    ],
    other: ['+3 Spieth F', '+5 Fowler F'],
  },
  {
    rank: '3',
    name: 'Dan Mc',
    total: '-31',
    golfers: [
      ['-7', 'Schauffele', 'F'],
      ['-5', 'Morikawa', '16'],
      ['-4', 'Scheffler', 'F'],
      ['-4', 'Åberg', '15'],
    ],
    other: ['+1 Spieth F', 'CUT Fowler'],
  },
]

const setupSteps = [
  ['01', 'Create the pool', 'Pick the tournament, set the rules, and share the join link.'],
  ['02', 'Collect picks', 'Players enter their own teams before the first tee time.'],
  ['03', 'Follow the leaderboard', 'Lock entries, watch scores update, and settle arguments from one board.'],
]

const pricingRows = [
  ['First 5 entries', 'Free'],
  ['Extra active entries', '72¢ each'],
  ['Maximum pool fee', '$25 cap'],
]

function scoreColor(score: string) {
  return score.startsWith('-') ? 'text-[#b21e23]' : score === 'E' ? 'text-[#111]' : 'text-[#005b3c]'
}

function GolferCell({ golfer }: { golfer: string[] }) {
  return (
    <td className="border-b border-r border-[#111] bg-[#fbfbf5] px-1 py-1 text-center align-middle shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
      <div className={`text-sm font-black leading-none sm:text-base ${scoreColor(golfer[0])}`}>{golfer[0]}</div>
      <div className="mt-0.5 truncate text-[9px] font-black uppercase leading-none tracking-[0.01em] text-[#111] sm:text-[10px]">{golfer[1]}</div>
      <div className="mt-0.5 text-[7px] font-black uppercase tracking-[0.06em] text-[#555] sm:text-[8px]">{golfer[2]}</div>
    </td>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <header className="border-b border-[#d8cab0] bg-[#fbf7ed]/90 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Golf Pools Pro home">
            <Image unoptimized src="/brand/golf-pools-pro-wordmark.png" alt="Golf Pools Pro" width={1660} height={695} priority className="h-14 w-auto object-contain sm:h-16 md:h-20" />
          </Link>
          <div className="flex shrink-0 items-center gap-2 text-xs font-semibold sm:text-sm">
            <Link href="/login" className="border border-[#123c2f] bg-[#fffdf8] px-3 py-2 text-[#123c2f] transition-colors hover:bg-[#f7f0df] sm:px-4">
              Sign in
            </Link>
            <Link href="/signup" className="border border-[#123c2f] bg-[#123c2f] px-3 py-2 text-white transition-colors hover:bg-[#0f2f25] sm:px-4">
              Create a pool
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-0 pt-8 sm:px-5 md:px-8 lg:min-h-0 lg:grid-cols-[0.86fr_1.14fr] lg:items-start lg:pt-8">
          <div className="pb-6 pt-6 lg:flex lg:flex-col lg:justify-center lg:pb-12 lg:pt-10">
            <p className="mb-4 w-fit max-w-full border-y border-[#b58a3a] py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a6724] sm:text-xs sm:tracking-[0.28em]">
              Golf pool manager
            </p>
            <h1 className="max-w-full font-display text-[1.55rem] font-bold leading-[1.02] tracking-[-0.035em] text-[#0f2f25] sm:text-[2.65rem] md:text-[3.25rem] xl:text-[3.45rem]">
              <span className="block lg:whitespace-nowrap">Golf pools without</span>
              <span className="block">the spreadsheet.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#4f5b52] sm:text-lg sm:leading-8">
              Run a PGA golf pool, collect picks by link, lock entries at tee time, and show everyone the live leaderboard.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="border-2 border-[#123c2f] bg-[#123c2f] px-6 py-3 text-center font-extrabold text-white transition-colors hover:bg-[#0f2f25]">
                Create a pool
              </Link>
              <Link href="/login" className="border-2 border-[#123c2f] bg-[#fffdf8] px-6 py-3 text-center font-extrabold text-[#123c2f] transition-colors hover:bg-[#f7f0df]">
                Sign in
              </Link>
            </div>
          </div>

          <div className="relative flex flex-col justify-start pt-3 lg:-mt-4 lg:pt-0" style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}>
            <div className="gpp-3d w-full [--gpp-depth-x:14px] [--gpp-depth-y:9px] [--gpp-side-color:#00281e] [--gpp-bottom-color:#001f17] md:[--gpp-depth-x:22px] md:[--gpp-depth-y:14px]">
            <div className="gpp-3d-face gpp-board-frame border-[10px] border-[#123c2f] md:border-[14px]">
              <div className="gpp-score-face border-2 border-[#111] bg-[#f7f7f2] text-center">
                <div className="relative border-b-2 border-[#111] px-3 py-2">
                  <p className="text-2xl font-black uppercase leading-none tracking-[0.24em] text-[#111] sm:text-3xl">Leaders</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#005b3c] sm:text-xs">Lonnie - PGA Championship pool</p>
                  <div className="absolute right-2 top-2 border border-[#d8cab0] bg-[#f3df9c] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#0f2f25]">Demo</div>
                </div>

                <div className="bg-[#f7f7f2] lg:hidden">
                  {leaderboardRows.map((entry, entryIndex) => (
                    <details key={entry.rank} open={entryIndex === 0} className="group border-b-2 border-[#111]">
                      <summary className="grid cursor-pointer list-none grid-cols-[38px_1fr_70px_20px] items-center gap-2 bg-[#f7f7f2] px-2 py-2 text-left [&::-webkit-details-marker]:hidden">
                        <div className="text-center text-xl font-black text-[#b21e23]">{entry.rank}</div>
                        <div className="min-w-0 truncate text-sm font-black uppercase tracking-[0.04em] text-[#111]">{entry.name}</div>
                        <div className={`text-right text-2xl font-black ${scoreColor(entry.total)}`}>{entry.total}</div>
                        <div className="flex items-center justify-center text-[#111]">
                          <svg className="h-4 w-4 group-open:hidden" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
                          </svg>
                          <svg className="hidden h-4 w-4 group-open:block" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
                          </svg>
                        </div>
                      </summary>
                      <div className="grid grid-cols-4 border-t border-[#111] bg-[#fbfbf5]">
                        {entry.golfers.map(golfer => (
                          <div key={`${entry.rank}-${golfer[1]}`} className="border-r border-t border-[#111] px-1 py-1.5 text-center [&:nth-child(4n)]:border-r-0">
                            <div className={`text-base font-black leading-none ${scoreColor(golfer[0])}`}>{golfer[0]}</div>
                            <div className="mt-1 truncate text-[10px] font-black uppercase leading-none tracking-[0.02em] text-[#111]">{golfer[1]}</div>
                            <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{golfer[2]}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>

                <div className="hidden bg-[#f7f7f2] lg:block">
                  <table className="w-full table-fixed border-collapse text-[12px] text-[#111]">
                    <thead>
                      <tr className="bg-[#f7f7f2] text-[9px] font-black uppercase tracking-[0.12em] text-[#111]">
                        <th className="w-[5%] border-b-2 border-r-2 border-[#111] bg-[#f7f7f2] px-1 py-2 text-center" aria-label="Rank" />
                        <th className="w-[17%] border-b-2 border-r-2 border-[#111] bg-[#f7f7f2] px-2 py-2 text-left">Entry</th>
                        <th className="border-b-2 border-r-2 border-[#111] px-1 py-2 text-center" colSpan={4}>Top golfers</th>
                        <th className="w-[12%] border-b-2 border-[#111] px-3 py-2 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardRows.map(entry => (
                        <tr key={entry.rank} className="bg-[#f7f7f2]">
                          <td className="border-b border-r-2 border-[#111] bg-[#f7f7f2] px-1 py-2.5 text-center text-xl font-black text-[#b21e23]">{entry.rank}</td>
                          <td className="min-w-0 border-b border-r-2 border-[#111] bg-[#f7f7f2] px-2 py-2.5 text-left">
                            <span className="block truncate text-sm font-black uppercase tracking-[0.02em] text-[#111]" title={entry.name}>{entry.name}</span>
                          </td>
                          {entry.golfers.map(golfer => <GolferCell key={`${entry.rank}-${golfer[1]}`} golfer={golfer} />)}
                          <td className={`border-b border-[#111] bg-[#fbfbf5] px-3 py-2.5 text-center text-2xl font-black tabular-nums ${scoreColor(entry.total)}`}>{entry.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-3 border-t-2 border-[#111] bg-[#efeee6] text-center text-[10px] font-black uppercase tracking-[0.08em] text-[#111] sm:text-xs">
                  <div className="border-r-2 border-[#111] px-2 py-3">12 picks</div>
                  <div className="border-r-2 border-[#111] px-2 py-3">Best shown</div>
                  <div className="px-2 py-3">Live scoring</div>
                </div>
              </div>
            </div>
            </div>
            <div className="gpp-board-post mx-auto -mt-[10px] h-28 w-14 border-x-4 border-[#003622] md:h-28 md:w-16" />
          </div>
        </section>

        <section className="border-y border-[#d8cab0] bg-[#123c2f] text-white">
          <div className="mx-auto grid max-w-7xl gap-0 px-5 md:grid-cols-3 md:px-8">
            {setupSteps.map(step => (
              <div key={step[0]} className="border-b border-white/15 py-8 md:border-b-0 md:border-r md:px-8 md:last:border-r-0">
                <p className="mb-4 font-mono text-sm font-bold text-[#f3df9c]">{step[0]}</p>
                <h3 className="font-display text-2xl font-bold">{step[1]}</h3>
                <p className="mt-3 max-w-sm leading-7 text-[#d8e3dc]">{step[2]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[0.85fr_1.15fr] md:items-start md:px-8 md:py-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8a6724]">Simple pricing</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-none text-[#0f2f25] md:text-5xl">Free for small pools. Capped for bigger ones.</h2>
            <p className="mt-4 max-w-xl leading-7 text-[#657168]">
              The host pays only after entries lock. Players can join, make picks, and follow the board without hitting a payment screen.
            </p>
          </div>
          <div className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
            {pricingRows.map(([label, detail]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] items-center border-b-2 border-[#123c2f] px-5 py-5 last:border-b-0">
                <span className="font-black uppercase tracking-[0.04em] text-[#1f2a24]">{label}</span>
                <span className="font-display text-2xl font-black leading-none text-[#005b3c] sm:text-3xl">{detail}</span>
              </div>
            ))}
            <div className="border-t-2 border-[#123c2f] bg-[#fbf7ed] px-5 py-4 text-sm font-semibold leading-6 text-[#4f5b52]">
              Example: a 13-entry pool costs $5.76. A big pool never goes over $25.
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-14 md:px-8 md:pb-20">
          <div className="grid gap-8 border-2 border-[#123c2f] bg-white p-6 shadow-[7px_7px_0_#d8cab0] md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8a6724]">Golf pool app</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-[#0f2f25] md:text-4xl">Create the pool before the first tee time.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-[#657168]">
                No spreadsheet cleanup. No group-text standings. Players enter picks, and the leaderboard carries the pool once scoring starts.
              </p>
            </div>
            <Link href="/signup" className="border-2 border-[#123c2f] bg-[#123c2f] px-6 py-3 text-center font-extrabold text-white transition-colors hover:bg-[#0f2f25]">
              Create pool
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#d8cab0] bg-[#fbf7ed] px-5 py-6 text-center text-sm text-[#657168]">
        <Link href="/privacy" className="font-semibold hover:text-[#123c2f]">Privacy Policy</Link>
        <span className="mx-3">/</span>
        <Link href="/terms" className="font-semibold hover:text-[#123c2f]">Terms</Link>
      </footer>
    </div>
  )
}
