# Golf Pools Pro marketing plan: CJ Cup Byron Nelson → Memorial 2026

> Saved May 18, 2026. Use this as the working docket for the next two weeks.

## Current tournament facts verified

- CJ Cup Byron Nelson: May 21-24, 2026, McKinney, Texas.
- Memorial Tournament: Jun 4-7, 2026, Muirfield Village Golf Club, Dublin, Ohio.

## Updated positioning

Do not lead only with "spreadsheet replacement." That angle works for casual office pools, but serious weekly pool runners may already use an existing platform and will not switch just because spreadsheets are annoying.

Lead with fun, retention, and shareability:

- Golf Pools Pro is the golf pool app that keeps entrants engaged.
- Better live boards, better history, better final-result shares.
- More fun for the people in the pool means more people come back next week.
- Hosts keep their fields full because the pool feels alive, not like admin software.

Working one-liner:

> The most fun way to run a weekly PGA golf pool.

Secondary angles:

- Keep your golf pool field full week after week.
- Give entrants a leaderboard they actually want to check.
- Make your pool feel like a real event, not a stale results page.
- Built for hosts who care about repeat players.

## Near-term strategy

Use the CJ Cup Byron Nelson as a low-risk test bed before Memorial.

The goal is not huge CJ Cup revenue. The goal is to validate whether fast SEO pages, social proof assets, and tournament-specific landing pages can drive impressions, clicks, signups, and pool starts.

## Analytics decision

Yes, analytics access/setup is now important. We need the agent loop to see what is working.

Recommended stack:

1. Google Search Console
   - Required for SEO page indexing and query data.
   - Lets us see impressions for terms like "CJ Cup golf pool" and "Memorial golf pool."

2. GA4
   - Useful for ad platform compatibility and basic campaign tracking.
   - Good for Google Ads conversion imports.

3. PostHog or Plausible
   - Best for product funnel loops.
   - Track create-pool, invite copied, first entrant joined, payment completed.
   - PostHog is better if we want event funnels and agent-readable product telemetry.

Recommended choice:

- Set up Search Console + GA4 for external acquisition.
- Add PostHog for app/product funnel events if not already present.

Do not overbuild dashboards first. Add the conversion events that decide what to do next.

## Events to track

Marketing pages:
- page_view with path and UTM params
- CTA click
- start_create_pool

Create pool flow:
- tournament_selected
- pool_created
- invite_link_copied
- payment_started
- payment_completed

Entrant flow:
- invite_link_opened
- entry_started
- entry_submitted

Retention/fun loop:
- leaderboard_viewed
- history_viewed
- final_share_downloaded
- final_share_opened

Core metrics:
- SEO impressions
- SEO clicks
- visitor → create pool
- create pool → invite copied
- invite copied → first entrant joined
- paid pool conversion
- CAC by channel

## SEO page program

Build reusable tournament page template, then generate pages per PGA tournament.

Start with CJ Cup Byron Nelson pages now:

- `/cj-cup-byron-nelson-golf-pool`
- `/byron-nelson-golf-pool`
- `/pga-golf-pool-app`
- `/weekly-golf-pool-app`
- `/golf-pool-app-for-groups`

Then Memorial pages:

- `/memorial-golf-pool`
- `/memorial-tournament-pool`
- `/muirfield-golf-pool`
- `/ohio-golf-pool`
- `/columbus-golf-pool`

Page structure:

1. Hero
   - Tournament name, dates, course.
   - CTA: Create a pool for this tournament.

2. Positioning
   - "Built for weekly golf pools that need players to come back."
   - Do not over-index on spreadsheet pain.

3. Visual proof
   - iPhone story preview.
   - leaderboard screenshot.
   - final board image.

4. Host benefits
   - live board
   - easy invite link
   - fun final share image
   - entrant history
   - fewer host headaches

5. Entrant benefits
   - easy picks
   - better leaderboard
   - shareable finish
   - feels like a real event

6. Suggested rules
   - keep short and useful.

7. FAQ
   - Can I run a pool for CJ Cup Byron Nelson?
   - Can entrants join from their phone?
   - Can I use custom rules?
   - Is this for weekly pools?
   - Is this better than a spreadsheet?

8. CTA
   - Create your pool.

All copy must pass humanizer before publishing.

## Paid ads test

Do not spend hard until analytics is in place.

Google Ads:
- Start exact/high intent only.
- Test tournament-specific pages first.
- Use conversion = pool_created, not click.

CJ Cup small test:
- $10-$20/day max.
- Purpose: validate search intent and tracking.

Memorial test:
- $20-$40/day if CJ pages show impressions or pool starts.

Google search angles:
- "CJ Cup golf pool"
- "Byron Nelson golf pool"
- "Memorial golf pool"
- "PGA golf pool app"
- "weekly golf pool app"
- "run a PGA golf pool"

Meta/Instagram:
- Focus on fun and shareable visuals.
- Use the iPhone story preview as the main creative.
- Do not look like enterprise SaaS.

Ad hooks:
- "Make your PGA pool more fun to follow."
- "Keep your golf pool players coming back."
- "A weekly golf pool app your entrants will actually check."
- "Better leaderboards. Better final boards. Less host work."

Avoid:
- sounding like gambling
- overpromising winnings
- generic fantasy sports claims

## Community/outreach strategy

Target pool hosts, not just players.

Where to look:
- fantasy golf communities
- PGA pool Facebook groups
- golf league groups
- office pool communities
- Columbus/Dublin golf groups for Memorial
- golf simulators and league organizers

Message angle:

> If you run a weekly PGA pool, I built Golf Pools Pro to make the pool more fun for entrants so people actually come back. Live boards, mobile entry, history, and final share images. I’m looking for a few pool hosts to try it for CJ Cup / Memorial and tell me what would make them switch.

This is better than "ditch your spreadsheet" for existing platform users.

## AI automation loops to build

### Loop 1: tournament page generator

Input:
- tournament name
- dates
- course
- city/state
- slug

Output:
- landing page from template
- SEO title/meta
- FAQ JSON-LD
- sitemap entry
- internal links
- screenshot/preview block

Verification:
- lint/build
- screenshot QA
- live page smoke
- Search Console submit/index check

### Loop 2: daily acquisition brief

Every morning:
- Search Console impressions/clicks by page/query
- GA/PostHog visitors and events
- pool_created by source
- paid conversion by source
- ad spend and CPA if connected
- recommended action for the day

### Loop 3: ad creative generator

Inputs:
- tournament page
- screenshots
- top positioning line

Outputs:
- 3 Meta story creatives
- 3 feed creatives
- 3 Google RSA headline/description sets

Verification:
- no AI-slop copy
- no gambling policy risk
- image sizes valid

### Loop 4: community finder

Find:
- relevant Facebook groups
- Reddit threads
- forums
- local golf leagues
- public course league pages

Output:
- URL
- audience fit
- rules / posting limits
- suggested post
- whether manual approval is needed

### Loop 5: abandoned host follow-up

Trigger:
- create pool started but not completed
- pool created but invite not copied
- pool created but zero entrants after 24h

Output:
- reminder email or in-app prompt
- suggested next action

## Two-week execution order

### Phase 1: analytics + CJ Cup test pages

1. Confirm analytics stack.
2. Add Search Console / GA4 / PostHog if missing.
3. Build tournament SEO page template.
4. Publish CJ Cup Byron Nelson pages.
5. Submit sitemap / request indexing.
6. Track impressions/clicks/pool starts.

### Phase 2: Memorial pages + conversion polish

1. Publish Memorial pages.
2. Add tournament-specific create-pool CTA.
3. Make Memorial preselected or one-click from landing page.
4. Add invite-copy success and referral prompts.
5. Add final-board/share CTA back to GPP.

### Phase 3: small paid tests

1. Launch CJ Cup Google micro-test if analytics works.
2. Launch Memorial Google/Meta once pages are live.
3. Kill anything with bad CPA quickly.
4. Scale only if pool_created and invite_copied events look real.

### Phase 4: host outreach

1. Build pool-host prospect list.
2. Draft direct outreach.
3. Offer white-glove setup for early hosts.
4. Collect objections and use them for product/copy.

## Acceptance criteria for this plan

By Memorial Thursday:
- Memorial landing page live.
- At least 5 SEO pages live.
- Search Console tracking active.
- GA4/PostHog conversion events active.
- At least one paid search campaign tested.
- At least one Meta creative tested.
- At least 25 direct host prospects contacted.
- Daily acquisition brief running or manually generated.

## Immediate next task

Build the analytics foundation first, then publish CJ Cup Byron Nelson page as the first fast SEO test.
