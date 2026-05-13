# Golf Pools Pro Public Readiness Audit

Date: 2026-05-13
Branch: `master`
Verdict: close to public beta. Core app is deployable and live; payment webhook env and type-check debt remain before I’d call it fully hardened.

## Executive Summary

Core host and entrant flows are coherent at code level: signup/login, pool creation, invite-code joining, pick saving, pre-lock pick privacy, lock/start visibility, OB stand-ins, leaderboard gating, final host-paid fee timing, metadata, PWA assets, and SEO routes are present.

I fixed four launch-risk gaps:

- public cron write protection
- Square webhook invalid-signature handling
- overly broad service-worker caching
- auth redirect preservation for direct pool/signup invite flows

## Critical Fixes Applied

- `/api/cron/sync-tournaments` now requires `CRON_SECRET` when configured, matching the archive cron guard.
- Square webhook signature validation now returns `401` for malformed/invalid signatures instead of risking a `timingSafeEqual` length-mismatch server error.
- `public/sw.js` no longer caches API routes or authenticated/dynamic navigations.
- Unauthenticated `/pool/[id]` visits redirect to login with the intended pool URL preserved.
- Signup email-confirmation flow preserves safe same-origin redirect targets.

## Changed Files

- `public/sw.js`
- `src/app/(app)/pool/[id]/page.tsx`
- `src/app/(auth)/signup/page.tsx`
- `src/app/api/cron/sync-tournaments/route.ts`
- `src/app/api/payments/square/webhook/route.ts`

## Verification Passed

Local:

- `node scripts/verify-scoring-rules.mjs`
- `npx tsx scripts/verify-scoring-behavior.mts`
- `npm run lint`
- `npm run build`

Production deploy:

- Vercel production deploy succeeded.
- `https://www.golfpoolspro.com` is aliased live.

Live safe probes:

- `/` -> `200`
- `/login` -> `200`
- `/signup` -> `200`
- `/privacy` -> `200`
- `/terms` -> `200`
- `/robots.txt` -> `200`
- `/sitemap.xml` -> `200`
- `/manifest.webmanifest` -> `200`
- `/sw.js` -> `200`
- `/api/tournaments` -> `200` with tournament data
- `/api/tournaments/leaderboard` without id -> `400` expected
- `/api/cron/sync-tournaments?live=1` without secret -> `401` expected
- `/api/cron/archive-unpaid-pools` without secret -> `401` expected
- `/api/payments/square/quote` unauthenticated -> `401` expected
- `/api/payments/square/create-payment` unauthenticated -> `401` expected
- `/api/payments/square/webhook` with bad signature -> `401` expected

## Remaining Findings Before Broad Public Push

High:

- Production Vercel env list does not show `SQUARE_WEBHOOK_SIGNATURE_KEY`. Without it, Square webhook callbacks will always reject. Direct checkout can still work, but async webhook reconciliation will not.
- Real Square sandbox checkout has not been completed end-to-end in this run.

Medium:

- `next.config.ts` has `typescript.ignoreBuildErrors: true`; `npm exec -- tsc --noEmit` currently fails on existing Supabase type-generation debt and one verification-script import issue. Build/lint pass, but type errors are being suppressed.
- Next 16 warns that `middleware` is deprecated in favor of `proxy`.
- Repo appears to have recent Supabase migrations, not a full baseline schema migration for a fresh environment.

Low:

- KeePass unlock was attempted first for Square webhook credential lookup, but local GPG unlock failed in this shell. No secret values were printed.

## Recommendation

Safe to send to a small beta group after adding/confirming `SQUARE_WEBHOOK_SIGNATURE_KEY` in Vercel and doing one Square sandbox/production test payment. I would not blast broadly until type-check debt and the Square webhook env are cleaned up.
