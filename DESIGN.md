---
version: alpha
name: Golf Pool Pro
description: Premium golf pool software with country-club scorecard clarity and fantasy-sports utility. The product should feel like a tournament clubhouse board, not generic SaaS.
colors:
  primary: "#123c2f"
  ink: "#1f2a24"
  muted: "#657168"
  paper: "#fbf7ed"
  surface: "#ffffff"
  clubhouse: "#123c2f"
  fairway: "#1f6b4a"
  pine: "#0f2f25"
  gold: "#b58a3a"
  sand: "#e7dbc3"
  border: "#d8cab0"
  danger: "#b93a32"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: "1.05"
    letterSpacing: "-0.03em"
  h1:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: "1.1"
  h2:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.2"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.55"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: "1"
    letterSpacing: "0.12em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "14px"
  xl: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  xxl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.clubhouse}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 18px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 18px"
  scorecard-board:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

## Overview

Golf Pool Pro is not a crypto dashboard, generic SaaS admin panel, or startup landing page. It should feel like a polished golf clubhouse tool: Masters scorecard paper, tournament leaderboard boards, restrained country-club materials, and fast fantasy-sports decision making.

The UI must prioritize speed: pool runners and players should understand standings, rules, picks, and next action within seconds.

## Colors

- **Paper (#fbf7ed):** primary background for scorecards, leaderboards, and tournament surfaces.
- **Clubhouse (#123c2f):** primary action/nav color. Deep green, not neon.
- **Fairway (#1f6b4a):** positive/under-par scoring and secondary accents.
- **Gold (#b58a3a):** restrained premium accent for dividers, badges, and selected state. Do not overuse.
- **Ink (#1f2a24):** body/headline color.
- **Danger (#b93a32):** over-par numbers and destructive actions.

Avoid purple, blue startup gradients, glass panels, neon glows, and gray-on-gray SaaS sludge.

## Typography

Use serif display/headings sparingly for clubhouse/tournament character. Use sans body for forms, tables, and dense dashboard content. Numeric golf scores must be tabular where possible.

## Layout

Home page:
- Lead with product value and a concrete visual of a pool/leaderboard.
- Avoid fake decorative stat cards unless they teach the product.
- Use fewer, stronger sections: hero, how it works, live board/scoring, setup flow, CTA.

Dashboard:
- Prioritize “what do I do now?” and active pools.
- Use compact rows/lists for pool status, not giant equal-weight cards everywhere.
- Make tournament status, lock state, and join/share actions scannable.

Leaderboard/scoring:
- Use scorecard/clubhouse-board grammar: ruled lines, compact columns, par/score language, red/green score states.
- Horizontal scroll is acceptable for score grids; preserve sticky identity columns when useful.

## Components

Cards should feel like scorecard paper or clubhouse panels, not generic floating SaaS cards.

Buttons:
- Primary: deep green filled.
- Secondary: paper/white with ink border.
- Destructive: red, plain, never playful.

Tables/lists:
- Prefer ruled scorecard rows and clear numeric alignment.
- Use strong first column identity and restrained badges.

Forms:
- Compact, high-contrast, clear labels.
- No money/wagering/buy-in/payout fields or copy.

## Do's and Don'ts

Do:
- Use golf scorecard references, leaderboard boards, tournament print materials, and clubhouse signage.
- Use real product states and realistic golf/pool data.
- Capture desktop and mobile screenshots after UI changes.
- Update DESIGN_DECISIONS.md when Michael accepts or rejects a design direction.

Don't:
- Do not raw-code visual UI without first reading this file and DESIGN_DECISIONS.md.
- Do not use purple/blue gradients, glassmorphism, nested shadcn card stacks, emoji icons, generic bento grids, or Inter-only startup sameness.
- Do not invent money/payout/cash/buy-in UI.
- Do not claim “premium” with oversized rounded rectangles and shadows. Use hierarchy, type, density, and real golf visual language.
