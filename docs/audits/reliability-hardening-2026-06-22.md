# GPP reliability hardening audit — 2026-06-22

## Safety posture

This branch is intentionally isolated from the dirty local dev checkout and production deploy flow.

- Worktree: `/tmp/gpp-reliability-hardening-20260622`
- Branch: `audit/reliability-hardening-20260622`
- Base: `origin/main` at creation
- Rule: no production deploys from this branch until audit harness, fixture tests, and staging/preview checks pass.

## What we are optimizing for

Golf Pools Pro needs one boring, reliable tournament-week operating model:

1. Tournament row exists early.
2. Field is official/fresh before picks/groups need it.
3. Groups and pick locks happen deterministically.
4. Live scores keep updating and never silently disappear.
5. Final results freeze once and remain visible.
6. Billing prompts the host without surprise-blocking player/final boards.
7. Cron/watchdogs report invariant failures instead of piling on one-off patches.

## Highest-risk findings from the first read-only audit

### 1. Pool/payment/final visibility state is not a real state machine

Lifecycle is inferred from many independent columns and predicates:

- `gpp_pools.is_locked`
- `gpp_pools.is_completed`
- `results_finalized_at`
- `payment_status`
- tournament `status`
- tournament dates
- `leaderboard_json`
- `hasOnCourseScores(...)`
- grouped-pool group/finalization columns

This creates drift between dashboard, public leaderboard, pool page, payment APIs, reminders, and archive jobs.

### 2. Stored `payment_status='active'` currently overrides amount-due math

`getPoolPaymentStatus(...)` treats stored `active` as terminal. That can hide a real balance due for pools over the free tier because quote/reminder/archive logic may disagree with actual fee math.

Target rule: billing state should be derived from active non-removed entry count, amount paid, waivers/promos, and lock/live timing. Stored `active` should not override a positive balance due.

### 3. Public/final board visibility is too coupled to payment/archive state

Current UI has protective exceptions for completed/past pools, but backend archive/payment jobs can still mutate final pools into `archived_unpaid`. Board access should be its own invariant:

> Final/completed boards are always visible to permitted viewers and are never hidden by billing/archive state.

### 4. Grouped-pool stored-field fallback appears broken

`autoFinalizeGroupedPools()` falls back to stored fields if PGA Tour is unavailable, but the selected tournament shape does not include/pass `last_field_fetch`. Stored fields then fail freshness checks because the timestamp is `null`.

Impact: Tuesday grouped auto-lock can fail even with a good stored field if PGA Tour fetch is transiently empty.

### 5. Live sync depends too heavily on ESPN's general scoreboard listing

Activated DB tournaments are identified, but live scoring sync mainly loops events returned by the general ESPN scoreboard. If that scoreboard omits the tournament, the code may not direct-fetch by known `external_id` even though the DB knows the tournament should be live.

### 6. Final board preservation can preserve weak completed data

Completed tournament update logic protects existing stored completed leaderboards, but the preservation check can happen before confirming `finalBoardHasEnoughEvidence(...)`. That can freeze a weak/incomplete board and block repair.

### 7. Field failure tracking is in-memory only

The field failure counter is a module-level `Map`, which is unreliable in serverless. Field failure attempts need persistent audit rows.

### 8. Architecture is too concentrated in huge components/files

Hotspots:

- `PoolView.tsx`: ~3,300+ lines, dozens of state/effect hooks, payment, guest entry, picks, board, final share, admin, and live scoring all mixed.
- `DashboardActivePools.tsx`: ~1,600 lines and duplicated board/scoring display logic.
- `tournament-sync.ts`: ~900+ lines mixing fetch adapters, DB mutations, locking, finalizer, and notifications.

### 9. Verifiers are brittle source-string checks

There are many scripts checking exact Tailwind/JS source strings. Several are stale on current `origin/main`. This makes safe hotfixes harder because `predeploy:check` can fail on outdated implementation-detail assertions.

### 10. Database types/schema are stale

`src/types/database.ts` appears materially behind migrations and app usage. Missing tables/columns include notification/final-result/email/guest token and field freshness additions. This weakens type safety and hides drift.

## Target first-principles model

Separate these axes instead of overloading payment/tournament/pool booleans:

### Pool phase

```ts
open -> locked -> live -> finalizing -> final
```

### Pick access

```ts
can_join
can_edit_picks
picks_masked_for_others
picks_revealed
```

### Billing state

```ts
free
estimated
collectable_unpaid
paid_current
balance_due
waived
refunded
failed
```

### Board visibility

```ts
private_prelock_masked
visible_live
visible_final
admin_hold
```

Billing can create host prompts/escalations, but it should not be an implicit public/final board access-control system.

## First branch deliverable

This branch starts with a read-only production readiness audit script:

```bash
npm run audit:prod-readiness
npm run audit:prod-readiness -- --json
npm run audit:prod-readiness -- --strict
```

The first version checks:

- final/completed pools with `archived_unpaid` payment state
- locked/live pools stored `active` while fee math says balance due
- final pools missing frozen entry rank/score/counting snapshots
- live tournaments with empty/stale leaderboard data
- upcoming pools inside field-readiness window with missing/stale fields
- grouped pools near start date without finalized groups
- past pools without `results_finalized_at`
- cron run table availability/history

The script is intentionally SELECT-only. It uses `.env.local` if present and prefers `SUPABASE_SERVICE_ROLE_KEY` for complete read coverage. If only anon credentials are present, it warns that RLS may hide rows.

## Safe implementation sequence

### Stage 0 — observe and protect

- Keep production deploys off this branch.
- Keep current live app stable.
- Finish small isolated customer hotfixes from clean hotfix worktrees.
- Use this branch to build audit/tests/refactor seams.

### Stage 1 — read-only production audit

- Expand `scripts/audit-prod-readiness.mjs` from heuristic checks into a shared invariant engine.
- Add issue codes, severity, affected pool/tournament IDs, and suggested repair action.
- Keep stdout concise enough for cron/Telegram delivery.

### Stage 2 — acceptance tests before moving code

Replace stale source-string verifiers with behavior/fixture tests for:

- pool/payment/final visibility state
- entry privacy/masking
- scoring/frozen final results
- grouped field lock readiness
- dashboard/pool/public board parity
- guest/account entry update validation
- tournament sync dry-runs

### Stage 3 — pure selectors/extractions

Extract without behavior changes:

- `src/lib/pool-state.ts`
- `src/lib/entry-visibility.ts`
- `src/lib/pick-display.ts`
- `src/lib/server/authz.ts`
- `src/lib/server/pool-queries.ts`

### Stage 4 — shared board component

Only after tests/screenshot baselines:

- shared leaderboard board rows/cards for dashboard + pool page
- no visual redesign initially
- keep GPP design rules intact

### Stage 5 — tournament sync planner/executor

Split `tournament-sync.ts` into:

1. fetch adapters
2. normalization/quality checks
3. pure planner/dry-run
4. DB executor
5. notification/payment/archive side effects

### Stage 6 — persistent ops telemetry

- DB-backed field fetch attempts
- DB-backed cron/job locks
- one consolidated reliability watchdog built from the same invariant engine

## Fixes to prioritize after audit output

1. Final boards never hidden by payment/archive state.
2. `getPoolPaymentStatus`/billing state no longer lets stored `active` hide a positive balance due.
3. Archive cron excludes completed/final pools.
4. Grouped auto-lock stored-field fallback passes `last_field_fetch` and updates `field_fingerprint`.
5. Live sync direct-fetches activated DB tournaments missing from general ESPN scoreboard.
6. Final-board preservation requires enough final evidence or frozen result markers.
7. PoolView/Dashboard use API/stored `last_scores_fetch`, not local `new Date()` as freshness proof.

## Non-goals for the first pass

- No UI redesign.
- No production migration.
- No removal of old RPCs/columns until schema/types are regenerated and staging migration replay passes.
- No broad rewrite of `PoolView`/`DashboardActivePools` without acceptance tests.
- No new noisy cron jobs until the shared audit rules are stable.
