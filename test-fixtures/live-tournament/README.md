# Live tournament replay fixtures

These fixtures let us test tournament-week behavior when no tournament is running.

## What is safe to store

Fixtures should contain public tournament data only:

- tournament name/date/status metadata
- public leaderboard rows
- synthetic fixture pool rows

Do not store customer pools, entries, profiles, emails, passcodes, payment rows, or auth/user IDs here.

## Capture a fresh fixture

From a secure shell with production Supabase env loaded:

```bash
npm run fixture:capture-live-tournament -- --external-id 401811952 --out test-fixtures/live-tournament/us-open-2026-round-3-live.json
```

Then normalize `scenarioNow` / `last_scores_fetch` if the test needs stable time travel.

## Replay checks

```bash
npm run test:live-tournament-replay
```

The replay test covers:

- healthy live scoring state
- tournament status downgraded to `upcoming` while leaderboard rows exist
- stale score fetch
- stale live-sync cron history
- completed tournament leaving Active Pools
