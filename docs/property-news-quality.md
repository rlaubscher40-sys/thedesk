# Automatic news quality and freshness

The observed market-directory reference `/evidence/846` used the headline
“Perth Housing Market Update | April 2026 Emergency Alert Today (7Y9mHxXuGJ)”
under a September feed date. Geography and a recent ingestion date were not
enough to make this usable property evidence.

Shared deterministic holds now reject uncredited Google News/unknown publisher
results, explicit guaranteed-return/promotional headlines, market-update
headlines with a trailing video-like identifier, and date-labelled property
market updates at least three calendar months behind the selection date.
The last rule is narrow: older ABS observation periods, historical comparisons
and ordinary emergency-housing reporting are not automatically rejected.
These are conservative holds for automatic use, not a complete spam detector,
publisher rating, source allowlist or independent fact check. Legitimate
retrospectives or reporting about promotional claims may be held as well.

The daily importer requires AU and PROPERTY items to carry a parseable,
timezone-explicit feed timestamp within the last 96 hours. Four days allows
weekend catch-up; no collection date or missing-date fallback is substituted.
It applies this before clustering, article downloads and LLM enrichment.
Existing minimum-size and current-Sydney-date protections remain: a thin
ingestion can fail rather than pad the new day with old stories. Coverage
lanes retain their separate policy. No additional model, network or API call.

The same headline/publisher holds are applied during evidence normalisation,
market-directory selection and social property-story selection. This protects
selection from already-stored bad records without deleting them. Evidence
normalisation also excludes known overseas/Canadian Perth cases. Direct
archive URLs and old database region labels remain untouched.

## Publication dates carried into daily and weekly posts

Daily records now retain a nullable `sourceTiming` JSON object: normalized
feed-reported timestamp, publisher-declared original publication timestamp,
metadata status, and retrieval timestamp. `feedDate` remains the Sydney
briefing date. The new field is added by idempotent startup catch-up and the
matching SQL migration; existing rows remain null. No dates are backfilled.

The existing bounded article download now also parses `article:published_time`
and `datePublished` on article JSON-LD roots/graphs. It does not use modified
or created dates, visible prose dates, related-story objects, or the machine's
local timezone. Equivalent offset timestamps normalize to the same instant;
contradictory original dates, invalid metadata, future dates and original
publication more than 96 hours old hold the item. The HTML parser and JSON
graph walk are bounded. Malformed/unusually structured metadata can therefore
hold otherwise legitimate reporting; this is a conservative policy.

Feed timestamps are checked before article downloads. After the existing
fetch, the importer applies publication-date checks before sending the payload
or requesting model enrichment. The authenticated server repeats the checks,
retains the date record, and reports how many items were held. Thin AU batches
are not padded with stale replacements. Coverage lanes remain separate.

Automatic news carousels require a usable date record tied to their Sydney
briefing day. Freshness is evaluated when that briefing was collected, so a
weekly recap can use that week's dated reporting; existing current-day/week
and duplicate protections still govern actual publication. Legacy undated
rows stay readable but cannot enter new automatic daily/weekly posts. Normal
scheduled ingestion supplies the new records; no manual backfill or approval
is needed. The five verified ABS Reel recipes use their existing structured
evidence dates and are unaffected.

A recent feed timestamp can still qualify when the article lacks publication
metadata. Captions and story pages explicitly mark the original publication
date unconfirmed in that case. Publisher metadata is labelled as the
publisher's report, not independent verification. Weekly attribution reloads
these fields from the source record, never from an LLM's edition output.
Conflicting/invalid metadata cannot silently fall back to a fresh feed date.

This change covers daily-feed ingestion and source-backed daily/weekly social
selection. The separate `property_evidence` archive retains its RSS-derived
dates and existing headline/geography filters. Historical archive correction,
independent original-publication verification, broader source curation and
factual verification remain separate work. No new paid API, model request or
network fetch is added by publication-date extraction.

The six security findings noted during #194 were resolved separately in #195;
its full-main scan reported zero findings. Security workflows remain unchanged.

Metadata definitions: [Google Article documentation](https://developers.google.com/search/docs/appearance/structured-data/article).
