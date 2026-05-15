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
    name: 'Jeff',
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
    name: 'Dan M',
    total: '-31',
    golfers: [
      ['-7', 'Schauffele', 'F'],
      ['-5', 'Morikawa', '16'],
      ['-4', 'Scheffler', 'F'],
      ['-4', 'Åberg', '15'],
    ],
    other: ['+1 Spieth F', 'CUT Fowler'],
  },
  {
    rank: '4',
    name: 'Mikey',
    total: '-28',
    golfers: [
      ['-6', 'Thomas', 'F'],
      ['-5', 'Fleetwood', '17'],
      ['-4', 'Finau', 'F'],
      ['-3', 'Lowry', '16'],
    ],
    other: ['+2 Spieth F', '+5 Fowler F'],
  },
  {
    rank: '5',
    name: 'Rick',
    total: '-25',
    golfers: [
      ['-6', 'Hovland', 'F'],
      ['-4', 'Cantlay', '17'],
      ['-3', 'Day', 'F'],
      ['-2', 'Burns', '16'],
    ],
    other: ['+4 Fowler F', 'CUT Spieth'],
  },
  {
    rank: '6',
    name: 'Bryan',
    total: '-22',
    golfers: [
      ['-5', 'Rahm', 'F'],
      ['-4', 'Koepka', '17'],
      ['-3', 'Homa', 'F'],
      ['-1', 'Clark', '16'],
    ],
    other: ['+3 Spieth F', 'CUT Fowler'],
  },
]

const setupSteps = [
  ['01', 'Create the pool', 'Pick the tournament, set the rules, and share the join link.'],
  ['02', 'Collect picks', 'Players enter their own teams before the first tee time.'],
  ['03', 'Follow the leaderboard', 'Lock entries, watch scores update, and settle arguments from one board.'],
]

const pricingRows = [
  ['First 5 entries', 'Free'],
  ['Extra active entries', '$1 each'],
  ['Maximum pool fee', '$25 cap'],
]

const featureRows = [
  ['Live standings', 'Follow the full pool leaderboard from the dashboard once scores start moving.'],
  ['Smart alerts', 'Players can get notified when scoring starts, picks are due, or they jump into first.'],
  ['Cut and OB scoring', 'Missed cuts and OB stand-ins are handled by the pool rules instead of spreadsheet math.'],
  ['Fast invites', 'Invite by link, passcode, or previous-player list when you run the next pool.'],
  ['Run it back', 'Pool runners can reuse the same group instead of rebuilding every tournament.'],
  ['Capped host fee', 'Players join free. The host pays one capped pool fee after picks lock.'],
]

const faqItems = [
  {
    question: 'What happens if one of my golfers misses the cut?',
    answer: 'They move out of your counted scores if you have better active picks. If too many picks miss the cut, Golf Pools Pro fills the open counted spots with OB stand-ins based on the pool rules.',
  },
  {
    question: 'How does the OB rule work?',
    answer: 'OB keeps every entry at the same number of counted scores. If your pool counts 4 golfers and you only have 3 active golfers left, the empty spot gets an OB score based on the worst active counted score plus the pool penalty.',
  },
  {
    question: 'Is there a limit on entries?',
    answer: 'No. Add as many entries as you need. The pricing is the real break: a 12-entry pool costs $7 instead of the $20 flat fee most golf pool sites charge.',
  },
  {
    question: 'Do players need to pay to join?',
    answer: 'No. Players join with the pool link or passcode, make picks, and follow the leaderboard. The host handles any pool fee after entries lock.',
  },
  {
    question: 'Can I use this for an office pool or a group text pool?',
    answer: 'Yes. Golf Pools Pro is built for the person who usually collects picks in a spreadsheet and posts standings manually. The app handles picks, rules, and the live board in one place.',
  },
  {
    question: 'Can players get notifications?',
    answer: 'Yes. Players can turn on alerts for live scoring, pick deadlines, and taking the lead.',
  },
  {
    question: 'Can I run the same pool again?',
    answer: 'Yes. Pool runners can reuse a previous group and invite those players back faster for the next tournament.',
  },
  {
    question: 'Can I install Golf Pools Pro on my phone?',
    answer: 'Yes. Golf Pools Pro is a Progressive Web App, so you can add it to your iPhone or Android home screen from the browser.',
  },
]

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Golf Pools Pro',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web',
  url: 'https://www.golfpoolspro.com',
  description: 'Online golf pool manager with private join links, pick tracking, automatic scoring, OB rules, and live leaderboards.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'First 5 active entries free. Extra active entries are $1 each, capped at $25 per pool.',
  },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Golf Pools Pro',
  url: 'https://www.golfpoolspro.com',
  logo: 'https://www.golfpoolspro.com/brand/golf-pools-pro-wordmark.png',
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
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
        <section className="mx-auto max-w-7xl px-4 pb-0 pt-8 sm:px-5 md:px-8 lg:pt-10">
          <div className="mx-auto max-w-4xl pb-6 text-center">
            <p className="mx-auto mb-4 w-fit max-w-full border-y border-[#b58a3a] py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a6724] sm:text-xs sm:tracking-[0.28em]">
              Golf pool manager
            </p>
            <h1 className="max-w-full font-display text-[2.05rem] font-bold leading-[1.02] tracking-[-0.035em] text-[#0f2f25] sm:text-[3rem] md:text-[4.1rem] xl:text-[4.55rem]">
              <span className="block">Golf pools without</span>
              <span className="block">the spreadsheet.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#4f5b52] sm:text-lg sm:leading-8">
              Run a PGA golf pool, collect picks by link, lock entries at tee time, and show everyone the live leaderboard.
            </p>
          </div>

          <div className="relative mx-auto flex max-w-5xl flex-col justify-start pt-1" style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}>
            <div className="gpp-3d w-full [--gpp-depth-x:14px] [--gpp-depth-y:9px] [--gpp-side-color:#001f17] [--gpp-bottom-color:#001f17] md:[--gpp-depth-x:22px] md:[--gpp-depth-y:14px]">
            <div className="gpp-board-depth-right" aria-hidden="true" />
            <div className="gpp-board-depth-bottom" aria-hidden="true" />
            <div className="gpp-3d-face gpp-board-frame border-[10px] border-[#123c2f] md:border-[14px]">
              <div className="gpp-score-face border-2 border-[#111] bg-[#f7f7f2] text-center">
                <div className="relative border-b-2 border-[#111] px-3 py-2">
                  <p className="text-2xl font-black uppercase leading-none tracking-[0.18em] text-[#111] sm:text-3xl">PGA Championship</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#005b3c] sm:text-xs">Tiger&apos;s Tribe pool</p>
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
            <div className="gpp-board-post mx-auto -mt-[10px] h-24 w-14 border-x-4 border-[#003622] md:h-28 md:w-16" />
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

        <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8a6724]">What runs the pool</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[#0f2f25] md:text-5xl">Everything your golf pool needs once picks lock.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-[#657168]">
              Golf Pools Pro keeps the useful parts in one place: picks, invites, scoring, alerts, and the live board your group actually checks.
            </p>
          </div>
          <div className="grid border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0] md:grid-cols-2 lg:grid-cols-3">
            {featureRows.map(([title, body]) => (
              <div key={title} className="border-b-2 border-[#123c2f] p-5 md:border-r-2 lg:[&:nth-child(3n)]:border-r-0 md:[&:nth-child(even)]:border-r-0 lg:[&:nth-child(even)]:border-r-2 [&:nth-last-child(-n+1)]:border-b-0 md:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0">
                <h3 className="font-black uppercase tracking-[0.06em] text-[#123c2f]">{title}</h3>
                <p className="mt-3 leading-7 text-[#4f5b52]">{body}</p>
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
              Example: a 13-entry pool costs $8. A big pool never goes over $25.
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-14 md:px-8 md:pb-20">
          <div className="mb-10 grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8a6724]">Common questions</p>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[#0f2f25] md:text-5xl">The stuff every pool runner has to explain.</h2>
              <p className="mt-4 max-w-xl leading-7 text-[#657168]">Rules, missed cuts, payment, and entry limits are handled up front so your group is not arguing in the chat on Sunday.</p>
            </div>
            <div className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
              {faqItems.map(item => (
                <details key={item.question} className="group border-b-2 border-[#123c2f] last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-black text-[#0f2f25] [&::-webkit-details-marker]:hidden">
                    <span>{item.question}</span>
                    <span className="text-2xl leading-none text-[#b21e23] group-open:hidden">+</span>
                    <span className="hidden text-2xl leading-none text-[#b21e23] group-open:block">–</span>
                  </summary>
                  <p className="px-5 pb-5 leading-7 text-[#4f5b52]">{item.answer}</p>
                </details>
              ))}
              <div className="border-t-2 border-[#123c2f] bg-[#fbf7ed] px-5 py-4 text-sm font-semibold leading-6 text-[#4f5b52]">
                Official PWA install help: <a href="https://support.apple.com/en-us/104996" target="_blank" rel="noreferrer" className="font-black text-[#123c2f] underline decoration-[#b58a3a] underline-offset-4">Apple iPhone</a>
                <span className="mx-2">/</span>
                <a href="https://support.google.com/chrome/answer/9658361" target="_blank" rel="noreferrer" className="font-black text-[#123c2f] underline decoration-[#b58a3a] underline-offset-4">Chrome Android</a>
              </div>
            </div>
          </div>

          <div className="grid gap-8 border-2 border-[#123c2f] bg-white p-6 shadow-[7px_7px_0_#d8cab0] md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8a6724]">Golf pool manager</p>
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
        <Link href="/rules" className="font-semibold hover:text-[#123c2f]">Rules</Link>
        <span className="mx-3">/</span>
        <Link href="/blog" className="font-semibold hover:text-[#123c2f]">Guides</Link>
        <span className="mx-3">/</span>
        <Link href="/help" className="font-semibold hover:text-[#123c2f]">Help</Link>
        <span className="mx-3">/</span>
        <Link href="/privacy" className="font-semibold hover:text-[#123c2f]">Privacy Policy</Link>
        <span className="mx-3">/</span>
        <Link href="/terms" className="font-semibold hover:text-[#123c2f]">Terms</Link>
      </footer>
    </div>
  )
}
