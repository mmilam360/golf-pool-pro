# Golf Pools Pro — Square payment flow

## Decision

Use Square Online API / Web Payments SDK, not a Square Online store checkout.

Why:
- Hosted Square Online checkout is listed by Square as Online: 3.3% + 30¢.
- Online API payments are listed as Online API: 2.9% + 30¢.
- Golf Pools Pro payments are low-ticket one-time charges, so the lower API rate matters.

Important caveat: Square's fees page lists Bitcoin payments as in-person QR payments at 0% until 2027. Do not assume Bitcoin is available inside the online Web Payments SDK checkout until Square docs/account settings confirm it.

## Payment model

Pools with 5 or fewer active entries are automatically active.

For pools over the free tier, show an estimated fee while entries are still open. Do not collect payment early. Collect the final pool fee only after picks lock or the tournament starts, when the active non-removed entry count is stable enough to avoid reopening/recharging support issues.

Entrants should never be blocked by capacity while joining. The host can remove unwanted entries. Payment is based on active entries at final fee collection time.

### Price tiers

- First 5 active entries: free and automatically active.
- Entries 6 through 100: $1 per extra active entry, capped at $25.
- Over 100 active entries: add $15 for each started 100-entry block after 100.
- Maximum pool charge: $99.

### Price calculation

`active_entries = gpp_entries where pool_id = pool.id and is_removed = false`

`amount_due = tier_price(active_entries) - amount_paid_cents`

If `amount_due <= 0`, mark the pool active without charging again.

## Pool payment states

Add explicit pool-level state. Do not reuse entrant payment fields.

Recommended columns on `gpp_pools`:

- `payment_status text not null default 'draft'`
  - `draft`: pool exists, not activated
  - `active`: paid/current, leaderboard visible when scoring starts
  - `payment_due`: entry count grew beyond paid tier before lock/start
  - `archived_unpaid`: event started/locked without payment; leaderboard hidden until paid
  - `refunded`: payment reversed/admin state
- `paid_entry_limit integer not null default 5`
- `amount_paid_cents integer not null default 0`
- `activated_at timestamptz null`
- `last_payment_at timestamptz null`
- `square_customer_id text null`
- `square_payment_ids text[] not null default '{}'`
- `square_order_ids text[] not null default '{}'`

Optional separate audit table:

`gpp_pool_payments`
- `id uuid primary key`
- `pool_id uuid not null references gpp_pools(id)`
- `provider text not null default 'square'`
- `square_payment_id text unique`
- `square_order_id text`
- `amount_cents integer not null`
- `entry_count_at_payment integer not null`
- `entry_limit integer not null`
- `status text not null`
- `created_at timestamptz not null default now()`

## User flows

### 1. Create pool

Host creates a pool normally. A new pool starts as active because the owner entry is inside the free tier.

State after create:
- `payment_status = 'active'`
- `paid_entry_limit = 5`
- `amount_paid_cents = 0`

Host lands on pool page with:
- share code/link
- pick team CTA
- activation panel only when active entries pass the free tier

Suggested host copy:
- `Activate this pool before the tournament starts.`
- `Current entries: 8`
- `Activation price: $3`
- Button: `Activate pool`

### 2. Entrants join

Entrants can join normally until host locks picks or the tournament starts.

No entrant capacity block.

If pool is unpaid, entrants can still:
- join
- make picks before lock
- see their own picks

Before activation/scoring, avoid presenting the live leaderboard as final.

### 3. Host removes unwanted entries

Admin tab already has remove-entry behavior. Pricing should count only active, non-removed entries.

If the host removes entries before paying, the activation price recalculates down.

If the host removes entries after paying, do not automatically refund. Keep `amount_paid_cents` as audit history.

### 4. Collect final pool fee after picks lock

Host clicks `Pay pool fee` only after picks lock or the tournament starts.

Frontend calls:
`POST /api/payments/square/create-payment`

Payload:
```json
{
  "poolId": "uuid",
  "sourceId": "square-web-payments-sdk-token"
}
```

Server:
1. Authenticates current user.
2. Confirms user owns pool.
3. Counts active entries.
4. Calculates tier and amount due.
5. Creates Square payment with idempotency key.
6. Records payment row.
7. Updates pool payment fields.
8. Returns updated pool state.

Delayed capture note: Square supports delayed capture with `autocomplete=false`, but online card-not-present authorizations expire after about 7 days. That is too short for pools opened well before a tournament. The better long-term model is to save a card/payment method with explicit host consent, calculate final active-entry price at lock/start, and charge once.

### 5. More entries join before picks lock

No blocking.

If active entries exceed `paid_entry_limit`, host sees an estimate banner:
- `This pool has 140 active entries. Estimated pool fee: $40.`

Pool state can become `payment_due`, but entrants still join and pick.

After picks lock/event start, if amount due remains unpaid, hide/archive leaderboard until paid.

### 6. Event starts and pool is unpaid or underpaid

Scheduled job or tournament sync checks pools for tournaments that are live and not fully paid.

If `amount_paid_cents < tier_price(active_entries)`:
- set `payment_status = 'archived_unpaid'`
- hide the leaderboard from entrants
- host sees restore screen with exact amount due

Suggested entrant view:
- `This pool is not active yet.`
- `The host needs to activate it before standings are shown.`

Suggested host view:
- `Activate this pool to show the leaderboard.`
- `Current entries: 18`
- `Amount due: $13` or `$10 remaining`

### 7. Pay after archived

Host can pay after start.

On successful payment:
- update `payment_status = 'active'`
- update `paid_entry_limit`
- add payment audit record
- show leaderboard again

## API structure

### Server env vars

Do not expose these to the browser:
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_ENVIRONMENT` = `sandbox` or `production`
- `SQUARE_LOCATION_ID`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`

Browser-safe:
- `NEXT_PUBLIC_SQUARE_APPLICATION_ID`
- `NEXT_PUBLIC_SQUARE_LOCATION_ID`
- `NEXT_PUBLIC_SQUARE_ENVIRONMENT`

### Routes

`POST /api/payments/square/quote`
- Input: `{ poolId }`
- Output: active entry count, current tier, paid amount, amount due, status.
- Used for banners and payment panel.

`POST /api/payments/square/create-payment`
- Input: `{ poolId, sourceId }`
- Server performs Square Payments API charge.
- Uses idempotency key under Square's 45-character limit: `gpp_{compactPoolId}_{activeEntryCount}_{amountDueCents}`.

`POST /api/payments/square/webhook`
- Verifies Square signature.
- Handles payment updates/refunds/disputes if Square sends async status changes.

## Frontend structure

Add payment panel components only where they affect the next action.

### Dashboard

For owned pools:
- Show compact status badge: `Draft`, `Active`, `Action needed`, `Archived`
- If unpaid/underpaid: button `Activate`

### Pool page — owner view

Top banner, above invite/team tabs:
- Current active entries
- Status
- Amount due
- Primary button

Do not use wagering words. Avoid `buy-in`, `payout`, `pot`, `cash`, `prize`, `wager`.

### Pool page — entrant view

If pool is archived/unpaid:
- Hide leaderboard table.
- Show short neutral message that the host needs to activate the pool.
- Still allow viewing submitted picks if appropriate.

## Square implementation notes

Use Square Web Payments SDK in the browser to tokenize card/ACH-supported payment details. Send only the Square `sourceId` token to the server. Never send raw card data to Golf Pools Pro servers.

Server uses Square Payments API with:
- `source_id`
- `idempotency_key`
- `amount_money.amount` in cents
- `amount_money.currency = 'USD'`
- `location_id`
- `reference_id = pool.id`
- `note = Golf Pools Pro pool activation`

Need to verify Square account capability for:
- online card payments
- ACH via Web Payments SDK, if desired
- Cash App Pay, if desired
- Bitcoin online availability: likely not available from the fees page wording; verify before promising it.

## MVP cut

Build this first:
1. DB migration for pool-level payment fields + payment audit table.
2. Quote route.
3. Square card payment route.
4. Pool owner payment panel.
5. Hide/restore leaderboard based on `payment_status`.
6. Manual cron/check during tournament sync to archive unpaid pools once tournament starts.

Skip for MVP:
- Email reminders.
- ACH.
- Bitcoin.
- Refund automation.
- Multi-payment-method selector.

## Verification checklist

Sandbox:
- Create pool with host entry only.
- Add 8 test entries, quote returns $9.
- Pay in Square sandbox, pool becomes active with `paid_entry_limit = 10`.
- Add entries to 18, quote returns $10 due and state/action needed.
- Pay difference, pool becomes active with `paid_entry_limit = 25`.
- Mark tournament live with unpaid pool, leaderboard hides.
- Pay after archive, leaderboard reappears.

Production:
- Use a real low-dollar test payment.
- Confirm Square dashboard payment, DB audit row, and app state all match.
