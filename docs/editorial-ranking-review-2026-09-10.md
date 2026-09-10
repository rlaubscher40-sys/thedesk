# Ranking review — 10 September 2026

The previous score mixed suitability with importance. Publisher reputation contributed up to 16 points, article length four points, arbitrary digits four points, and generic event-word fragments eight points. In the 145-row public feed snapshot after PR231, generic RBA interviews scored 89, a mortgage product partnership 85, and a NSW housing delivery announcement 78. Those are persisted historical scores, not a validated editorial ordering.

This change retains the eligibility gates and replaces ranking for newly collected Australian stories with headline-based significance and a small publisher tie-breaker. It also reduces the direct-index discovery bonus from 40 to four and replaces article-length ties with original publication recency. No historical rows, manual priorities, source schedules or social posts are changed.

## Calibration

These are explicit implementation preferences checked against actual feed headlines, not human-reviewed labels or a recall benchmark. The comparison is a read-only replay; these scores were not written back to the old feed.

| Source example | Stored priority | New ranking |
| --- | ---: | ---: |
| [ABS dwelling values release](https://www.abs.gov.au/media-centre/media-releases/value-dwellings-falls-03) | 85 | 92 |
| [NSW Western Sydney social housing announcement](https://www.nsw.gov.au/ministerial-releases/226-new-social-homes-for-western-sydney-families) | 78 | 85 |
| [MPA Mortgage Choice/Skip partnership](https://www.mpamag.com/au/news/general/mortgage-choice-partners-with-skip-on-new-low-deposit-loan/589120) | 85 | 69 |
| [RBA ABC interview](https://www.rba.gov.au/speeches/2026/sp-dg-2026-09-08.html) | 89 | 78 |

The ABS and MPA originals were rechecked on 10 September. The partnership contains actual product terms and remains eligible when all checks pass; its lower ranking is a preference for broader developments, not a finding that its reporting is false. NSW and RBA are the previously verified source examples recorded in the sourcing audit.

## Verification and limits

Regression cases compare stronger developments with routine specialist reporting, predictions with actual decisions, reporting months with modal verbs, generic interviews with housing supply, and publication recency with text length. A pipeline fixture exercises the three-story publisher cap so the stronger story earns a slot, with deliberately different article evidence to avoid conflating ranking and duplicate suppression. Original-date and readable-text gates still apply even when an eligible story's displayed priority is below 73.

This is a bounded lexical policy. It can under-rank an important generic headline or misinterpret an ambiguous one; it does not estimate people affected or economic magnitude. A question headline defaults to analysis, even if the original contains substantial investigation. Housing announcements of different sizes share a band. International ranking remains unchanged, and social selection still applies its existing property relevance tiers before priority. Existing stories keep their saved priority, including manual overrides. Multi-day independent must-cover reviews remain necessary before judging overall quality.
