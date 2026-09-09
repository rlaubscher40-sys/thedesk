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

Feed timestamps are still feed-supplied claims. The daily database retains its
existing feedDate (not a publisher timestamp), so social captions continue to
label it as the briefing/feed date. The importer freshness check is not proof
of independent publication-time verification for historical/manual payloads.
Neither named publisher attribution nor a passed hold establishes factual
accuracy. Broader source curation and preserving original publisher dates in
daily records remain separate work.

Security follow-up remains separate: the full main-branch CodeQL scan reported
six findings in sdk.ts, canonicalHost.ts, seo.ts and scheduledRoutes.ts. These
files are not modified by this change. PR-only scanning previously reported
zero; do not substitute that result for the full-main scan.
