# Published market metrics

The normal daily collection and Admin refresh use the same publisher readers.
The previous headline-only model step is retired for these managed metrics;
its authenticated endpoint delegates to the publisher refresh for old clients.
Missing sources are reported individually and existing observations are retained.
No collector substitutes today's date for an unknown reporting period.

## Auctions

- Read realestate.com.au's summary for NSW, VIC, QLD, SA, WA, TAS, ACT and NT.
- Store statewide/territory keys such as `nsw_auction_clearance` and preserve
  the Monday–Sunday reporting week, source URL, sold, reported and scheduled counts.
- Reconcile reported outcomes with sold before/at/after, withdrawn and passed in.
  Private sales and unreported scheduled auctions are excluded from the rate.
- `auction_clearance` is The Desk's weighted Australian average, calculated
  from total sold / total reported only when all eight jurisdictions return
  the same week in the current collection. Never combine older stored states,
  other providers, rounded percentages or city-only figures.
- A known zero-outcome state is included in completeness checks with zero
  weight. An entirely empty week has no rate. Fewer than ten outcomes are
  flagged as a small sample. All rates are preliminary, not final results.
- Markets displays all eight jurisdictions and Australia, reporting dates,
  sample counts and links. Ask scopes state auction metrics to the question.

Method: https://help.realestate.com.au/hc/en-us/articles/115002044526-How-to-calculate-clearance-rates

### Publisher rate limits

Auction requests are sequential, with a one-second gap. Concurrent callers in
the server share one attempt. A 429 ends that publisher's batch immediately;
Admin refresh and scheduler calls honour Retry-After and an increasing pause
(at least one hour). Complete successful collections are reused for six hours
with their original reporting dates. Partial results are saved once and are
not re-saved during cooldown. These controls are process-local: deployments
and independent CLI processes start new lifecycles.

The production server returned 429 for every state after the first deployment.
Backoff controls request volume; it does not prove the publisher will grant
server access. Auction coverage remains unavailable until a permitted request
succeeds. Do not rotate IPs, move scraping to another runner, change identity
or use proxies to evade a publisher refusal. An approved data feed is needed
if the restriction persists. Domain's documented weekly auction API is city
based, so it cannot silently replace statewide results or an all-state total.

## Monthly and bank releases

- `consumer_confidence`: Westpac–Melbourne Institute headline sentiment index,
  discovered from Westpac IQ. Its current-month reading must agree with the
  publisher's release date. Percent changes and sub-indices are not substituted.
- `dwelling_value`: Cotality HVI national median dwelling value in AUD, read
  from its linked public Infogram table by row and column labels. The actual
  data month is retained, distinct from the following month's release title.
- `mortgage_arrears`: CBA Group's explicitly published 90+ day home-loan arrears
  reading from its profit announcement, including New Zealand retail portfolios.
  This is labelled as CBA Group, not an Australian industry rate. It must not be
  compared directly with APRA's broader non-performing-loans measure.

PDF text is read using unpdf; no model inference is used. Downloads have fixed
publisher hosts, redirect checks, whole-request time limits and byte limits.
PDF processing is restricted to the first 45 pages. Release readers fail visibly
when labels, geography, dates, table structure or definitions cannot be verified.
Operational age thresholds prompt review; they are not source publication SLAs.

Regression coverage: `scripts/ingest/publishedMetrics.test.ts`, metric health,
refresh reporting, ingestion diagnostics and Ask geography tests.
