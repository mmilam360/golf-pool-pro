# GPT-5.5 Audit Report

## Fixed issues

- Pool creation now rejects `count_scores > pick_count` before insert.
- Pool creators are now added as the first entry after pool creation.
- If creator entry insert fails, the newly-created pool is deleted to avoid an orphaned pool.
- Login now honors safe same-origin `redirect` paths and rejects external/backslash redirects.
- Signup now handles both Supabase autoconfirm and email-confirmation flows correctly.
- Logout redirect now uses `NEXT_PUBLIC_SITE_URL` when configured, falling back to the request origin.
- Email API now requires an authenticated owner, validates the pool owner, dedupes/normalizes recipients, escapes HTML, hides provider/internal errors, and fails if email logging fails.
- Scoring ranks now keep incomplete/null-score entries unranked instead of assigning last-place numeric ranks.

## Remaining issues

### P0

- None found in this pass.

### P1

- Email sending still accepts owner-supplied recipient lists. Safer next step: derive recipients server-side from pool entries or validate every submitted recipient against pool membership.
- Pool creation plus creator-entry insert should eventually move into a Supabase RPC transaction. The client-side rollback is safer than before but not truly atomic.
- `npx tsc --noEmit` still fails on existing Supabase `never` typing issues across the app. Build passes because `next.config.ts` skips type validation.

### P2

- Next.js warns that `middleware.ts` is deprecated and should migrate to `proxy.ts`.
- Email API has no rate limiting yet.
- No automated tests exist for create-pool, email, login redirect, or scoring edge cases.

## Verification performed

- Inspected full uncommitted git diff.
- Static added-line scan: no hardcoded secrets, shell injection, eval/exec, pickle, or SQL string-format patterns found.
- Independent reviewer pass found redirect/email/pool consistency issues; small safe items were fixed.
- `npm run lint` passed.
- `npm run build` passed.
- `npx tsc --noEmit` was run and failed on known Supabase `never` typing noise plus touched files using the same pattern.

## Deployment / commit status

- Not deployed.
- Not committed.
- Working tree still has uncommitted code changes plus this report and the design plan.
