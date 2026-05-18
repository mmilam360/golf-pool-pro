import Image from 'next/image'
import Link from 'next/link'

const leaderboardRows = [
  {
    rank: '1',
    name: 'Lonnie',
    total: '-26',
    golfers: [
      ['-8', 'Scheffler', 'F'],
      ['-7', 'McIlroy', '17'],
      ['-6', 'Schauffele', 'F'],
      ['-5', 'Morikawa', '16'],
    ],
    other: ['+2 Spieth F', '+4 Fowler F'],
  },
  {
    rank: '2',
    name: 'Jeff',
    total: '-25',
    golfers: [
      ['-7', 'McIlroy', '17'],
      ['-8', 'Scheffler', 'F'],
      ['-5', 'Cantlay', 'F'],
      ['-5', 'Homa', '15'],
    ],
    other: ['+2 Spieth F', '+4 Fowler F'],
  },
  {
    rank: '3',
    name: 'Dan M',
    total: '-21',
    golfers: [
      ['-6', 'Schauffele', 'F'],
      ['-5', 'Morikawa', '16'],
      ['-8', 'Scheffler', 'F'],
      ['-2', 'Åberg', '15'],
    ],
    other: ['+2 Spieth F', '+4 Fowler F'],
  },
  {
    rank: '4',
    name: 'Mikey',
    total: '-18',
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
    total: '-17',
    golfers: [
      ['-6', 'Hovland', 'F'],
      ['-5', 'Cantlay', '17'],
      ['-3', 'Day', 'F'],
      ['-2', 'Burns', '16'],
    ],
    other: ['+4 Fowler F', '+2 Spieth F'],
  },
  {
    rank: '6',
    name: 'Bryan',
    total: '-15',
    golfers: [
      ['-5', 'Rahm', 'F'],
      ['-4', 'Koepka', '17'],
      ['-5', 'Homa', 'F'],
      ['-1', 'Clark', '16'],
    ],
    other: ['+2 Spieth F', '+4 Fowler F'],
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
  ['Live standings', 'Watch the full pool leaderboard from the dashboard once scores start moving.'],
  ['Smart alerts', 'Players can get notified when scoring starts, picks are due, or they jump into first.'],
  ['Cut and OB scoring', 'Missed cuts and OB stand-ins are handled by the pool rules instead of spreadsheet math.'],
  ['Fast invites', 'Invite by link, passcode, or previous-player list when you run the next pool.'],
  ['Run it back', 'Reuse the same group for the next tournament instead of starting from scratch.'],
  ['Capped host fee', 'Players join free. The host pays one capped pool fee after picks lock.'],
]

const finalScoreRows = leaderboardRows.slice(0, 5).map(entry => [entry.rank, entry.name, entry.total])

const finalScoreStoryHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; width: 100vw; min-height: 100vh; background: #f3ead7; color: #1f2a24; font-family: Arial, Helvetica, sans-serif; overflow: hidden; }
    .story { position: relative; width: 100vw; height: 100vh; overflow: hidden; background-color: #f3ead7; background-image: linear-gradient(rgba(60,45,25,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(60,45,25,.08) 1px, transparent 1px); background-size: 5vw 5vw; }
    .logo { position: absolute; top: 14.2vh; left: 50%; width: 35vw; max-width: 210px; transform: translateX(-50%); }
    .boardWrap { position: absolute; left: 6.2vw; right: 10.6vw; top: 23vh; height: 45.5vh; }
    .post { position: absolute; left: 50%; top: 70vh; width: 12.2vw; height: 30vh; transform: translateX(-50%); background: #123c2f; }
    .post::after { content: ''; position: absolute; top: -1.48vh; right: -4.45vw; width: 4.45vw; height: calc(100% + 2.95vh); background: #001f17; clip-path: polygon(0 0, 100% 2.95vh, 100% 100%, 0 calc(100% - 2.95vh)); }
    .depthRight { position: absolute; top: 0; right: -4.45vw; width: 4.45vw; height: 100%; background: #001f17; clip-path: polygon(0 0, 100% 2.95vh, 100% calc(100% - 2.95vh), 0 100%); }
    .depthBottom { position: absolute; left: 0; right: 0; bottom: -2.95vh; height: 2.95vh; background: #001f17; clip-path: polygon(0 0, 100% 0, 100% 100%, 4.45vw 100%); }
    .frame { position: relative; height: 100%; background: #123c2f; padding: 3.7vw; }
    .scoreFace { height: 100%; background: #d8b45d; padding: 2.6vw; }
    .table { height: 100%; overflow: hidden; background: #f7f7f2; }
    .head { height: 8.25vh; display: flex; flex-direction: column; align-items: center; justify-content: center; border-bottom: .3vh solid #d8cab0; text-align: center; }
    .pool { margin: 0; max-width: 70vw; color: #111; font-size: clamp(18px, 4.75vw, 50px); font-weight: 600; line-height: .96; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .event { margin: .65vh 0 0; color: #005b3c; font-size: clamp(11px, 2.45vw, 26px); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
    .mode { margin: .45vh 0 0; color: #657168; font-size: clamp(9px, 1.95vw, 20px); font-weight: 800; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
    .labels, .row { display: grid; grid-template-columns: 14% 1fr 23%; align-items: center; }
    .labels { height: 2.55vh; background: #efeee6; border-bottom: .22vh solid #d8cab0; color: #111; font-size: clamp(7px, 1.55vw, 17px); font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .row { height: 5.35vh; border-bottom: .15vh solid #d8cab0; background: #fbfbf5; font-size: clamp(16px, 4.25vw, 46px); }
    .row:nth-child(even) { background: #f7f7f2; }
    .rank, .score { height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 900; }
    .rank { color: #b21e23; border-right: .15vh solid #d8cab0; }
    .name { min-width: 0; padding: 0 2.8vw; color: #111; font-weight: 600; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .score { color: #b21e23; border-left: .15vh solid #d8cab0; font-weight: 900; font-variant-numeric: tabular-nums; }
    .footer { position: absolute; left: 10vw; right: 10vw; bottom: 10.4vh; border: .5vh solid #123c2f; background: #fbf7ed; padding: 1.15vh 2.2vw; text-align: center; }
    .footerInner { display: grid; place-items: center; overflow: hidden; background: rgba(255,255,255,.78); padding: 1.85vh 1.4vw; }
    .rule { height: .62vh; width: 66%; margin: 0 auto; background: #d8b45d; }
    .url { width: max-content; max-width: 100%; margin: 1.45vh auto; color: #123c2f; font-size: clamp(14px, 4.25vw, 45px); font-weight: 900; letter-spacing: .035em; line-height: 1; text-align: center; text-transform: uppercase; white-space: nowrap; }
    .igProgress { position: absolute; z-index: 20; left: 6vw; right: 6vw; top: 6.2vh; display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }
    .igProgress span { height: 2px; border-radius: 999px; background: rgba(18,60,47,.35); }
    .igProgress span:first-child { background: #123c2f; }
    .igProfile { position: absolute; z-index: 20; left: 6vw; right: 6vw; top: 7.7vh; display: flex; align-items: center; gap: 2.1vw; color: #123c2f; font-size: clamp(9px, 2.5vw, 14px); font-weight: 900; }
    .avatar { width: 8.4vw; height: 8.4vw; min-width: 28px; min-height: 28px; border: 2px solid rgba(18,60,47,.8); border-radius: 999px; background: #fbf7ed url('/avatars/lonnie72-golfer-avatar.png') center 44% / 138% no-repeat; }
    .time { color: rgba(18,60,47,.72); font-weight: 800; }
    .dots { margin-left: auto; letter-spacing: .18em; font-size: 18px; line-height: 1; }
    .igReply { position: absolute; z-index: 20; left: 6vw; right: 6vw; bottom: 3.6vh; display: flex; align-items: center; gap: 3vw; color: #123c2f; }
    .message { flex: 1; border: 1.5px solid rgba(18,60,47,.72); border-radius: 999px; padding: 1.2vh 4vw; background: rgba(251,247,237,.45); color: rgba(18,60,47,.82); font-size: clamp(9px, 2.6vw, 14px); font-weight: 800; }
    .icon { width: 6vw; height: 6vw; min-width: 22px; min-height: 22px; }
  </style>
</head>
<body>
  <main class="story">
    <div class="igProgress" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <div class="igProfile" aria-hidden="true"><div class="avatar"></div><strong>lonnie72</strong><span class="time">22h</span><span class="dots">⋮</span></div>
    <img class="logo" src="https://www.golfpoolspro.com/brand/golf-pools-pro-wordmark.png" alt="Golf Pools Pro" />
    <div class="post" aria-hidden="true"></div>
    <section class="boardWrap" aria-label="Tiger's Tribe story-ready final board">
      <div class="depthRight" aria-hidden="true"></div>
      <div class="depthBottom" aria-hidden="true"></div>
      <div class="frame">
        <div class="scoreFace">
          <div class="table">
            <header class="head">
              <p class="pool">Tiger's Tribe</p>
              <p class="event">PGA Championship</p>
              <p class="mode">Final board</p>
            </header>
            <div class="labels"><div>Rank</div><div>Entry</div><div>Score</div></div>
            ${finalScoreRows.map(([rank, name, total]) => `<div class="row"><div class="rank">${rank}</div><div class="name">${name}</div><div class="score">${total}</div></div>`).join('')}
          </div>
        </div>
      </div>
    </section>
    <footer class="footer"><div class="footerInner"><div class="rule"></div><div class="url">GOLFPOOLSPRO.COM</div><div class="rule"></div></div></footer>
    <div class="igReply" aria-hidden="true"><div class="message">Send message</div><svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" stroke="currentColor" stroke-width="1.8"/></svg><svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M4 5l16 7-16 7 4-7-4-7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></div>
  </main>
</body>
</html>`

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
    answer: 'No. Add as many entries as you need. Pricing stays simple: a 12-entry pool costs $7 instead of the $20 flat fee most golf pool sites charge.',
  },
  {
    question: 'Do players need to pay to join?',
    answer: 'Players join with the pool link or passcode, make picks, and follow the leaderboard. The host handles the pool fee after entries lock.',
  },
  {
    question: 'Can I use this for an office pool or a group text pool?',
    answer: 'Yes. If your pool usually lives in a spreadsheet or group text, Golf Pools Pro gives everyone one place for picks, rules, and the live board.',
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
    details: [
      {
        label: 'iPhone',
        steps: ['Open Golf Pools Pro in Safari.', 'Tap the Share button.', 'Choose Add to Home Screen.', 'Tap Add.'],
        href: 'https://support.apple.com/en-us/104996',
        linkText: 'Apple iPhone PWA help',
      },
      {
        label: 'Android',
        steps: ['Open Golf Pools Pro in Chrome.', 'Tap the three-dot menu.', 'Choose Add to Home screen or Install app.', 'Tap Install or Add.'],
        href: 'https://support.google.com/chrome/answer/9658361',
        linkText: 'Chrome Android PWA help',
      },
    ],
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
      text: `${item.answer}${item.details ? ` ${item.details.map(detail => `${detail.label}: ${detail.steps.join(' ')}`).join(' ')}` : ''}`,
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
              Create a golf pool, send one link, lock picks at the first tee time, and let everyone follow the live leaderboard.
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
            <div className="gpp-board-post mx-auto -mt-[4.5px] h-24 w-14 [--gpp-depth-x:14px] [--gpp-depth-y:9px] md:-mt-[7px] md:h-28 md:w-16 md:[--gpp-depth-x:22px] md:[--gpp-depth-y:14px]">
              <div className="gpp-board-post-depth" aria-hidden="true" />
              <div className="gpp-board-post-face" aria-hidden="true" />
            </div>
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
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[#0f2f25] md:text-5xl">Everything your golf pool needs after picks lock.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-[#657168]">
              Golf Pools Pro keeps picks, invites, scoring, alerts, and the live board your group actually checks in one place.
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

        <section className="border-y border-[#d8cab0] bg-[#0f2f25] px-5 py-14 text-white md:px-8 md:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f3df9c]">After the final putt</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-5xl">Share the final board.</h2>
          </div>

          <div className="mx-auto mt-9 w-full max-w-[300px] sm:max-w-[340px]">
            <div className="relative aspect-[1350/2760] w-full drop-shadow-[12px_14px_0_#001f17]">
              <div
                className="absolute overflow-hidden bg-[#6f8172]"
                style={{ left: '5.35%', top: '2.35%', width: '89.35%', height: '95.15%', borderRadius: '12.4% / 5.9%' }}
              >
                <iframe
                  title="Golf Pools Pro final score story-ready preview inside an iPhone 17 Pro frame"
                  srcDoc={finalScoreStoryHtml}
                  className="absolute border-0 bg-[#6f8172]"
                  style={{ left: '-1.35%', top: '-1.08%', width: '102.7%', height: '102.16%' }}
                  loading="lazy"
                />
              </div>
              <Image
                unoptimized
                src="/device-frames/iphone-17-pro-deep-blue-portrait.png"
                alt="iPhone 17 Pro frame showing a Golf Pools Pro final board story preview"
                width={1350}
                height={2760}
                className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none"
              />
            </div>
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
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[#0f2f25] md:text-5xl">Questions every pool runner gets.</h2>
              <p className="mt-4 max-w-xl leading-7 text-[#657168]">Golf Pools Pro handles rules, missed cuts, fees, and entry limits up front, so Sunday is about the leaderboard, not the group chat.</p>
            </div>
            <div className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
              {faqItems.map(item => (
                <details key={item.question} className="group border-b-2 border-[#123c2f] last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-black text-[#0f2f25] [&::-webkit-details-marker]:hidden">
                    <span>{item.question}</span>
                    <span className="text-2xl leading-none text-[#b21e23] group-open:hidden">+</span>
                    <span className="hidden text-2xl leading-none text-[#b21e23] group-open:block">–</span>
                  </summary>
                  <div className="px-5 pb-5 leading-7 text-[#4f5b52]">
                    <p>{item.answer}</p>
                    {item.details ? (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {item.details.map(detail => (
                          <div key={detail.label} className="border border-[#d8cab0] bg-[#fbf7ed] p-4">
                            <p className="font-black uppercase tracking-[0.08em] text-[#123c2f]">{detail.label}</p>
                            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6">
                              {detail.steps.map(step => (
                                <li key={step}>{step}</li>
                              ))}
                            </ol>
                            <a href={detail.href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-black text-[#123c2f] underline decoration-[#b58a3a] underline-offset-4">
                              {detail.linkText}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          </div>

          <div className="grid gap-8 border-2 border-[#123c2f] bg-white p-6 shadow-[7px_7px_0_#d8cab0] md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8a6724]">Golf pool manager</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-[#0f2f25] md:text-4xl">Set up your next pool before the first tee time.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-[#657168]">
                Skip the spreadsheet cleanup and group-text standings. Players enter their picks, then the live board takes over once scoring starts.
              </p>
            </div>
            <Link href="/signup" className="border-2 border-[#123c2f] bg-[#123c2f] px-6 py-3 text-center font-extrabold text-white transition-colors hover:bg-[#0f2f25]">
              Create pool
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#d8cab0] bg-[#fbf7ed] px-5 py-6 text-center text-sm text-[#657168]">
        <div>
          <Link href="/rules" className="font-semibold hover:text-[#123c2f]">Rules</Link>
          <span className="mx-3">/</span>
          <Link href="/blog" className="font-semibold hover:text-[#123c2f]">Guides</Link>
          <span className="mx-3">/</span>
          <Link href="/help" className="font-semibold hover:text-[#123c2f]">Help</Link>
          <span className="mx-3">/</span>
          <Link href="/privacy" className="font-semibold hover:text-[#123c2f]">Privacy Policy</Link>
          <span className="mx-3">/</span>
          <Link href="/terms" className="font-semibold hover:text-[#123c2f]">Terms</Link>
        </div>
        <p className="mt-3 text-xs">© {new Date().getFullYear()} Golf Pools Pro. All rights reserved.</p>
      </footer>
    </div>
  )
}
