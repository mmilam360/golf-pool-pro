import type { Metadata } from 'next'
import Link from 'next/link'

const siteUrl = 'https://www.golfpoolspro.com'
const pageUrl = `${siteUrl}/best-golf-pool-sites`

export const metadata: Metadata = {
  title: 'Best Golf Pool Sites Compared | Easy Office Pools Alternative',
  description: 'Compare the best golf pool sites for office pools, majors pools, fantasy golf groups, and live PGA leaderboards, including Easy Office Pools and Golf Pools Pro.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'Best Golf Pool Sites Compared | Golf Pools Pro',
    description: 'A practical comparison of golf pool sites for office pools, majors pools, and live tournament leaderboards.',
    url: pageUrl,
    siteName: 'Golf Pools Pro',
    type: 'article',
  },
}

type RankedSite = {
  rank: number
  name: string
  tag: string
  bestFor: string
  good: string
  tradeoff: string
  verdict: string
}

const rankedSites: RankedSite[] = [
  {
    rank: 5,
    name: 'Fantrax',
    tag: 'Fantasy league depth',
    bestFor: 'Groups that want a full fantasy sports platform with golf as one option.',
    good: 'Fantrax is built for people who like deeper fantasy league controls and a more traditional fantasy sports setup.',
    tradeoff: 'That depth can feel heavier than what a normal office golf pool or major championship group needs for one tournament week.',
    verdict: 'Good for fantasy diehards. Less ideal if your group just wants picks, a clean golf board, and a fast setup.',
  },
  {
    rank: 4,
    name: 'OfficeFootballPool',
    tag: 'Multi-sport pool hosting',
    bestFor: 'Commissioners who already run football pools and want one broad pool-hosting account.',
    good: 'OfficeFootballPool publicly positions itself around pool hosting for football, golf, basketball, and more.',
    tradeoff: 'A broad sports pool host can work, but golf-specific moments like cut chaos, counted picks, and live rooting angles need to be easy to follow.',
    verdict: 'Worth checking if your group already lives there. Not the most golf-native option.',
  },
  {
    rank: 3,
    name: 'RunYourPool',
    tag: 'Big multi-sport platform',
    bestFor: 'Groups that run several types of sports pools and want one familiar pool-hosting brand.',
    good: 'RunYourPool is a large sports pool host with a wide menu of pool types.',
    tradeoff: 'The tradeoff is the same as most broad platforms: the product has to serve many sports, not just golf pool runners.',
    verdict: 'Solid general option. If the whole job is a golf pool, a golf-first product should feel sharper.',
  },
  {
    rank: 2,
    name: 'Easy Office Pools',
    tag: 'Simple office-pool familiarity',
    bestFor: 'Pool runners who search for a straightforward office pool site and want something familiar.',
    good: 'Easy Office Pools has the exact kind of search intent many golf pool runners use when they are trying to replace a spreadsheet.',
    tradeoff: 'For a golf pool, the experience should feel less like office admin and more like tournament week: live board, player picks, cut line pressure, and clear rooting angles.',
    verdict: 'A relevant comparison point. If you searched for an Easy Office Pools alternative for golf, keep scrolling.',
  },
  {
    rank: 1,
    name: 'Golf Pools Pro',
    tag: 'Our pick for golf pools',
    bestFor: 'Office pools, majors pools, golf trips, friend groups, and recurring pool runners who want the whole weekend to be easy to follow.',
    good: 'Golf Pools Pro is built around golf from the first screen: private links, passcodes, mobile pick entry, live PGA leaderboards, cut and OB rules, grouped formats, QR signup posters, and run-it-back tools for the next tournament.',
    tradeoff: 'It is not trying to be a full fantasy sports universe. That is the point.',
    verdict: 'Best fit if the goal is a good-looking golf pool that players keep checking all week.',
  },
]

const comparisonRows = [
  ['Golf-first setup', 'Golf Pools Pro'],
  ['Easy Office Pools search alternative', 'Golf Pools Pro, Easy Office Pools'],
  ['Broad multi-sport pool hosting', 'RunYourPool, OfficeFootballPool'],
  ['Deeper fantasy sports league controls', 'Fantrax'],
  ['Live PGA leaderboard feel', 'Golf Pools Pro'],
  ['Fast setup for a major championship pool', 'Golf Pools Pro'],
]

const faqItems = [
  {
    question: 'Is Golf Pools Pro an Easy Office Pools alternative?',
    answer: 'Yes. Golf Pools Pro is a golf-focused alternative for pool runners who want online picks, a live tournament leaderboard, golf-specific rules, and a cleaner player experience.',
  },
  {
    question: 'What is the best site for an office golf pool?',
    answer: 'If the pool is only for golf, Golf Pools Pro is our pick because it is built around golf pool setup, player picks, live PGA scoring, cut rules, and a board people can check all week.',
  },
  {
    question: 'Should I still look at RunYourPool or OfficeFootballPool?',
    answer: 'Yes, especially if your group already runs several sports pools on one platform. If you only need a golf pool, compare how quickly players can join, make picks, and follow the live board.',
  },
  {
    question: 'Do players need to pay to join Golf Pools Pro?',
    answer: 'No. Players join with a link or passcode. The host handles the Golf Pools Pro software fee after picks lock.',
  },
]

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Best golf pool sites',
  itemListElement: rankedSites
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map(site => ({
      '@type': 'ListItem',
      position: site.rank,
      name: site.name,
      description: site.verdict,
    })),
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

function RankCard({ site }: { site: RankedSite }) {
  const isWinner = site.rank === 1

  return (
    <article className={`border-2 ${isWinner ? 'border-[#123c2f] bg-[#0f2f25] text-white shadow-[9px_9px_0_#b58a3a]' : 'border-[#123c2f] bg-[#fffdf8] text-[#1f2a24] shadow-[7px_7px_0_#d8cab0]'}`}>
      <div className={`border-b-2 px-5 py-4 ${isWinner ? 'border-[#f3df9c]' : 'border-[#123c2f]'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.2em] ${isWinner ? 'text-[#f3df9c]' : 'text-[#8a6724]'}`}>#{site.rank}</p>
            <h2 className="mt-1 break-words font-display text-3xl font-black leading-none tracking-[-0.03em] sm:text-4xl">{site.name}</h2>
          </div>
          <p className={`w-fit border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${isWinner ? 'border-[#f3df9c] text-[#f3df9c]' : 'border-[#b58a3a] text-[#8a6724]'}`}>{site.tag}</p>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
        <div className={`border-b-2 p-5 md:border-b-0 md:border-r-2 ${isWinner ? 'border-[#f3df9c]' : 'border-[#123c2f]'}`}>
          <p className={`text-xs font-black uppercase tracking-[0.16em] ${isWinner ? 'text-[#f3df9c]' : 'text-[#8a6724]'}`}>Best for</p>
          <p className={`mt-3 text-lg font-bold leading-7 ${isWinner ? 'text-white' : 'text-[#26362d]'}`}>{site.bestFor}</p>
        </div>
        <div className="space-y-4 p-5 leading-7">
          <p className={isWinner ? 'text-[#f8efd9]' : 'text-[#4f5b52]'}>{site.good}</p>
          <p className={isWinner ? 'text-[#f8efd9]' : 'text-[#4f5b52]'}>{site.tradeoff}</p>
          <p className={`border-t pt-4 font-black ${isWinner ? 'border-[#f3df9c] text-white' : 'border-[#d8cab0] text-[#0f2f25]'}`}>{site.verdict}</p>
          {isWinner && (
            <div className="pt-2">
              <Link href="/signup" className="inline-block border-2 border-[#f3df9c] bg-[#f3df9c] px-5 py-3 text-sm font-black uppercase tracking-[0.1em] text-[#0f2f25] transition-colors hover:bg-white">
                Create a pool
              </Link>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default function BestGolfPoolSitesPage() {
  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <header className="border-b border-[#d8cab0] bg-[#fbf7ed] px-5 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link href="/" className="font-display text-xl font-black text-[#0f2f25]">Golf Pools Pro</Link>
          <div className="flex items-center gap-2 text-sm font-bold">
            <Link href="/easy-office-pools-alternative" className="hidden border border-[#123c2f] bg-[#fffdf8] px-4 py-2 text-[#123c2f] sm:inline-block">Easy Office Pools alternative</Link>
            <Link href="/signup" className="border border-[#123c2f] bg-[#123c2f] px-4 py-2 text-white">Create pool</Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12 md:py-16">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="w-fit border-y border-[#b58a3a] py-2 text-xs font-black uppercase tracking-[0.22em] text-[#8a6724]">Golf pool sites compared</p>
            <h1 className="mt-5 max-w-4xl font-display text-4xl font-black leading-[0.98] tracking-[-0.04em] text-[#0f2f25] md:text-6xl">
              The best golf pool sites, ranked from #5 to #1.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[#4f5b52]">
              If you are comparing Easy Office Pools, RunYourPool, OfficeFootballPool, Fantrax, and newer golf-first options, this is the practical version. Start at #5. The #1 pick is at the bottom where it belongs.
            </p>
          </div>

          <aside className="border-2 border-[#123c2f] bg-[#fffdf8] p-5 shadow-[7px_7px_0_#d8cab0]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6724]">How we ranked them</p>
            <ul className="mt-4 space-y-3 text-sm font-semibold leading-6 text-[#4f5b52]">
              <li>Can a pool runner set up a major week pool quickly?</li>
              <li>Can players make picks without getting lost?</li>
              <li>Does the live board make people want to check back?</li>
              <li>Does it feel built for golf, not generic office admin?</li>
            </ul>
          </aside>
        </section>

        <section className="mt-12 border-2 border-[#123c2f] bg-[#f7f0df] shadow-[7px_7px_0_#d8cab0]">
          <div className="border-b-2 border-[#123c2f] bg-[#123c2f] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-[#f3df9c]">
            Quick comparison
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left text-[13px] sm:text-sm">
              <thead>
                <tr className="bg-[#fffdf8] text-[10px] font-black uppercase tracking-[0.12em] text-[#0f2f25] sm:text-xs sm:tracking-[0.14em]">
                  <th className="w-[48%] border-b-2 border-r-2 border-[#123c2f] px-3 py-3 sm:px-4">Need</th>
                  <th className="border-b-2 border-[#123c2f] px-3 py-3 sm:px-4">Sites to compare first</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(row => (
                  <tr key={row[0]} className="bg-[#fffdf8] even:bg-[#fbf7ed]">
                    <td className="border-b border-r-2 border-[#d8cab0] px-3 py-3 align-top font-black leading-5 text-[#0f2f25] sm:px-4">{row[0]}</td>
                    <td className="border-b border-[#d8cab0] px-3 py-3 align-top font-semibold leading-5 text-[#4f5b52] sm:px-4">{row[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 space-y-8">
          {rankedSites.map(site => <RankCard key={site.name} site={site} />)}
        </section>

        <section className="mt-14 grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          <div className="border-2 border-[#123c2f] bg-[#fffdf8] p-6 shadow-[7px_7px_0_#d8cab0]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6724]">The short answer</p>
            <h2 className="mt-3 font-display text-3xl font-black leading-tight text-[#0f2f25]">If you searched Easy Office Pools for golf, try Golf Pools Pro first.</h2>
            <p className="mt-4 leading-7 text-[#4f5b52]">
              Easy Office Pools, RunYourPool, OfficeFootballPool, and Fantrax are all names a pool runner might compare. Golf Pools Pro is the one built around golf pool week: picks before lock, live scoring after the first tee, cut drama on Friday, and a board that makes Sunday fun to follow.
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map(item => (
              <section key={item.question} className="border-2 border-[#123c2f] bg-[#fbf7ed] p-5 shadow-[6px_6px_0_#d8cab0]">
                <h2 className="font-display text-2xl font-black leading-tight text-[#0f2f25]">{item.question}</h2>
                <p className="mt-3 leading-7 text-[#4f5b52]">{item.answer}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-14 border-2 border-[#123c2f] bg-[#0f2f25] p-6 text-white shadow-[8px_8px_0_#d8cab0] md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f3df9c]">Ready for the next major</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-black leading-tight md:text-5xl">Create the pool, send the link, and give everyone one board to watch.</h2>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="border-2 border-[#f3df9c] bg-[#f3df9c] px-6 py-3 text-center font-black uppercase tracking-[0.1em] text-[#0f2f25]">Create a pool</Link>
            <Link href="/golf-pool-software" className="border-2 border-[#f3df9c] bg-transparent px-6 py-3 text-center font-black uppercase tracking-[0.1em] text-[#f3df9c]">See features</Link>
          </div>
        </section>
      </main>
    </div>
  )
}
