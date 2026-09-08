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

The cache does not replace durable scheduler locks or address interrupted jobs,
once-per-day recovery claims, missing-source success reporting, or upstream
feed failures. Those reliability gaps require separate changes. No new paid
provider or service is introduced by this optimisation.
