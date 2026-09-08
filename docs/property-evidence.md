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

## Missing-data recovery

Live source checks on 8 September 2026 reproduced the old eight-second ABS
timeout. With a 30-second bound the deployed connector code retrieved 120 state
observations in 12.7 seconds and 104 capital approvals in 14.3 seconds locally.
Both produced complete annual reads for all eight jurisdictions. RBA lending
requests also need a 30-second bound. These are source checks, not proof of
production database writes.

The cash-rate collector now pins the daily F1 `FIRMMCRTD` series and reads CSV
fields correctly. The old parser required quoted dates in a format absent from
the monthly F1.1 file. The small cash-rate fixture retains actual source columns
and observations from `https://www.rba.gov.au/statistics/tables/csv/f1-data.csv`.
An empty current-day row may precede the latest completed daily observation;
older gaps, stale observations and changed series identities are rejected.

An all-day recovery job runs at the scheduler's next tick when official metrics
are missing or collection is overdue, including evening deployments. It writes
directly to the database, retains successful writes when another source fails,
and reports incomplete collection for the existing bounded scheduler retries.
Admin Health also has an authenticated refresh button, current run status and
separate counts for unavailable sources and failed writes. Concurrent manual
requests share an in-process run and completed results have a one-minute cooldown.
The latest manual report is process-local; scheduler failures remain in job logs.
Scheduler configuration gates automatic recovery; manual refresh does not need
a scheduled API key. Neither path runs news extraction or publishes content.

The existing safeguard against unfiltered ABS dataflow discovery is retained.
It uses the existing release-page readers until a scoped API series is configured.
A bounded collection window
prevents that source group from indefinitely delaying other metric writes.
After those changes, a full read-only collection returned all 53 direct-source
metrics in 13.3 seconds. The four news-extracted metrics are outside this recovery
path and remain separately marked for evidence review.

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
