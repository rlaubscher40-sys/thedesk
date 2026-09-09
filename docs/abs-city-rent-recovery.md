# ABS city rent delivery and persistence

The existing Markets and Ask city-rent panel used the ABS CPI API. City rents
were not part of the persisted daily-metrics collection. An API outage could
therefore leave the panel unavailable and the stored metrics without rent trends.

This change adds the published CPI Table 11 workbook as a fallback and stores
the latest annual rent change for all eight capital cities through the existing
fenced metrics collector. Admin expects each city series and applies a 100-day
reporting-period review threshold. Regular scheduled collection also populates
metric history. No schema migration, LLM call or paid provider is added.

## Source and meaning

- [ABS CPI release](https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release)
- [Pinned API series](https://data.api.abs.gov.au/rest/data/ABS,CPI,2.0.0/3.30014.10.1+2+3+4+5+6+7+8.M?lastNObservations=2&format=csv): ABS CPI 2.0.0, annual percentage change, rents, original, monthly, regions 1–8.
- [Reviewed Table 11, July 2026](https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/jul-2026/6401011.xlsx)
- [ABS reuse and attribution terms](https://www.abs.gov.au/website-privacy-copyright-and-disclaimer): CC BY 4.0 for ABS material, subject to the stated exceptions.

These are annual changes in rents paid, updated monthly, for CPI capital-city
geographies. They are not the latest month's change, statewide rents, local
median dollar rents, asking rents, vacancy or yield. Canberra and Darwin do not
establish ACT-wide or NT-wide local rental coverage. No Census values are
inflated to fabricate contemporary suburb rents.

Stored keys follow `melbourne_rent_growth_annual`. The observation date remains
the first day of its labelled reference month, never the retrieval date. Source
links retain the exact API or dated workbook used. Ask's metric retrieval
requires the capital's name and excludes suburb/postcode/LGA, weekly median,
vacancy and yield questions. Existing local-rent evidence remains separate.

## Fallback and validation

The API is attempted first with a four-second deadline. A transport, schema or
response failure tries the official release page and its unique Table 11 link
under a combined eight-second deadline. A valid API response withholding all
current observations does not trigger fallback. Partial API responses retain
their gaps. A valid older API response stays dated; this is outage recovery,
not a claim that the API never lags the publication.

Only HTTPS on `www.abs.gov.au`, the exact CPI Table 11 filename and a completed
reference month are accepted. Redirects, ambiguous links and oversized streamed
bodies fail closed. Page and workbook limits are 2 MB and 1 MB. Workbook parsing
uses the existing ZIP validation and memory-limited worker. A specific CPI
profile permits up to 256 columns and 2,000 rows per sheet; other collectors
retain their existing limits.

Table 11 contains two identically labelled rent series per city. Both reviewed
IDs, full labels, units, original adjustment, monthly frequency and end dates
are checked. The two current values must agree. Missing, non-numeric, footnoted
or divergent latest values withhold that city instead of substituting an older
number. The workbook may incorporate revisions without cell-level flags, which
the panel and stored context explain.

Successful combined reads are cached for one hour, failed attempts for one
minute. Discovery happens before workbook-cache lookup. Parsed workbooks are
cached by exact dated URL for six hours, limiting repeated downloads during API
outages while allowing same-URL revisions to be picked up later. Caches are
process-local; this is not a persistent conditional-download measurement.

## Actual-source validation

The 9 September 2026 download of Table 11 was 459,926 bytes, SHA256
`aab708a2c478c77140abb17cca6c65173070cdddd5c68e3574c17beac07170b7`.
The complete file passed the production ZIP/worker/parser path. The test fixture
retains original metadata, rent columns and June/July rows from that file,
alongside an independently downloaded API CSV. All 16 city/month observations
agree between the two representations. Fixtures are ABS data, CC BY 4.0.

Tests exercise discovery, identity changes, missing/flagged/conflicting values,
zero/negative values, cache reuse, stream limits, persistence handoff, geography
filtering, freshness and the rendered source link. Live verification must not
force an API outage or invent production observations to exercise fallback.
