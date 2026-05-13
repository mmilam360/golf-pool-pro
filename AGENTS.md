<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
