# GPT-5.5 Design Renovation Plan

No visual redesign was done in this pass because MCP design tools were not used. Next design pass should be a focused renovation, not raw UI vibe-coding.

## Required MCP/design-tool steps

1. Capture current screens with the screenshot workflow:
   - `/`
   - `/signup`
   - `/login`
   - `/dashboard`
   - `/pool/create`
   - `/pool/join`
   - `/pool/[id]` with sample pool data
2. Run UI/UX Pro critique on the captured flows:
   - first-time visitor clarity
   - create-pool friction
   - pool admin confidence
   - mobile layout
   - empty states
3. Use 21st.dev / Magic MCP for component references only after the critique defines the target patterns.
4. Use Stitch MCP for a cohesive page-level direction if the critique calls for major layout changes.
5. Convert approved direction into small component-level tasks and verify with screenshots before/after.

## Exact files/components to change next

- `src/app/page.tsx`
  - Sharpen value prop, primary CTA, and above-the-fold trust cues.
- `src/app/(auth)/login/page.tsx`
  - Keep current password toggle; improve spacing and redirect-state messaging only if design critique supports it.
- `src/app/(auth)/signup/page.tsx`
  - Keep confirm-password behavior; add clearer success/autoconfirm states if needed.
- `src/app/(app)/dashboard/page.tsx`
  - Improve owned/joined pool hierarchy, empty states, and action priority.
- `src/app/(app)/pool/create/page.tsx`
  - Make pick settings easier to understand; add inline validation for scores-to-count vs golfers-to-pick.
- `src/app/(app)/pool/join/page.tsx`
  - Make passcode entry clearer and more mobile-friendly.
- `src/app/(app)/pool/[id]/PoolView.tsx`
  - Improve leaderboard/admin/team tab clarity, especially on mobile.
- `src/app/globals.css`
  - Only add shared tokens/utilities after MCP-approved direction; avoid one-off class sprawl.

## Guardrails

- No emojis in UI.
- No new icon library unless there is a concrete component need.
- Do not ship customer-facing copy until it passes the humanizer check.
- Keep the dark golf-pool SaaS tone, but make the product feel easier and more trustworthy.
