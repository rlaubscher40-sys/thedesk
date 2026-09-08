# Nationwide property evidence

The evidence archive is separate from the curated daily briefing. The collector
checks 52 discovery sources: 28 existing national sources and three targeted
searches for each of NSW, VIC, QLD, WA, SA, TAS, ACT and NT. The three searches
cover statewide housing, regional housing and government announcements. They
use Google News discovery; they are not direct state-government data APIs.

## Collection and operation

- `server/evidence/collect.ts` runs hourly through the existing in-process
  scheduler. `ENABLE_SCHEDULER=true`, `SCHEDULED_API_KEY` and a working database
  are required. Existing deployment environment settings remain authoritative.
- Each hourly slot has an atomic database claim and a 59-minute catch-up window.
  A restart catches up the current hour, not every missed hour. Each feed has
  an eight-second timeout, one immediate retry and a 100-entry safety limit;
  no more than six feed requests run concurrently.
- The first run collects the available feed history. State searches request
  the last 14 days. This is not an exhaustive historical backfill.
- Only relevant public feed headlines and excerpts (up to 480 characters) are
  archived. This collector does not scrape full articles, run models, publish
  social posts or send newsletters. Daily editorial enrichment keeps its
  existing story budgets, and now also considers the new state sources.
- URL tracking parameters are removed before hashing for deduplication.
  Publication dates must be present, valid, not future-dated and within 180 days.
  Collection timestamps never substitute for publication dates. Geography is
  inferred from explicit state/city mentions, not from the search's target state.
- Idempotent table creation runs through the existing startup schema catch-up;
  `drizzle/0024_property_evidence.sql` documents the matching DDL.

## Consumers

Ask and market comparisons retrieve from both editorial content and the archive.
Public market files also receive a bounded archive sample with separate state
budgets. Archive citations open `/evidence/:id`, showing the public excerpt,
publication date, publisher and original link. Ask explicitly receives excerpts
as limited evidence rather than verified full articles or structured statistics.

Structured numeric Signals continue using their existing official-data paths.
Feed excerpts must not be silently promoted into verified numeric time series.
Google redirect links can remain in the archive; Google is a discovery service,
not an additional independent publisher. The archive does not certify claims.

The ABS approvals connector requests all eight capital/territory geographies;
Canberra's series covers the whole ACT. The population/migration connector
requests all eight states and territories and persists up to 32 explicitly
labelled demographic metrics. Market pages present those as state context,
never as a suburb or city estimate. Missing or suppressed observations are
withheld and complete annual periods are required.

Official metrics refresh at 06:33, 12:03 and 18:03 Sydney time. The additional
daytime runs skip news/LLM extraction. Per-metric health in Admin shows missing
series, reporting periods, last successful storage and conservative review
thresholds. Unchanged observations refresh the storage timestamp without
duplicating history. A partial database acknowledgement fails the collection
job so the scheduler can retry; one updated currency cannot hide missing data.

Ask filters the known state demographic and capital approval series by named
geography before applying its metric limit. Recognised city names may retrieve
their explicitly labelled state demographic context; regional city questions
do not substitute their capital's approvals. Location alone cannot satisfy an
unrelated topic such as rents. Decimal thousands from ABS are converted exactly,
preserving whole-person counts without rounding fractional people. A metric
write without a configured database fails rather than acknowledging storage.

## Deployment acceptance

Open Admin → Health → Property evidence coverage after deployment:

1. Confirm hourly collection is enabled and each source has a recent check.
2. Inspect source failures, empty feeds and the newest publication dates.
3. Review seven-day state and topic counts. A successful job or a positive
   article count does not prove complete coverage. Missing states remain visible.
4. Open an archive citation from Ask or a market comparison and confirm its
   source link and publication date. Test a topic outside the daily briefing.

Regional place lists are discovery aids, not exhaustive suburb directories.
Commercial suburb-level data, unindexed government notices and sources absent
from RSS/Google require additional licensed or public-data connectors. A complete
government register, exact release-calendar monitoring and broader backfills are
separate work; this release must not be represented as complete property coverage.
