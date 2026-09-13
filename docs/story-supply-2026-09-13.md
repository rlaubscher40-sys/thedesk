# Story supply and recent reporting

## Verified problem

The public September 13 feed returned 27 rows: AU 3, PROPERTY 3, BUSINESS 12,
GLOBAL 5 and TECH 4. The 12:43 Sydney production run attempted 132 reads,
selected 12 stories and inserted 9. Its complete decision counts included 431
outside the reading budget, 73 behind the initial publisher reading limit,
20 unreviewed publishers, 16 article HTTP 403 responses and 6 HTTP 401 responses.
These are pipeline outcomes, not counts of worthwhile missed news.

Admin showed SBS's housing-downturn and migration reports had readable text
and passed earlier gates but were rejected as unreviewed publishers. Bega and
packaging reporting had landed; those previously unconfirmed gaps are no
longer evidence of missing publication. Tasmania's September 9 report must
retain its original date and must not be forced past the freshness rules.

## Changes

- Add exact-domain SBS News admission with ordinary topic, geography, date,
  text and promotional-content checks. Add its public Economy and Finance
  article index; exclude podcast/video and off-origin links.
- After the initial 100 local and 32 international candidate slots, try up to
  60 more local candidates in 20-candidate waves if local supply is short.
  Recovery may examine up to 20 candidates per named source across both
  stages, instead of repeatedly stopping at its first ten. Canonical/event
  deduplication and publisher/lane publication limits still apply.
- Check unreviewed local publishers before downloading their articles,
  coalesce identical resolved article URLs within a run, and defer further
  requests to a host after HTTP 429. In-flight requests can finish. The next
  scheduled run may try the host again. HTTP 403 is not treated as proof that
  every page from that publisher is inaccessible.
- Keep the morning 06:43 collection and existing 12:43/18:43 claim keys; add
  09:43 and 15:43 Sydney updates. Each update expires before the next update,
  avoiding several overdue update runs after a restart. Social schedules and
  permanent publication receipts are unchanged. Discovery/reading adds no
  model calls; newly accepted articles use the existing enrichment process.
- On today's AU and Property lanes, show a separate recent-reporting section
  for the preceding three Sydney filing days. Filter by lane and dates before
  the 24-row database limit, then respect topic preferences and group related
  reporting into at most 12 entries. Preserve IDs, source dates and links.
  Historical day views and today's story count retain their existing meaning.

## Source verification

- https://www.sbs.com.au/news/collection/economy-and-finance returned eight
  original article links through the existing HTML index parser.
- https://www.sbs.com.au/news/article/could-australias-housing-downturn-push-the-economy-into-recession/lxuxjoaaw
  yielded 5,994 extracted characters and original publication time
  2026-09-11T20:44:10.478Z. A read-only replay with the new exact-domain rule
  passed eligibility. This is a selected-source proof, not a production insert.
- https://www.sbs.com.au/news/article/australias-debate-over-net-overseas-migration/kobvomk3g
  was independently located on SBS and matched the live held headline.
- ABC housing-topic pages were visible through web search but denied direct
  downloads and this browser. No ABC adapter or access workaround was enabled.
  Other blocked publishers remain unresolved and visible in diagnostics.

## Verification and continuation

Regression coverage exercises reserve recovery beyond the initial reading
budget, its hard ceiling, publisher limits, shared-original download coalescing,
rate-limit deferral, exact SBS host checks, index URL boundaries, Sydney update
windows, recent date/source links, topic preferences and empty/error states.
A MySQL integration regression checks date/lane filtering before limits and
excludes HOLD, today, future and old records; it runs in CI's isolated database.

The first full PR CI run passed 2,238 tests and failed this new integration
fixture because automatic demo mode bypassed SQL when DATABASE_URL was absent.
The fixture now explicitly disables demo mode (without configuring any production
database), and an always-on regression checks the unavailable-database path.
The corrected full CI run must pass before merge.

TypeScript, the dead-code audit and frontend production build passed locally.
Static React markup was checked. Cloud Browser could not open the local preview,
so visual browser verification remains a post-deployment check. A full local
live-source collection was blocked by this environment's publisher DNS; do not
confuse that result with the working production collector.

After rollout, verify recent reporting on both local lanes and a fresh ordinary
collection's SBS outcomes, unique inserts and remaining holds. Do not claim a
specific story-volume increase, complete coverage or improved engagement until
production provides that evidence. No historical stories were refiled, no manual
social publication was made and no paid source was added.
