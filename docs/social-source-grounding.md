# Source-led social publishing

The social review found that matching a number did not prove a headline kept
the source's city, direction, measure or period. Cached hooks and commentary
could bypass even that numeric check. Automatic publishing also inherited the
website's archive fallback when a day's ingestion was empty.

## Publication rules

- Daily posting explicitly reads the current Australia/Sydney date and rejects
  rows from another date. Date overrides cannot publish old or future material.
  Weekly posting requires the current Sydney ISO week's edition. Empty current
  evidence returns 422, so the scheduler cannot record it as a published success.
  Existing bounded attempts can recover if ingestion finishes within the slot.
- Daily property headlines remain the feed headlines. The manual Wider Lens
  still has its separate legacy generator; it is outside the automated property
  programme. Daily posts no longer call or persist social hook/angle generation.
- Both cached and newly supplied daily commentary are replaced with fixed,
  topic-specific reading questions. These explain what to check rather than
  adding a causal claim, local forecast or investment verdict. This is not
  independent verification of the upstream feed or original source article.
- Weekly topics use property/financing relevance in their title and summary,
  with duplicates removed. Categories and generated angles cannot manufacture
  relevance. The social version omits the edition-wide take and unchecked
  takeaway/watch predictions; its original topic headline and summary remain.
  Structured source provenance for weekly synthesis is still a separate gap.
- Preview preparation follows these same copy rules, while explicit archive
  preview dates remain available. It is still a card preview, not confirmation
  of the latest Instagram grid or full account publication.
- Daily captions link to each actual story, with stable per-story campaign
  attribution and an Archive/search instruction. Weekly captions link to the
  edition number; stat cards link to Markets. Only the verified city-comparison
  Reels retain the Brisbane/Perth destination. Caption links are not a promise
  of Instagram clickability, nor evidence of visits or conversions.
- Daily covers filter the metric strip to existing property/cash-rate keys.
  The rent Reel's hook asks where rents changed faster, matching its evidence.
  Its permanent topic/month identity, voice, subtitles and publication locks
  are unchanged. A copy edit does not republish a completed comparison.

## Validation and remaining work

Regression tests exercise both scheduled/ingest HTTP handler functions, Sydney
daylight-saving and week/year boundaries, stale overrides, mismatched rows,
empty/unrelated editions, the real daily renderer entrypoint with fabricated
cached commentary, caption identity and property-only metric strips. Captions
that cannot retain complete source claims within the limit fail before upload.
CI also renders both verified narrated/subtitled formats.

This release fixes publication freshness, additional social rewrite risk and
destinations. It does not prove original source truth or guarantee growth.
Weekly cover hierarchy/mobile metadata, fuller weekly provenance, durable
story-level cross-run identities for legacy carousels, more verified Reel
topics and live account/retention review remain follow-up work. Existing legacy
carousel retry behaviour is unchanged; stronger Reel locks are preserved.
