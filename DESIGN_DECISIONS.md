# Golf Pools Pro Design Decisions

This file is the taste ledger. Read it before any UI work and update it after Michael accepts/rejects a direction.

## Accepted

- Direction: premium country-club / major-tournament scorecard / clubhouse board.
- Light visual system: cream paper, white cards, deep greens, restrained gold, ink text.
- Scoreboard inspiration: old-school golf leaderboard with ruled rows, compact columns, red/green score treatment, and fast standings readability.
- Accepted product pattern: carry the physical leaderboard language into primary app moments — dashboard counts, pool cards, create/join flow, activation/payment, auth, legal, and empty states. Use square/boxy components, hard borders, flat buttons, and offset rectangular shadows. Avoid mixed rounded cards/buttons around the board, and avoid angled/wedge 3D faces that create odd corner artifacts on mobile. Keep 3D extrusion for the leaderboard/board object only, not normal buttons or tight forms.
- App header direction: keep every logged-in nav item in the same slim text-link family. Do not make `Create Pool` a special filled header button; Michael said it looks weird in line. Show the current page with a small square/border state instead.
- Typography direction: move away from serif display headings for the angular 90s 3D board style. Use heavy condensed/blocky sans display type, uppercase labels, and scoreboard-style spacing.
- 3D depth correction: use old-school extruded-box construction with a front face plus skewed parallelogram right/bottom depth faces so the corners read diagonal. Avoid fragile `clip-path` notches/wedges and negative-z oddities that create disconnected artifacts on mobile. On the homepage hero, the leaderboard post should run into the next green section with no blank gap below it.
- Pool money is private. Product UI must not include wagering, buy-in, payout, purse, cash, paid/unpaid, or pot language.
- Logo direction: simplified vintage golf pennant/flag system. Full version should read “Golf Pools Pro”; compact favicon/small-logo version should read “GPP” per Michael’s correction. Use bold angular block lettering, deep green/cream/gold, and simple pennant geometry. Avoid clipart-style balls, clubs, trophies, mascots, shields, crests, and busy detail.
- Landing final-score story preview: use a muted green story-style template with simple top/bottom social chrome and the GPP final board inset in the middle. The board should not run edge to edge inside the story frame.

## Rejected

- Generic SaaS dashboards with equal-weight cards everywhere.
- Vibe-coded AI visual tells: purple/blue gradients, glassmorphism, nested cards, random rounded stat blocks, generic bento grids, fake decorative metrics.
- Dark startup dashboard aesthetic for core Golf Pools Pro pages.
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
