# Scheduled task brief

This document is the content contract between the external scheduler (the
service that crawls the web, summarises, and POSTs ingestion payloads) and The
Desk's `/api/ingest/*` endpoints. It is a brief, not a schema — the wire format
is enforced in `shared/schemas.ts`. This file describes editorial intent: what
counts as a "good" payload before it goes near the server.

The scheduler may also POST to the older `/api/scheduled/*` URLs. Both routes
mount the same handler and share the same body shape, so this brief applies
equally.

---

## Auth

Send `x-scheduled-key: $SCHEDULED_API_KEY` on every POST, or include `?key=…` if
the scheduler can't set headers. An admin browser session also unlocks the
endpoint for manual testing.

---

## Daily feed — `POST /api/ingest/daily-feed`

Fires once a day, in the morning Sydney time. Body: `{ items: DailyFeedItem[] }`.

### Volume

- **12–18 items per run.** Below 12 leaves the homepage feeling thin; above 18
  the feed buries the lead.
- Reject your own run if you can't get to 12 — better to skip a day than to
  ship filler.

### Mix

Per day, aim for the following category spread. Exact counts don't matter; the
spirit is "no day is monothematic".

- **4 +** items in **Global Public Pulse** — what real people are talking
  about. Sourced from X (formerly Twitter) and Reddit, scored by reach and
  engagement, not press-release recency. These can sit under any category but
  should _feel_ social-first.
- **3 +** items in **Macro / Property / Markets** — the spine. Rates, housing
  data, ASX, lending policy, regulator moves.
- **2 +** items in **Policy / Geopolitics** — anything that changes the rules
  or the cost of capital. APRA, ASIC, RBA speeches, federal budget, trade
  deals, election outcomes.
- **1 +** item in **AI / Tech** — only when it actually moves money or
  workflows in Australia. Skip the model-launch noise.
- **Remainder**: editor's discretion. Science, culture, sport — fine as long
  as it earns its slot.

### Sourcing rules

- Prefer primary sources: regulator websites, ABS, AFR, Banking Day, RBA
  speeches, parliamentary records. Aggregators (Google News, MSN) are last
  resort.
- Social-pulse items must link the original X post or Reddit thread, not a
  third-party recap.
- **No press releases dressed as news.** If the source's URL is a `/media-release/`
  path or contains "press-release", drop it unless the underlying number is
  genuinely new.
- One item per story. If three outlets covered the RBA decision, ship one —
  the one with the sharpest summary.

### Per-item fields

| Field         | Required | Notes                                                                                                       |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `feedDate`    | yes      | `YYYY-MM-DD` in Sydney tz. All items in one run share the same date.                                        |
| `title`       | yes      | 1 sentence. No clickbait. Lead with the number if there is one.                                             |
| `source`      | yes      | Short masthead — "AFR", "Banking Day", "ABS", "X / @user", "Reddit / r/AusFinance".                         |
| `sourceUrl`   | optional | Direct link to the source.                                                                                  |
| `summary`     | yes      | 2–4 sentences. State what changed and why a partner would care. Australian English. No em dashes.           |
| `category`    | yes      | One of `MACRO`, `PROPERTY`, `POLICY`, `MARKETS`, `AI`, `TECH`, `GEOPOLITICS`, `SCIENCE`, `ECONOMICS`, `OTHER`. |
| `partnerTag`  | optional | If supplied, must be the 4-line `Institutional/Broker/Adviser/Buyers Agent` block. Otherwise the server generates one. |
| `sayThis`     | optional | One conversation-opening sentence. Otherwise the server generates one.                                      |
| `imageUrl`    | optional | Pre-generated thumbnail. Otherwise the server generates one in the background.                              |

Anything the scheduler can pre-fill saves an LLM round-trip — but the server
will fill in `partnerTag`, `sayThis` and `imageUrl` on its own if missing.

---

## Weekly edition — `POST /api/ingest/weekly-edition`

Fires once a week, Sunday evening Sydney time. Body: a single edition object.

### Shape

- `editionNumber` increments monotonically. The server does not enforce
  uniqueness, so the scheduler is responsible for not double-shipping.
- `weekOf` and `weekRange` are display strings — `"2026-05-11"` and `"May 11 –
  May 17, 2026"` respectively.
- `topics`: 4–6 topic objects. Fewer than 4 reads as thin; more than 6 buries
  the lead.
- `signals`: 6–10 one-liners. These appear as the bullet rail on the
  EditionReader.
- `keyMetrics`: the numbers worth tracking week-over-week. Cash rate, ASX 200,
  national clearance, fixed-rate share, etc. The metrics widget tracks the
  direction-of-good per label, so the scheduler should keep label spelling
  consistent week to week (otherwise trend continuity breaks).

### Editorial guardrails

- Topics span the same category mix as the daily feed brief (above), in
  miniature.
- Each topic includes a `keyTakeaway` — one sentence the reader could repeat
  to a client as the headline insight. This is the line Ruben uses verbatim.
- `fullText` is the optional searchable long-form. Plain text, no markdown.
- The server runs `editionHeroPrompt` and `generateRubensTake` in the
  background, so the scheduler does not need to supply hero imagery or Ruben's
  Take.

---

## Failure modes

- **Validation error → 400** with `issues` payload. The scheduler should log
  and retry on the next cycle, not flood.
- **Database error → 500.** Treat as transient; retry once after 60 seconds.
- **Auth error → 401.** Page someone; do not retry.

---

## Local testing

```bash
curl -s -X POST http://localhost:5173/api/ingest/daily-feed \
  -H "x-scheduled-key: $SCHEDULED_API_KEY" \
  -H "Content-Type: application/json" \
  -d @fixtures/daily-feed.json | jq
```

In demo mode (no `DATABASE_URL`) the writes hit the in-memory store and reset
on server restart — useful for shaping payloads before pointing the real
scheduler at production.

---

## The actual scheduler: GitHub Actions

The repo ships with two workflows that drive the site:

- `.github/workflows/daily-feed.yml` — runs every day at 20:00 UTC (~06:00
  Sydney). Pulls RSS from the sources listed in `scripts/ingest/sources.ts`,
  dedupes, scrapes `og:image` per article, and POSTs the batch to
  `/api/ingest/daily-feed`. Server enriches partnerTag / sayThis / image
  fallback in the background.
- `.github/workflows/weekly-edition.yml` — runs Sunday 08:00 UTC (~18:00
  Sydney). POSTs to `/api/ingest/synthesize-edition`. The server gathers
  the week's feed items, runs the synthesis prompt against the Manus LLM,
  and persists a new edition. Hero image and Ruben's Take are generated in
  the background after the response returns.

Neither workflow needs an LLM API key — all LLM work happens server-side
through the existing Manus SDK.

### One-time setup

1. **Deploy the site somewhere with a real database.** Demo mode wipes on
   restart, so the scheduler has nowhere to persist. Set `DATABASE_URL`
   (MySQL / TiDB) and run `pnpm db:push`.
2. **Set a shared secret on the server**: `SCHEDULED_API_KEY` env var. Any
   strong random string works — generate one with `openssl rand -hex 32`.
3. **Add the same key to GitHub repo Secrets**, plus the public URL of the
   site:
   - `SCHEDULED_API_KEY` — same value as the server env var
   - `INGEST_BASE_URL` — e.g. `https://thedeskglobal.manus.space` (no
     trailing slash)
4. **Confirm timings.** The cron expressions are UTC. The defaults assume
   Sydney AEST (UTC+10). Edit the `cron:` line in each workflow if you'd
   rather post at a different local time, or during AEDT (UTC+11).

### Running manually

Each workflow has a `workflow_dispatch` trigger, so you can fire it from
the GitHub Actions UI for testing without waiting for the cron.

Locally, either script runs the same way:

```bash
export INGEST_BASE_URL=https://thedeskglobal.manus.space
export SCHEDULED_API_KEY=...

pnpm ingest:daily
pnpm ingest:weekly
```

### Editing the source list

`scripts/ingest/sources.ts` is the editorial dial. Each entry maps an RSS
feed URL to a category and an item cap. Add a source, change a cap, swap a
category — the script picks it up on the next run. There's no LLM
classification step in the script itself, so the category you set here is
the one stored on the feed item.

If a source is intermittently flaky, the script logs a warning and skips
it; one bad feed doesn't sink the run. But if total items fall below
`DAILY_ITEM_MIN` (8) the run fails red so a thin day doesn't ship.
