# Verified quarterly housing coverage

Source review: 17 September 2026. Owner/operator: Ruben Laubscher.

## Acceptance criteria implemented

- ABS Total Value of Dwellings, June quarter 2026, table 2: median sale prices and recorded transfers, separately for established houses and attached dwellings. Eight capitals and seven rest-of-state areas; eight quarters retained (120 area-quarter records, four measures each).
- ABS Building Activity, March 2026, table 39: original dwelling completions, all sectors/building/work types, for all eight states and territories. Eight quarters retained (64 state-quarter records); each annual count sums four consecutive quarters.
- Exact release title/reference quarter, dated download, catalogue/table, unique series headings/IDs, unit, adjustment, frequency, collection month, series end and consecutive quarters are checked. Changed contracts fail closed. Suppression remains unavailable; zero counts remain zero.
- Fixed ABS origins/download patterns, redirect rejection, bounded responses, off-thread XLSX parsing, request coalescing, six-hour success cache and one-minute failure cache. No new package, paid service, credentials or schema migration.
- Public market files and historical readers retain source, geography, segment, basis, revisions and exact quarter. Historical links never substitute current data. Regional cities do not inherit rest-of-state medians.
- Ask factual lookups require a complete supported request and exact matching packed citations. Broader current city questions can use labelled sales and state construction context under the existing synthesis/review process. Unsupported secondary questions cannot use the direct-answer shortcut.
- Source-reviewed Glenden correction distinguishes introduced legislation from enacted repeal. Exact source/ID/prior-value guards preserve later edits. Public correction notice retained; distributed copies are not rewritten.
- Shared claim checks reject recognised proposed-repeal-to-enacted wording. Portfolio-only ministerial summaries are suppressed across standard readers and evidence; Markets search uses the same excerpt rules.

## Sources and interpretation

- [ABS dwelling transfers release](https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/jun-quarter-2026): table 2, `643202.xlsx`. Unstratified medians are sensitive to sales mix, not a price-growth index. Transfers are sales, not listings. Preliminary values and the most recent ten quarters can be revised.
- [ABS building activity release](https://www.abs.gov.au/statistics/industry/building-and-construction/building-activity-australia/mar-2026): table 39, `87520039.xlsx`. State original counts differ from national seasonally adjusted counts. They are not starts, approvals, city estimates or net stock additions after demolition.
- Fixtures preserve source metadata and the last twelve observed rows; dates are revived before parsing. Live complete workbooks were separately parsed successfully during implementation. Latest capital medians/counts and every state quarter/year total have explicit expected-value checks.

## Remaining evidence boundaries

Verified rental yields and current listings remain unavailable here. The public SQM listings/yield pages returned HTTP 403 during source verification. No alternate access path or paid licence was assumed. Do not manufacture yields from unmatched rent and sale series, or relabel transfer counts as listings.

[ABS household projections](https://www.abs.gov.au/statistics/people/population/household-and-family-projections-australia/latest-release), released 28 June 2024, model 2021–2046 under three living-arrangement assumptions. These are scenarios, not observed current household formation. Population growth is not a substitute for household growth.

City/suburb employment, local completions and local price coverage outside the published ABS transfer areas remain explicit gaps. State context is useful but does not close those local measures. The shared rules catch bounded classes of factual errors; they are not a certification of universal editorial accuracy. Continue original-source sampling and exact corrections.

Private provider recovery/security evidence, real-phone journeys, consent/licence/cost records, the deferred Cloudflare work and seven-day reader outcomes retain the audit's existing completion criteria. Excluding them from a discussion does not manufacture evidence that they passed.
