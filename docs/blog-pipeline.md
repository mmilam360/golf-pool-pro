# Weekly golf pool content pipeline

Goal: publish one useful, crawlable golf pool guide each tournament week. The post should help someone run a better pool, not repackage betting picks.

## Inputs

A cheap model should receive a compact facts file, not the open internet.

Required facts:

```json
{
  "tournament": "PGA Championship",
  "year": 2026,
  "course": "Aronimink Golf Club",
  "publishDate": "2026-05-14",
  "sourceNotes": [
    {
      "source": "Covers",
      "url": "https://example.com/source",
      "facts": ["Scheffler is consensus favorite", "Cameron Young has two wins in last five starts"]
    }
  ]
}
```

## Model output

The model must output one JSON file that matches `src/content/blog/*.json`.

Rules:

- Valid JSON only.
- Use supplied facts only.
- Do not invent odds, rankings, injuries, course details, or player form.
- Do not copy source wording. Synthesize in Golf Pools Pro voice.
- No betting advice language. This is pool strategy, not gambling picks.
- Include sources checked.
- Include internal links to `/signup`, `/rules`, and the relevant tournament landing page.
- Mention Golf Pools Pro naturally once or twice. Do not turn the post into an ad.
- Keep the article useful for an office pool runner making picks fast.

## Recommended article structure

1. Why this tournament is tricky for pools.
2. Safe/core picks.
3. Upside picks.
4. Risk/fade notes.
5. Simple entry build for a 12-pick pool.
6. Short group-chat explanation.
7. FAQ.
8. Sources.

## Human quality bar

Reject the draft if it has any of this:

- Generic intro like "golf fans are excited."
- Keyword stuffing.
- Fake confidence.
- Unsupported player claims.
- Betting-copy tone.
- Longshot spam.
- No practical advice for pool format.

## Validation and publish

Run:

```bash
npm run blog:validate
npm run lint
npm run build
```

Then review the post in browser before deploy.

For cron use, safest flow is draft-only:

1. Research worker collects source notes.
2. Cheap model writes JSON draft.
3. `npm run blog:validate` runs.
4. Agent opens/commits PR or sends draft for approval.
5. Human or stronger model reviews before production.

Do not fully auto-publish weekly picks until we trust the source extractor and validator.
