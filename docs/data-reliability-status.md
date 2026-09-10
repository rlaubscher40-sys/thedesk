# Data reliability pass, 9 September 2026

The original scope was to make collected data reliable across Ask, Markets and Signals before adding connectors.

| Area | Implemented and checked |
| --- | --- |
| Geography and evidence | State-specific retrieval checks across all eight jurisdictions; postcode/state disambiguation; dated local-rent answers and citations. This does not imply local rental feeds exist for every jurisdiction. |
| Freshness | Reporting periods remain distinct from retrieval/check dates. Older observations cannot become current merely because a collection succeeds. Exact building-approval Signal links use validated, dated structured answers. |
| Source grounding | Structured metric questions select matching metric evidence; citation bounds and an independent evidence review fail closed when unavailable. General generated answers still require monitoring because model review is probabilistic. |
| Collection efficiency | Persistent cooldowns; conditional HTTP validation; changed files parsed once; conservative article identities; transactional duplicate claims; actual downloads and estimated avoided bodies shown separately. Savings are not claimed before measured responses occur. |
| Coverage reporting | Admin distinguishes stored data, blocked access, failed collection, source suppression and sample withholding. Missing records alone are not called unpublished. |
| Story recovery | New eligible stories and AI jobs commit together; fenced recovery, three-attempt limits, preserved presets/manual edits and completed-result protection. |
| Daily delivery | Separate timed delivery recovery; completed-story readiness; frozen email requests; provider idempotency; current consent checks; bounded retries; Admin visibility. |

Existing external gaps remain explicit:

- Auction imports require an approved source. A Domain help link is not a data licence or API approval.
- SA automated rental collection is paused after publisher HTTP 403. The reviewed release remains available; automated freshness is not claimed.
- VIC has a reviewed historical LGA rental import ending September 2025. Daily DataVic catalogue checks download only a newer listed quarter, and Admin supports previewed workbook uploads. A catalogue success is not a successful file download; ACT/NT local rental feeds remain unconfigured. See `victoria-reviewed-rents.md`. Other available jurisdiction evidence is not presented as a substitute local rental measurement.
- Conditional download savings and production recovery counters populate through normal eligible scheduled runs. Cooldowns, access pauses and subscriber consent are not bypassed to manufacture verification results.

This closes the implementation work in this reliability pass, including the daily-delivery handoff discovered during the final check. It does not claim every source is available, every generated answer is infallible, or every stage of the wider publishing system has durable recovery. No paid provider, new trial, historical AI backfill or artificial production email was added for this pass.
