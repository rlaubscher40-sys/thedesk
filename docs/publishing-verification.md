# Publishing verification and insights recovery

The morning scheduler completing is not proof that Instagram published, that
enrichment completed, or that insights were retrieved.

## Evidence to use

- `[daily-feed] receipt` records accepted/inserted/duplicate/dropped counts and
  the exact inserted IDs, their feed dates and whether enrichment was queued.
- `[feed-enrichment] outcomes` reads committed job states after a worker pass.
  `pending`, `running`, `failed` and `skipped` do not mean completed. No outcome
  line is not proof of completion. The existing admin `health.feedEnrichment`
  query remains the source for aggregate queue health and exhausted jobs.
- `[instagram-publication] confirmed` is emitted only after the media response
  and durable receipt confirmation. The receipt captures story IDs, import
  timestamps and source-date claims. Existing uncertain reservations are never
  reset or retried by this change.
- Admin-only `instagram.publicationAudit` joins confirmed slot receipts to the
  exact feed IDs and their enrichment jobs. It distinguishes source information
  captured at publication from the current row. Older receipts may have IDs but
  no captured dates; that remains explicit. Missing jobs are `unknown`.
- Publisher dates remain publisher claims. Feed-only originals stay unconfirmed;
  a successful import or complete enrichment never upgrades provenance.

## Insights

The collection endpoint now waits for its bounded reads and returns counts for
`complete`, `partial`, `unavailable`, `failed`, `deferred` and `persistenceFailed`.
The scheduler's completion means this collection ended, not that every post has
usable metrics. Provider results and persistence outcomes are separate.

Meta error 100/subcode 33 means the object cannot be read. It does not prove that
the post was deleted: permissions, the media ID and account association need
inspection. Do not delete records, infer zero engagement or repost the content.
Skip the second insights request for that inaccessible node and continue with
other posts. Account-wide access or rate-limit errors defer the rest of the
batch. The next normal daily job can recover; attempted rows have a 12-hour
cooldown within the existing seven-day recovery horizon.

The admin post table shows the latest attempt and reason separately from the
last metric snapshot. A wholly failed read does not erase previous counts or
advance `metricsFetchedAt`. A successful later read clears the error.

Migration `0027_instagram_metrics_attempt.sql` adds three nullable diagnostic
columns. Matching boot catch-up entries run after the original table creation.
No credentials or article text are included in the new operational logs.

## Source checks on 11 September 2026

- Guardian AU Business (`https://www.theguardian.com/au/business/rss`) was already
  corrected on main; a direct read returned HTTP 200 and 28 RSS items.
- NPR World (`https://feeds.npr.org/1004/rss.xml`) returned HTTP 200 and 10 items.
  The older 404 was not reproduced. The suffix-free URL returned 404 and was not
  substituted. A future failure remains a collection failure, not evidence of
  a quiet news day.

No imports, Instagram posts, insights refreshes or emails were manually
dispatched to verify these changes. The production admin page required sign-in,
so authenticated database records were not checked in this verification.
