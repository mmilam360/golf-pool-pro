type FirstPoolValueSectionProps = {
  offerCapDollars: 5 | 9
}

const EXAMPLE_ENTRY_COUNTS = [12, 18, 30]
const FLAT_FEE_SITE_CENTS = 2000

function getGppPriceCents(entryCount: number) {
  const paidEntries = Math.max(0, entryCount - 5)
  return Math.min(paidEntries * 100, 2000)
}

function formatMoney(cents: number) {
  const dollars = cents / 100
  return Number.isInteger(dollars) ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`
}

function getOfferPriceCents(entryCount: number, offerCapCents: number) {
  const gppPriceCents = getGppPriceCents(entryCount)
  return Math.min(gppPriceCents, offerCapCents)
}

function getOfferRows(offerCapCents: number) {
  return EXAMPLE_ENTRY_COUNTS.map(entryCount => {
    const gppPriceCents = getGppPriceCents(entryCount)
    const offerPriceCents = getOfferPriceCents(entryCount, offerCapCents)
    return {
      entryCount,
      flatFeePrice: formatMoney(FLAT_FEE_SITE_CENTS),
      gppPrice: formatMoney(gppPriceCents),
      offerPrice: formatMoney(offerPriceCents),
      offerSavings: gppPriceCents - offerPriceCents,
      flatFeeSavings: FLAT_FEE_SITE_CENTS - offerPriceCents,
    }
  })
}

export function FirstPoolValueSection({ offerCapDollars }: FirstPoolValueSectionProps) {
  const offerCapCents = offerCapDollars * 100
  const offerRows = getOfferRows(offerCapCents)

  return (
    <section data-campaign-section="compare" className="border-y-2 border-[#123c2f] bg-[#f7f0df] py-10 md:py-14">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-[1.05fr_0.95fr] md:px-8">
        <div className="flex flex-col justify-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6724]">Why switch</p>
          <h2 className="mt-2 font-display text-4xl leading-none text-[#123c2f] sm:text-5xl">
            Better math for smaller pools.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-stone-700">
            GPP already fits smaller pools: first 5 entries free, then $1 per extra entry, capped at $20 through 100. This offer is a cap too, so the discount is already in the price below.
          </p>

          <div className="mt-6 border-2 border-[#123c2f] bg-white shadow-[5px_5px_0_#d8cab0]">
            <div className="border-b-2 border-[#123c2f] bg-[#fbf7ed] px-4 py-3 sm:px-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">First-pool price board</p>
              <h3 className="mt-1 font-display text-2xl leading-none text-[#123c2f] sm:text-3xl">
                Never more than {formatMoney(offerCapCents)} for the first one.
              </h3>
            </div>

            <div className="grid grid-cols-[0.8fr_0.9fr_0.9fr_1fr] border-b-2 border-[#123c2f] bg-[#123c2f] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white sm:px-5">
              <span>Pool</span>
              <span>Flat fee</span>
              <span>GPP</span>
              <span>With offer</span>
            </div>

            <div className="divide-y-2 divide-[#d8cab0]">
              {offerRows.map(row => (
                <div key={row.entryCount} className="grid grid-cols-[0.8fr_0.9fr_0.9fr_1fr] items-center gap-2 px-3 py-3 text-sm font-bold text-[#1f2a24] sm:px-5 sm:text-base">
                  <div>
                    <p>{row.entryCount} players</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-stone-500">Players join free</p>
                  </div>
                  <div className="text-stone-500">{row.flatFeePrice}</div>
                  <div>{row.gppPrice}</div>
                  <div>
                    <p className="font-display text-2xl leading-none text-[#b21e23] sm:text-3xl">{row.offerPrice}</p>
                    <p className="mt-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#8a6724]">
                      {row.offerSavings > 0 ? `${formatMoney(row.offerSavings)} off GPP` : 'Under the cap'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t-2 border-dashed border-[#d8cab0] bg-[#fbf7ed] px-4 py-3 text-sm font-semibold leading-6 text-stone-700 sm:px-5">
              For 18 players, your first pool is {offerRows.find(row => row.entryCount === 18)?.offerPrice}, not {offerRows.find(row => row.entryCount === 18)?.gppPrice}. Compared with a flat $20 pool site, that keeps {formatMoney(offerRows.find(row => row.entryCount === 18)?.flatFeeSavings || 0)} in your pocket.
            </div>
          </div>
        </div>

        <div className="border-2 border-[#123c2f] bg-[#123c2f] p-4 text-white shadow-[7px_7px_0_#d8cab0] sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d8b45d]">More fun than office-pool software</p>
          <h3 className="mt-2 font-display text-4xl leading-none text-white sm:text-5xl">
            Give the group something to check.
          </h3>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#efe7d6]">
            Old pool tools feel like admin work. GPP feels like a tournament board for your crew: picks on phones, live standings, and a clear view of which golfers can move an entry up or wreck the card.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ['Phone-first picks', 'Players make picks on their phones. You are not chasing names in the group text.'],
              ['Live rooting interests', 'The board makes it obvious who each entry needs to pass or fade.'],
              ['Cleaner pool week', 'Rules, locks, cuts, and scoring stay in the pool instead of the group text.'],
              ['Looks like golf', 'Cream paper, hard borders, red numbers, and a board people recognize.'],
            ].map(([title, body]) => (
              <div key={title} className="border-2 border-[#d8b45d] bg-[#fbf7ed] p-3 text-[#1f2a24]">
                <h4 className="font-display text-xl leading-none text-[#123c2f]">{title}</h4>
                <p className="mt-2 text-xs font-semibold leading-5 text-stone-700">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 border-2 border-[#d8b45d] bg-[#fbf7ed] p-3 text-[#1f2a24]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">Tournament-week rhythm</p>
            <div className="mt-3 space-y-2">
              {[
                ['Thu', 'Picks are in. Everyone has a board to watch.'],
                ['Fri', 'The cut line starts hurting feelings.'],
                ['Sun', 'The leaderboard shows who needs one more birdie.'],
              ].map(([day, body]) => (
                <div key={day} className="grid grid-cols-[44px_1fr] items-center border-2 border-[#123c2f] bg-white text-sm font-bold">
                  <div className="border-r-2 border-[#123c2f] px-2 py-2 text-center font-display text-[#b21e23]">{day}</div>
                  <div className="px-3 py-2 text-stone-700">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
