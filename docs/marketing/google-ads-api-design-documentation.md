# Golf Pools Pro Google Ads API design documentation

## 1. Company overview

Golf Pools Pro is a web app for running recreational golf pools for PGA tournaments. Pool hosts can create a pool, invite entrants, track standings, and share leaderboards and final results.

The product is used by pool hosts who want a simple way to run golf pools for friends, offices, clubs, and recurring weekly groups.

## 2. Business model

Golf Pools Pro uses a software pricing model based on pool size.

- Small pools can start free.
- Larger pools pay based on the number of active entries.
- Pricing is capped so pool hosts know the maximum cost before launching a pool.

Golf Pools Pro does not operate wagering, betting, sportsbook, casino, or real-money gambling services.

## 3. How we use Google Ads

We use Google Ads to promote Golf Pools Pro to people searching for golf pool software and tournament-specific pool tools.

Example campaigns include Google Search campaigns for PGA tournaments such as the CJ Cup Byron Nelson or the Memorial Tournament. Ads send users to tournament-specific landing pages where they can learn about the product, create an account, and start a pool.

Example landing page:

https://www.golfpoolspro.com/cj-cup-byron-nelson-pool

## 4. Purpose of Google Ads API access

We need Google Ads API access to manage our own Google Ads account more reliably than using the web interface manually.

The API will be used for internal campaign management and reporting only. We are not building a public ads management platform, and we are not managing third-party advertiser accounts.

## 5. Google Ads API features used

The internal tool will use the Google Ads API to:

- Create Google Search campaigns.
- Create campaign budgets.
- Create ad groups.
- Add exact and phrase match keywords.
- Add negative keywords.
- Create responsive search ads.
- Set final landing page URLs with UTM tracking.
- Pause and enable campaigns.
- Read campaign, ad group, keyword, and ad performance reports.
- Review spend, clicks, impressions, click-through rate, conversions, and search terms.

## 6. Campaign creation flow

The tool follows this process:

1. Choose a PGA tournament or product landing page.
2. Generate a small, focused Search campaign plan.
3. Set a daily budget based on the approved weekly spend.
4. Create a paused campaign in Google Ads.
5. Add ad groups, keywords, negative keywords, and responsive search ads.
6. Verify the campaign settings before activation.
7. Enable the campaign only after settings are reviewed.
8. Monitor search terms and performance.
9. Pause poor matches and add negatives when needed.

Campaigns are created as paused first to avoid accidental spend before review.

## 7. Example campaign settings

For the first campaign, Golf Pools Pro plans to run a small Google Search campaign for the CJ Cup Byron Nelson.

- Campaign type: Search
- Budget: about $20 per week
- Daily budget: about $2.86 per day
- Landing URL: https://www.golfpoolspro.com/cj-cup-byron-nelson-pool?utm_source=google&utm_medium=cpc&utm_campaign=cj_cup_search
- Match types: Exact and phrase match only
- Networks: Google Search only
- Display Network: off
- Search Partners: off for the initial test

## 8. Keyword strategy

The tool uses high-intent keywords related to golf pools and PGA tournament pools.

Example keywords:

- cj cup golf pool
- cj cup byron nelson pool
- byron nelson golf pool
- pga golf pool app
- golf office pool
- golf tournament pool app
- create a golf pool
- run a golf pool

The first campaigns avoid broad match so spend stays controlled.

## 9. Negative keyword strategy

The tool applies negative keywords to avoid irrelevant or sensitive traffic.

Examples include:

- betting
- sportsbook
- casino
- gambling
- odds
- wager
- parlay
- draftkings
- fanduel
- swimming pool
- pool service
- pool cleaning
- pool builder
- tickets
- schedule
- tee times
- leaderboard
- spreadsheet
- template
- free

## 10. Ad copy rules

Ad copy focuses on recreational golf pool software, easy setup, group invites, and shareable standings.

The tool avoids language about betting, odds, wagers, gambling, payouts, sportsbooks, casinos, or real-money contests.

Example headlines:

- CJ Cup Golf Pool
- Byron Nelson Golf Pool
- Run A CJ Cup Pool
- Create A PGA Pool
- Fun PGA Golf Pools
- Shareable Leaderboards
- Set Up In Minutes

Example descriptions:

- Create a fun CJ Cup pool with shareable leaderboards. CJ Cup promo available.
- Set up your PGA golf pool in minutes. Invite friends and track standings all weekend.
- Simple golf pools for the CJ Cup Byron Nelson. Built for groups and offices.

## 11. Reporting and optimization

The tool will pull reporting data from Google Ads to review:

- Impressions
- Clicks
- Cost
- Click-through rate
- Average CPC
- Conversions or landing page actions where available
- Search terms
- Campaign and keyword performance

This data is used to pause poor-performing keywords, add negative keywords, and improve future tournament campaigns.

## 12. Data handling and security

Google Ads API credentials are stored locally and are not exposed in the website frontend.

The tool does not collect or store Google user passwords. OAuth is used for access. API credentials and refresh tokens are stored outside the public application repository.

Only authorized internal operators can run the tool.

## 13. Access level requested

We are requesting Basic Access because we need to create and manage campaigns for our own Google Ads account.

We do not need Standard Access at this time.

## 14. Summary

Golf Pools Pro needs Google Ads API access for internal campaign automation and reporting. The tool will create small, controlled Google Search campaigns for our own business, starting with tournament-specific landing pages. Campaigns are created paused first, reviewed, then enabled only after verification.
