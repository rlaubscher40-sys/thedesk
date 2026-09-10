# Story sourcing and selection

The Australian briefing serves property, lending, economics, advice, tax and markets. The Property lane stays focused on Australian housing. International finance belongs in Business; an Australian comparison does not change an overseas story's geography.

## Discovery and reading

The collector reads up to 20 entries from each Australian RSS feed before applying relevance and quotas. RBA interview/speech and ABS release indexes supplement RSS omissions. Direct realestate.com.au, Mortgage Professional Australia and The Adviser feeds supplement the existing ABC and Guardian feeds. Google queries remain discovery inputs, not publisher identities. The hourly evidence archive supplies additional candidates through the same checks.

Each run reads a bounded shortlist of up to 100 Australian candidates and 32 coverage candidates, six concurrent requests. This is an operational budget, not a claim that every available article was reviewed. Fetches retain the existing public-address validation, redirect checks, timeouts and download limits. Article extraction removes navigation and inactive content and retains up to 6,000 characters from a bounded 1MB page sample.

## Publication gates

A source must resolve to a publisher. Australian stories need a relevant beat, Australian geography, a confirmed publisher date and sufficient readable text: 300 characters for designated official publishers, 650 otherwise. RSS summaries cannot replace missing reporting. These are minimum evidence checks, not a guarantee of factual accuracy.

Publisher timestamps must be recent. An explicit release day, or conflicting clocks that agree on one calendar day, is retained as day-only evidence without an invented time. Contradictory calendar days, malformed metadata, future dates and old releases are held. A fresh Google timestamp cannot refresh an undated static page.

Traffic notices, tender details, static planning pages and individual property promotions are held. Existing obvious reference entries from the last 30 days are moved to an internal hold lane while preserving IDs and saved links. Public daily feeds, archive lists and weekly synthesis exclude that lane.

## Ranking and diversity

Eligible stories receive a deterministic significance score based on their beat, concrete developments, numerical reporting, available text and verified publisher domain. Search query names such as “Treasury” receive no source bonus. This score measures editorial priority, not confidence or truth. Headline and summary identify the main beat before body text is used as a fallback.

Canonical duplicates are removed; conservative headline clustering selects the strongest readable representative of each event. Different feeds from the same publisher domain count once. Each lane has a maximum and each publisher has at most three stories per lane per run. No quota can rescue an ineligible story. A run without a relevant local story retains the existing briefing. Existing source URLs are excluded for 14 days.

Selection runs at 06:43, 12:43 and 18:43 Sydney time under the existing scheduler. A durable one-time rollout claim runs the first collection after deployment. The existing enrichment recovery worker handles selected stories.

## Review and benchmarks

Admin → Health → Story sourcing and selection shows the latest run, discovered and read counts, published count, failed sources and each reading decision, plus a bounded sample of earlier exclusions. Reports are retained for 30 days; a failed collection is recorded. The report distinguishes selected stories from successful insertions.

Run `node --import tsx scripts/ingest/preview.ts` for a read-only live selection report. It uses the production selection function without database writes or model calls. Run `pnpm test scripts/ingest/lib/editorialPipeline.test.ts` for the labelled regression benchmark: the US housing leak, traffic/tenders/static planning, a meaningful twentieth feed entry, thin-paywall replacement, evidence-pool reuse, publisher identity and publication precision.

This remains a deterministic editorial filter. Conservative headline matching can miss paraphrased duplicates, publisher HTML can change, and sufficient text does not prove an extraction is complete. Source errors and held decisions must remain visible so these limitations do not silently become a weak briefing again.
