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

## Access-denial incident — 8 September 2026

Production reported RBA F1 HTTP 403 and HTTP 403 for every auction state.
The earlier 429 pacing change did not resolve source access. Successful tests
and a successful deployment must not be described as successful live collection.

Auction HTTP 401/403 now stops the entire publisher batch. Further Admin and
scheduler calls in that process return the access diagnosis without contacting
another state or retrying after a timer. Successful states before denial remain
stored, but are never combined with older states to fabricate Australia. The
pause is process-local; a restart creates a new collector. No access was granted
by this code change and no replacement auction observations were seeded.

### Concrete replacement: PropTrack Auction Results API

The publisher documents state, suburb and GCCSA queries, clearance rates and
scheduled/sold/passed-in/sold-before/sold-after/withdrawn counts. It documents
daily updates and selectable start/end dates:
https://www.proptrack.com.au/insights-hub/proptrack-apis-introducing-the-auction-results-api/

API access/trial route:
https://www.proptrack.com.au/products/property-data-and-insights/apis/
Developer documentation: https://developer.proptrack.com.au/docs/apis/home

The Desk needs approved API credentials and the authenticated endpoint/schema
before implementing this adapter. No credentials or approved subscription are
available in this work session. Do not invent endpoint paths or use public-page
cookies as API credentials. The commercial terms and eight-jurisdiction coverage
must be confirmed with the provider before making a purchase.

Prepared access request:

> We operate thedesk.au, an Australian property intelligence site. We need
> automated weekly statewide auction results for NSW, VIC, QLD, SA, WA, TAS,
> ACT and NT, with matching Monday–Sunday periods and explicit zero-result
> states. Please confirm Auction Results API access, documentation, pricing,
> quotas, preliminary/final revision handling, and rights to store and display
> attributed summaries on our public website and social posts. We need sold
> before/at/after auction, withdrawn, passed-in, scheduled and reported counts
> to calculate and label a weighted Australian rate. Please confirm availability
> for all eight jurisdictions, including weeks with small samples.

This request is prepared only; it has not been sent and no purchase is approved.

### Cash-rate alternative checked

The BIS public API responds with Australian daily policy-rate data:
https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/D.AU?format=csv&lastNObservations=10

The response explicitly identifies the Reserve Bank of Australia and the cash
rate target from August 1990. On this check the latest observation was
2026-08-27, older than the 2026-09-07 RBA observation already shown in production.
Do not overwrite the stored observation or relabel BIS data with today's date.
No BIS fallback was enabled because this response fails the existing seven-day
freshness requirement. BIS says daily observations are published in weekly
releases: https://data.bis.org/topics/CBPOL

Remaining work: obtain approved auction API access; confirm RBA F1 production
access; implement against the provider's actual schema; verify fetched values
and actual storage in production. Full live auction coverage remains blocked.
