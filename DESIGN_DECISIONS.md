# Golf Pools Pro Design Decisions

This file is the taste ledger. Read it before any UI work and update it after Michael accepts/rejects a direction.

## Accepted

- Direction: premium country-club / major-tournament scorecard / clubhouse board.
- Light visual system: cream paper, white cards, deep greens, restrained gold, ink text.
- Scoreboard inspiration: old-school golf leaderboard with ruled rows, compact columns, red/green score treatment, and fast standings readability.
- Accepted product pattern: carry the physical leaderboard language into primary app moments — dashboard counts, pool cards, create/join flow, activation/payment, auth, legal, and empty states. Use square/boxy components, hard borders, flat buttons, and offset rectangular shadows. Avoid mixed rounded cards/buttons around the board, and avoid angled/wedge 3D faces that create odd corner artifacts on mobile. Keep 3D extrusion for the leaderboard/board object only, not normal buttons or tight forms.
- App header direction: keep every logged-in nav item in the same slim text-link family. Do not make `Create Pool` a special filled header button; Michael said it looks weird in line. Show the current page with a small square/border state instead. Pick Guides is optional content, not core app operation; keep it after Dashboard/Manage/Account and style it smaller/muted with an Optional label.
- Leverage marker legend direction: keep the hare/tortoise key compact and centered under the scoreboard, not full-width like another board row. No black border; use a lighter cream/gold treatment so it stands apart from the main score columns.
- Typography direction: move away from serif display headings for the angular 90s 3D board style. Use heavy condensed/blocky sans display type, uppercase labels, and scoreboard-style spacing.
- 3D depth correction: use old-school extruded-box construction with a front face plus skewed parallelogram right/bottom depth faces so the corners read diagonal. Avoid fragile `clip-path` notches/wedges and negative-z oddities on the main board faces because they create disconnected artifacts on mobile. On live pool/dashboard/homepage board posts, do not use a transformed or clipped side face that extends above/below the post — it creates top/bottom gaps/shards. Use a flush rectangular side face constrained inside the post height and a solid green post face with no inset highlight/border. On story/final-result exports, the screenshot export keeps the accepted mounted-through-board look with the post continuing off the bottom of the image.
- Pool money is private. Product UI must not include wagering, buy-in, payout, purse, cash, paid/unpaid, or pot language.
- Logo direction: simplified vintage golf pennant/flag system. Full version should read “Golf Pools Pro”; compact favicon/small-logo version should read “GPP” per Michael’s correction. Use bold angular block lettering, deep green/cream/gold, and simple pennant geometry. Avoid clipart-style balls, clubs, trophies, mascots, shields, crests, and busy detail.
- Landing final-score story preview: use a muted green story-style template with simple top/bottom social chrome, a relatable person-style poster name, and the GPP final board inset in the middle. When using the actual device treatment, place the story inside the official iPhone 17 Pro frame asset and adapt the story to the tall iPhone screen cutout rather than forcing a 9:16 rectangle.

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
