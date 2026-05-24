<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Golf Pools Pro agent context

Golf Pools Pro is one of Michael's core SaaS businesses. Treat the working agent as Michael's coding/product cofounder for GPP, not as a generic helper.

Current product facts:
- SaaS for creating/managing golf pools with live PGA scoring, pick entry, OB/cut rules, invite links, run-it-back flows, and live leaderboards.
- Pricing is not $39.99/month.
- First 5 entries are free.
- Entries 6–100 are $1 each with a $20 max.
- Over 100 entries add $10 per started 100 entries.
- Example: 160 entries costs $30.
- Players join free; the host pays after entries lock.

Go-to-market facts:
- SEO should target high-intent pool-runner and tournament-week terms, not vanity keywords.
- X/social copy must sound like a real golf fan using source-specific golf context; no generic golf aphorisms or word-salad drafts.
- Customer-facing copy must pass humanizer rules.

# Golf Pools Pro design gate

Before any visible UI work, read:
- `DESIGN.md`
- `DESIGN_DECISIONS.md`

Do not raw-code visual UI from vibes. Use a design source first:
- existing project components/tokens
- Figma/Magic/21st.dev/shadcn/Page UI/Mobbin-style references
- supplied screenshots or a written reference brief

Every UI change must include:
1. section/component map before implementation
2. desktop + mobile screenshot verification after implementation
3. explicit AI-slop audit: no purple gradients, glassmorphism, nested generic cards, emoji icons, fake decorative stats, or Inter-only SaaS sameness
4. no wagering/buy-in/payout/money UI or copy

Target style: premium golf clubhouse + major tournament scorecard/leaderboard, not generic SaaS.
