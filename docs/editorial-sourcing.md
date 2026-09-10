# Story sourcing and selection

The Australian briefing serves property, lending, economics, advice, tax and markets. The Property lane stays focused on Australian housing. International finance belongs in Business; an Australian comparison does not change an overseas story's geography.

## Discovery and reading

The collector reads up to 20 entries from each Australian RSS feed before applying relevance and quotas. RBA interview/speech and ABS release indexes supplement RSS omissions. Direct realestate.com.au, Mortgage Professional Australia and The Adviser feeds supplement the existing ABC and Guardian feeds. Google queries remain discovery inputs, not publisher identities. The hourly evidence archive supplies additional candidates through the same checks.

The [10 September source audit](source-audit-2026-09-10.md) adds APRA, Cotality Australia, Treasury ministerial releases, Australian Broker, Professional Planner, Accountants Daily, SMSF Association, UDIA and Master Builders. Industry bodies are attributed advocacy with lower weighting than official releases and specialist reporting. Undated indexes run directly through daily article reading; only timestamped RSS excerpts enter the hourly archive.

Each run reads a bounded shortlist of up to 100 Australian candidates and 32 coverage candidates, six concurrent requests. This is an operational budget, not a claim that every available article was reviewed. Fetches retain the existing public-address validation, redirect checks, timeouts and download limits. Article extraction removes navigation and inactive content and retains up to 6,000 characters from a bounded 1MB page sample.

Each discovered publisher gets up to two initial reading opportunities before the remaining budget is filled in rank order. Article list findings are retained alongside paragraphs. Card headings exclude category/button text; headline cleanup preserves substantive clauses and reporting periods. Host-scoped publication-day adapters cover APRA and Treasury without treating modified/event dates as new publication.

## Publication gates

A source must resolve to a publisher. Australian stories need a relevant beat, Australian geography, a confirmed publisher date and sufficient readable text: 300 characters for designated official publishers, 650 otherwise. RSS summaries cannot replace missing reporting. Published summaries come from extracted article text, avoiding Google headline roundups. The headline and dek must establish the subject; unrelated page text cannot supply relevance. Designated official releases can establish the subject in their body when the title is generic. These are minimum evidence checks, not a guarantee of factual accuracy.

Publisher timestamps must be recent. An explicit release day, or conflicting clocks that agree on one calendar day, is retained as day-only evidence without an invented time. Contradictory calendar days, malformed metadata, future dates and old releases are held. A fresh Google timestamp cannot refresh an undated static page.

Traffic notices, tender details, static planning pages, event marketing, film reviews, stock-pick roundups and individual property promotions are held. General broker/advice and market reporting is routed to Australia rather than Property. Existing obvious reference and unrelated crime/obituary entries from the last 30 days are moved to an internal hold lane while preserving IDs and saved links. Public daily feeds, archive lists and weekly synthesis exclude that lane.

## Ranking and diversity

Eligible stories receive a deterministic significance score based on their beat, concrete developments, numerical reporting, available text and verified publisher domain. Search query names such as “Treasury” receive no source bonus. Australian publication requires a reviewed publisher domain and a score of at least 73. This prevents unreviewed publisher domains and low-consequence fillers from earning slots simply because the better stories were already published. This score measures editorial priority, not confidence or truth. Headline and summary identify the main beat before body text is used as a fallback.

Canonical duplicates are removed; conservative headline clustering selects the strongest readable representative of each event. Different feeds from the same publisher domain count once. Each lane has a maximum and each publisher has at most three stories per lane per run. No quota can rescue an ineligible story. A run without a relevant local story retains the existing briefing. Existing source URLs are excluded for 14 days.

Selection runs at 06:43, 12:43 and 18:43 Sydney time under the existing scheduler. A durable one-time rollout claim runs the first collection after deployment. The existing enrichment recovery worker handles selected stories.

## Review and benchmarks

Admin → Health → **Must-cover review** now saves a daily list of expected events, their rationale and original/alternative reporting links. Entries remain provisional until an editor marks them reviewed. The initial September 10 examples are explicitly provisional source checks, not a representative or human-approved benchmark. Later dates start empty; saved empty reviews stay empty.

The starting [RBA interview](https://www.rba.gov.au/speeches/2026/sp-dg-2026-09-08.html), [ABS dwelling-value release](https://www.abs.gov.au/media-centre/media-releases/value-dwellings-falls-03) and [NSW housing release](https://www.nsw.gov.au/ministerial-releases/226-new-social-homes-for-western-sydney-families) were checked against original source pages and matched actual live stories 3840044, 3840045 and 3840151 on September 10. All three matches are visible, while the editor-reviewed denominator remains zero until someone reviews the expectations. This spot-check is not a recall estimate.

The review compares the chosen Sydney day and preceding three days with actual public AU/Property rows. A selected candidate or an aggregate insertion count cannot establish publication. Other-section matches are shown separately; HOLD rows never earn coverage. Exact canonical links and manually supplied alternatives establish a match. Similar headlines alone do not. Tracking parameters are ignored, but article query IDs, path case and distinct URLs remain significant.

Saved collection decisions distinguish article holds, publisher reading caps, publisher publication caps and overall lane limits. Reports retain their total decision count before sampling, while old reports with unknown completeness remain labelled sampled. An unmatched event is **unknown**, not automatically missed: publication and run queries are bounded, run reports expire after 30 days, alternatives may be incomplete and older decisions are sampled. A source failure does not prove that all of its events were missed. The interface shows reviewed-event counts, not a “10/10” score or a claim about total news recall.

Reviews persist with the authenticated editor ID, save time and an optimistic version check, so another tab cannot silently overwrite them. The view recomputes results from currently stored evidence; it is not an immutable reconstruction of what a reader saw at an earlier time. Keep expectations independent of the selected feed and record them before judging outcomes. Reviewing only successful examples would bias the result. Multi-day outcomes still need editorial judgement before assigning a quality rating.

Admin → Health → Story sourcing and selection shows the latest run, discovered and read counts, published count, failed sources and each reading decision, plus a bounded sample of earlier exclusions. Reports are retained for 30 days; a failed collection is recorded. The report distinguishes selected stories from successful insertions.

Run `node --import tsx scripts/ingest/preview.ts` for a read-only live selection report. It uses the production selection function without database writes or model calls. Run `pnpm test scripts/ingest/lib/editorialPipeline.test.ts` for the labelled regression benchmark: the US housing leak, traffic/tenders/static planning, a meaningful twentieth feed entry, thin-paywall replacement, evidence-pool reuse, publisher identity and publication precision.

This remains a deterministic editorial filter. Conservative headline matching can miss paraphrased duplicates, publisher HTML can change, and sufficient text does not prove an extraction is complete. Source errors and held decisions must remain visible so these limitations do not silently become a weak briefing again.
