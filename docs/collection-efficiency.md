# Collection frequency and cost

## Collection is separate from AI writing

The hourly property archive calls RSS feeds, parses their published excerpts,
filters geography/topics with code, deduplicates by article identity and stores
source health. It does not call an LLM, generate images or scrape every article.
With 52 configured sources, the baseline is 52 × 24 = 1,248 feed requests per
day before failures/retries and any overlap with the daily briefing. These are
HTTP requests, not paid model calls. Hosting, database and network work still
have a cost; no billing total has been verified by this code review.

The three daily metric collections also use source readers, not model extraction.
Monthly/quarterly reporting dates remain unchanged until new source data arrives.
Auction collection is paused pending approved alternative access; it must not
resume the excluded PropTrack/REA reader or assume SQM access is free.

The selected daily AU/PROPERTY briefing items receive a combined editorial LLM
call after recent-story deduplication. Other coverage lanes skip that editorial
call. Weekly synthesis, other editorial generation and user answers can also
incur AI costs. The shared LLM client has per-task model tiers and output limits,
but those controls are not a verified total monthly spend cap. Actual provider
token usage and invoices are needed before claiming a dollar saving or a budget.

## Bounded feed reuse

The RSS reader shares one in-flight download per URL and reuses a successful
parsed feed for at most five minutes in that server process. The hourly archive
still checks each source every hour; this only saves overlapping requests.
The cache is bounded to 128 entries and 4 MiB of serialised payload. Oversized
feeds can still be read but are not retained. Restarts clear this optional cache.

Each caller applies its own item budget, category and publisher metadata after
reading the shared feed. A small briefing budget cannot truncate the archive's
100-item budget. Cache reuse preserves the actual download/check time in source
health, and never changes article publication dates. Expired entries cannot
stand in for a failed fresh request; errors remain visible and retryable.

## Collection recovery

The 06:33, 12:03 and 18:03 Sydney metric refreshes now validate every active
metric source and every write. A partial refresh keeps successfully collected
data but fails the scheduled attempt, retaining a diagnostic for retry. Paused
auction sources stay visible in Admin and do not trigger futile retries.

Recovery checks have separate four-hour Sydney slots (00, 04, 08, 12, 16, 20).
An early healthy check cannot suppress a later check that day. Only the current
slot catches up after a restart; missed slots are not replayed. Healthy coverage
means a database check only. Old reporting periods remain flagged, but a release
stored within the past six hours does not by itself trigger another download.

Metric jobs have at most three attempts per slot, with 15 then 30 minutes of
backoff after failure. Archive jobs keep two attempts per hourly slot. Backoff
and attempts are durable in the existing job_runs table. In the worst case of
persistent gaps, recovery allows up to 18 collection attempts per day, plus up
to nine scheduled metric attempts; it is bounded, not an unlimited retry loop.
Retries currently recollect the metric batch; per-source selective retries are
not implemented. These collectors still make no LLM calls.

Only direct metric and hourly archive jobs can reclaim an interrupted running
attempt after 15 minutes. Each attempt has a ten-minute execution deadline.
Attempt numbers fence completion and data writes. Writes lock the job record in
the same transaction as the data, so a superseded worker cannot overwrite its
replacement's data or status. Metric batches share that transaction to avoid a
separate lease query per metric. Deadline expiry rolls back an in-flight write
transaction when it returns; late tasks retain the aborted context. Publication,
daily briefing enrichment and email jobs do not use expiring collection locks.

Unit tests cover deadlines, late writes, partial results and later-day checks.
CI also exercises concurrent claims, expiry, rollback and stale completions
against isolated MySQL. Deployment does not by itself verify recovery across
every production outage. Upstream access failures, database outages and data
licensing remain separate constraints. No new paid provider is introduced.
