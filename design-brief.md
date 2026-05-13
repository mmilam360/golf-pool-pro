# UI Design Brief

Page/screen: home page, app shell, dashboard.
User goal: understand Golf Pools Pro quickly, create/join a pool, and return to active pools without hunting.
Primary action: create a pool. Secondary action: join/sign in.
Information hierarchy: product promise -> live scorecard preview -> three-step setup -> active pool rows / next action.
Visual direction: premium golf clubhouse + major tournament scorecard. Cream paper, deep green, restrained gold, ruled rows, tabular score columns.
References used: user scoreboard images, `DESIGN.md`, `DESIGN_DECISIONS.md`, UI/UX Pro Max research, ui-ux-pro MCP output, 21st Magic MCP attempt.
What to borrow: tournament board typography, ruled scorecard grids, compact standings rows, clubhouse signage labels.
What to avoid: generic SaaS bento grids, purple gradients, glass panels, random stat cards, emojis, money/wagering language.
Responsive requirements: desktop split hero; mobile stack with scorecard first or immediately below headline; dashboard rows stay compact and tappable.
Accessibility requirements: high contrast text, 44px touch targets, visible focus/hover states, semantic links/buttons.

# Component Map

- Home navigation: custom lightweight clubhouse bar using existing logo and design tokens.
- Hero: custom scorecard/product split from `DESIGN.md`, because 21st Magic timed out and ui-ux-pro MCP suggested off-brand purple palette that was rejected by local design rules.
- Product preview: custom tournament board component with ruled rows and score columns; based on user scoreboard references.
- How it works: compact process rail, not generic icon cards.
- Final CTA: simple clubhouse panel using approved tokens.
- App shell navigation: existing layout refined with scorecard paper background and compact nav.
- Dashboard header: clubhouse starter desk panel with create/join actions.
- Owned/joined pools: compact scorecard rows instead of equal-weight cards.
- Empty states: scorecard-paper panels with direct create/join action.

# MCP/tool evidence

- `HOME=/home/mm codex mcp list` confirmed `magic-mcp`, `stitch-mcp`, `ui-ux-pro` are enabled.
- `ui-ux-pro` MCP was called via mcporter for Golf Pools Pro design system; output was reviewed but rejected where it conflicted with `DESIGN.md`.
- `magic-mcp` was called twice via mcporter for 21st.dev component generation; both timed out, so implementation used local design docs and user references instead of pretending Magic succeeded.
