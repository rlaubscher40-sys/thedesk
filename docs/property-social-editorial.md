# Property social editorial pilot

This change is stacked on `fix/social-stat-claims` (PR #150). Review and land
that claim-safety change first; do not replace the recorded-reading qualifiers.
Nothing in this branch publishes a post or changes a schedule or credential.

## Selection

- The daily carousel selects sourced AU/PROPERTY stories using their headline
  and summary. Direct housing/rental/mortgage stories lead, financing stories
  follow. Priority breaks ties within those tiers. Generated implications and
  category labels cannot by themselves earn a slot.
- Duplicate IDs, normalized headlines and identical source URLs are suppressed.
  This is not semantic clustering or independent corroboration.
- Unrelated news cannot fill empty daily slots. The scheduled route reports a
  successful skip when no eligible stories exist. Existing content generation
  can still reject selected stories; no blank slides are introduced.
- The manually requested Wider Lens keeps its existing broader selection.
- Stat cards and Reels first consider the existing auction-clearance,
  dwelling-value, mortgage-arrears and building-approvals keys, then cash rate.
  The existing numeric picker must still find a sufficiently fresh, supported
  angle. No new series is accepted by its label or group alone.
- Preview uses the same selection, with the existing explicitly marked
  zero-score rehearsal fallback restricted to eligible metrics. Scheduled
  publishing never uses that fallback.

Relevance tiers are editorial heuristics, not confidence scores or evidence of
causation. They do not upgrade the provenance of existing ingested metrics.
Verified population/migration, lending and planning integrations remain separate
work. Approvals remain approvals, never completed homes.

## Conversion and measurement

Daily, stat and Reel captions link to the existing free Brisbane–Perth route.
They describe rent evidence, dates and gaps, not an investment winner. The Reel
caption also retains the source label when present and scopes its history claim
to stored readings.

Each URL uses `utm_source=instagram` and a distinct existing-attribution campaign:
`property_editorial_carousel`, `property_editorial_stat`, or
`property_editorial_reel`. Including format in the campaign is intentional:
current attribution stores campaign ahead of medium. No analytics schema,
tracking identifiers or extra external service is introduced.

This does not make Instagram caption URLs tappable, change the mobile bio link,
or pin anything. Mobile profile-link setup remains necessary for a low-friction
path. Campaign visits can measure arrivals, not prove editorial changes caused
follower growth. Inspect eligible-story coverage, reach, non-follower reach,
profile visits, comparison arrivals and signups after an approved deployment;
do not interpret fewer posts alone as failure or more posts alone as success.

## Review checks

- Unit regressions cover irrelevant high-priority stories, misleading categories
  and generated copy, duplicates, thin days, stale/missing history, unrelated
  metric labels, unchanged scoped facts, cash-rate fallback and preview parity.
- Caption tests verify the live route and actual `parseArrival` campaign output.
- Full Vitest suite and strict TypeScript must pass on the exact PR head.
- Publication, rate limits, quotas, uncertain-publish recovery and trusted
  server share payloads are not changed. No production run was invoked.
