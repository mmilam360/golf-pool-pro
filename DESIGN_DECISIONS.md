# Golf Pool Pro Design Decisions

This file is the taste ledger. Read it before any UI work and update it after Michael accepts/rejects a direction.

## Accepted

- Direction: premium country-club / major-tournament scorecard / clubhouse board.
- Light visual system: cream paper, white cards, deep greens, restrained gold, ink text.
- Scoreboard inspiration: old-school golf leaderboard with ruled rows, compact columns, red/green score treatment, and fast standings readability.
- Pool money is private. Product UI must not include wagering, buy-in, payout, purse, cash, paid/unpaid, or pot language.
- Logo direction: wordmark-first. The words “Golf Pool Pro” should be the main mark, with subtle type/scoreboard character only.

## Rejected

- Generic SaaS dashboards with equal-weight cards everywhere.
- Vibe-coded AI visual tells: purple/blue gradients, glassmorphism, nested cards, random rounded stat blocks, generic bento grids, fake decorative metrics.
- Dark startup dashboard aesthetic for core Golf Pool Pro pages.
- UI coded from scratch before a design source/reference/component map exists.
- Clipart-heavy logos with golf balls, clubs, trophies, mascots, seals, or decorative icons competing with the words.
- Tacky landing-page copy that sounds like SaaS marketing. Favor plain golf-pool language: create the pool, send the code, enter picks, check standings.
- Handwritten/cursive auth headings. They look cheap here; use the wordmark plus sober scorecard-style labels instead.

## Required design workflow

1. Read `DESIGN.md` and this file.
2. Gather references before coding: golf scorecards/leaderboards, fantasy sports standings, premium sports dashboards, or approved screenshots.
3. Create a section/component map before implementation.
4. Use existing components/tokens first; use shadcn/21st.dev/Magic/Page UI/Figma sources when available.
5. Capture desktop and mobile screenshots after changes.
6. Critique screenshots for specificity, hierarchy, spacing, contrast, responsiveness, and AI-slop tells.
7. Patch until the screenshot passes, then report evidence.
