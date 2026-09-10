# Source and downstream editorial audit — 10 September 2026

## Verdict

The follow-ups below add seven further direct routes (83 total inputs, 41 direct), repair nested article extraction, and support bounded SQM PDF releases. The latest additions recover ASIC and Victorian releases through their public newsroom searches. Earlier findings describe the first release; resolved gaps are explicitly updated below.

Add nine direct discovery sources, with article-level gates and regression tests. This materially improves direct property-data, prudential, lending, advice, tax and construction coverage. It does **not** establish a 10/10 briefing or comprehensive recall of the day's best stories.

The audit tested 34 candidate publisher endpoints (including The Conversation's existing feed as a control), followed two advertised feed alternatives, checked all 67 existing discovery inputs, and sampled three articles from each of the nine additions. HTTP success alone was not an acceptance criterion. Publisher HTML was downloaded read-only and evaluated with the production parsing and selection functions; no model calls, database writes or social posts were used for the audit preview.

## Coverage and transport findings

- Existing inventory: 43 national/global inputs plus 24 state/territory search queries, 67 total. Of these, 42 were Google discovery inputs and 25 were direct publisher inputs.
- New inventory: 76 inputs, including 34 direct publisher inputs. Google dependence falls from 63% to 55% of configured inputs; this is an inventory ratio, **not** a readership, story-quality or successful-delivery metric.
- One bounded transport check returned usable discovery from 66 of 76 inputs and 1,166 candidate links. Nine Google inputs timed out and CNBC returned HTTP 403. All nine additions returned usable discovery. These results reflect this audit environment and are not production availability statistics or an SLA.
- Timed-out inputs: RBA & Cash Rate; APRA & Lending; South Australia regional; Tasmania government; all three ACT queries; Northern Territory housing and regional. Retain the queries, surface failures, and use direct sources as additional routes. Do not interpret a timeout as absence of news.
- Of the three article samples per addition, each publisher supplied at least one fresh, relevant article with usable text and publisher publication evidence. Other samples correctly remained old, off-beat, reference material or promotional. This is a small operational sample, not a statistical estimate of precision or recall.

## Additions

| Publisher and discovery endpoint | Contribution | Treatment / sample finding |
| --- | --- | --- |
| [APRA](https://www.apra.gov.au/news-and-publications) | Prudential rules, retirement reporting and regulatory releases | Official source. Read explicitly labelled publication day. Keep staff profiles and recurring statistics landing pages out of the news briefing; actual releases remain eligible. |
| [Cotality Australia](https://www.cotality.com/au/insights) | Original housing research and chart packs | Restrict discovery to `/au/insights/articles/`; exclude marketing/analysis/hazard landing pages. September chart pack was current; September 1 and August 27 samples were not new news. |
| [Treasury ministerial releases](https://ministers.treasury.gov.au/ministers/jim-chalmers-2022/media-releases) | Tax legislation and fiscal-policy announcements | Official statement, not independent assessment of government claims. Use declared publication day; older releases remain held. Minister-specific route needs review when portfolios/site structure change. |
| [Australian Broker](https://www.brokernews.com.au/rss) | Lending conditions, borrower trends and broker reporting | Specialist newsroom. General rates/advice stories route to Australia; housing stories can enter Property. Vague headlines without an established housing/economic subject remain held. |
| [Professional Planner](https://www.professionalplanner.com.au/feed/) | Advice fees, superannuation and adviser-sector policy | Specialist newsroom. Current advice-pricing research and SMSF-policy reporting were readable and dated. Broad promotional firm profiles did not qualify automatically. |
| [Accountants Daily](https://www.accountantsdaily.com.au/news?format=feed&type=rss) | Tax compliance, court decisions and adviser/accountant consequences | Specialist newsroom. Tax-residency and construction-approval samples were usable. Preserve day precision where publisher clocks disagree within the same day. |
| [SMSF Association](https://www.smsfassociation.com/feed) | Sector submissions, tax/super policy and industry responses | Industry advocacy, weighted below official sources and specialist reporting. Retain attribution; event-day publicity and old submissions stay out. |
| [UDIA National](https://udia.com.au/feed/) | Housing supply, development constraints and policy responses | Industry advocacy. Current affordability response was readable; older HAFF/EPBC statements remain dated evidence, not today's news. |
| [Master Builders Australia](https://masterbuilders.com.au/feed/) | Construction workforce, productivity and delivery constraints | Industry advocacy. Workforce/data releases can qualify; generic television-interview titles do not borrow their subject from unrelated body text. |

Useful article-level checks include [Cotality's September chart pack](https://www.cotality.com/au/insights/articles/high-end-homes-lead-market-downturn-as-affordable-properties-prove-resilient), [APRA's retirement reporting consultation](https://www.apra.gov.au/news-and-publications/apra-revises-proposals-implement-governments-retirement-reporting-framework), [Professional Planner's advice-fee research](https://www.professionalplanner.com.au/2026/09/asset-based-fees-dwindle-as-firms-price-for-complexity-not-wealth/), and [Accountants Daily's tax-residency report](https://www.accountantsdaily.com.au/tax-compliance/22876-federal-court-backs-ato-on-tax-residency-dispute). These identify audit fixtures, not endorsements of every assertion or financial advice.

## Candidates not enabled

| Candidate(s) | Observed limitation / decision |
| --- | --- |
| Property Council, Grattan, Australian Property Investor, SMSF Adviser, IFA, Financial Standard, REIWA | Tested endpoints returned 403. No access-control workaround attempted. Approved access or a separately verified permitted feed is required. |
| Money Management | `/rss.xml` returned 404 and advertised `/feed/`; that feed returned 403. Not enabled. |
| Domain | Feed request did not complete within the bounded request. No verified direct addition in this audit. Existing search discovery remains. |
| ASIC, HIA, REIQ | Listing pages returned HTML but did not expose a usable set of current article links to the static collector. Need a verified supported discovery adapter, not a misleading HTTP-200 health check. |
| AHURI, ATO, NAB economics, REIA, The Urban Developer | Tested candidate routes returned 404 or no usable feed. These are unresolved route gaps, not findings that the publishers offer no valuable reporting. |
| Housing Australia | Sample pages supplied valid dates but only 124–295 extracted characters. Do not lower the evidence threshold to admit them. Needs a targeted extraction adapter and fresh samples. |
| NHSAC | Annual/reference material in sampled listings; dates were not recognised by the generic parser. Keep out of daily discovery until dated-release extraction is validated. Its research remains valuable background. |
| Productivity Commission | Tested release index exposed material through March 2025, not current releases. Needs current-route discovery before enabling. |
| PropTrack | Tested insights listing/feed route did not establish reliable current discovery; already reachable through realestate.com.au reporting. Do not count a second endpoint as independent coverage. |
| SQM Research | Media index includes PDF releases. Current news article reader is HTML-only; needs a bounded PDF/date adapter. Existing metric collectors are a separate path. |
| Your Investment Property | `/rss` returned 404, but its advertised `/feed` worked. Latest item was an awards story, followed by older guides/reports. No incremental current hard-news benefit established in this sample, so not enabled. |
| CBA newsroom | Usable HTML listing, but mixes releases and evergreen explainers. Not enabled as a broad news source without article-type/date validation. Existing verified metrics collection is separate. |
| The Conversation | Existing business Atom feed worked; no duplicate source added. Still requires story-level Australian geography and beat relevance. |

## Defects fixed during the audit

1. APRA's publication label occurred around character 643,000, beyond the previous 512KB date-parser budget. Date parsing now uses the same bounded 1MB sample as article extraction, with a host-scoped `Published` adapter. Updated/event dates do not qualify.
2. Treasury's explicit `dcterms.date` is recognised only on the ministerial host and retained as a calendar day. Contradictions, invalid days and old dates remain held.
3. Linked cards use their heading, not category/button text, so an unrelated article cannot gain a housing subject from its listing category.
4. Headline hygiene no longer drops an arbitrary short clause after a dash. Reporting periods such as “September 2026” and substantive tax/SMSF clauses survive ingest and client rendering. Explicit Google publisher suffixes still disappear.
5. Research findings in article lists are retained alongside paragraphs, with navigation removed and existing text limits intact.
6. Advice/tax/conduct vocabulary recognises ordinary financial-advice, tax-residency, CGT/GST and regulatory-sanction language. This does not waive date, Australian scope or text checks.
7. Reading allocation gives each discovered publisher up to two initial opportunities before filling the remainder by rank, within the existing 100-local/32-coverage request budget. An index bonus cannot by itself consume every reading slot.
8. Undated indexes are no longer advertised as successful hourly excerpt harvests. They are read directly at the three daily editorial runs; RSS additions also enter the hourly evidence path. Crawl time never becomes publication time.
9. Social property selection recognises home values, property markets and residential approvals while retaining explicit overseas-story rejection. An advice/tax article can be valuable on The Desk without qualifying for a property carousel.
10. Live dry-run review caught APRA staff profiles and recurring statistics landing pages before release; these are explicitly held, even when the publisher exposes a fresh page date. APRA index discovery also requires the publisher's declared news-card type, excluding supporting consultation letters that otherwise duplicate the announcement.

## Downstream boundaries and remaining work

- The Desk's AU/Property stories go through source resolution, original date, readable evidence, geography, subject, duplicate and priority checks before enrichment. Weekly synthesis consumes the eligible stored feed.
- Property socials apply a narrower headline/geography/date test. A channel label or generated Australian comparison is not proof of relevance. Preview checks do not post to a social account.
- Statistical Reels use separately curated metric series, provenance, freshness and history checks. Adding news feeds does **not** add or verify numeric series, guarantee a Reel, or prove social delivery. No metric or social-publishing configuration was changed by this audit.
- Multiple outlets repeating a claim are not independent factual verification. Existing outlet counts are distribution counts; shared ownership and syndication require care. Industry-body statements must remain attributed positions.
- Major unresolved coverage gaps: reliable direct state/regional releases beyond Google, blocked/paywalled newsrooms, PDF research releases, and some official listing adapters.
- To earn a quality rating, maintain a human-labelled daily must-cover list and compare discovered/read/published results over multiple days. Measure missed important events, off-beat admissions, duplicate clusters, source failures and downstream holds. Passing tests and a bigger source list are not substitutes for that record.

## Reproduction and operational review

`node --import tsx scripts/ingest/preview.ts` performs read-only production selection with source outcomes and held reasons. `node_modules/.bin/vitest run scripts/ingest/lib/sourceAudit.test.ts` runs deterministic audit regressions without network requests. Admin → Health → Story sourcing and selection retains actual production reports; inspect failed sources and reading-budget exclusions as well as published counts.

Local validation covered TypeScript, the frontend production build and the focused source/extraction/geography/social tests. The wider non-video local run passed 1,604 tests, with 30 database-dependent tests skipped; final release CI is the authority for the complete database/video suite. See the associated pull request for its exact result and deployment status.

## Follow-up: regional releases and research

Eleven regional/official/research discovery pages were probed, with article and PDF samples downloaded read-only. Five verified routes are enabled. Static discovery from those pages returned 40 configured candidate links (12 NSW, 12 Queensland, 8 Housing Australia, 2 AHURI, 6 SQM); these are discovery counts, not 40 publishable stories.

| Added route | Verified contribution and limits |
| --- | --- |
| [NSW ministerial releases](https://www.nsw.gov.au/ministerial-releases) | Its publicly advertised anonymous search endpoint exposes ministerial release links. Query housing/rent/planning/homes headlines, require published ministerial records and sort by the publisher's display date. Validate the type and same-origin release path again in the adapter. Search timestamps never become article publication evidence. The September 10 Western Sydney social-homes sample produced 2,569 readable characters and passed the actual editorial assessor. |
| [Queensland housing search](https://statements.qld.gov.au/?Search=True&Text=housing) | Uses the site's native search form, preserving links to individual releases. The leading riverfront housing release supplied 4,679 characters and its original September 6 timestamp; it was correctly too old at the time of checking. This is a future monitoring route, not a reason to republish old news. |
| [Housing Australia](https://www.housingaustralia.gov.au/media) | The HTML reader's closing-tag regex stopped at nested introduction sections. Selecting and serializing the complete DOM article restores the underlying body: the three previously short samples now contain 3,282, 3,762 and 1,383 characters. Original dates remain intact; the chair appointment is held as a staff announcement. |
| [AHURI research news](https://www.ahuri.edu.au/insights/latest-news) | Correct verified route replaces the earlier unsuccessful candidate. The children's rental-housing research sample supplied 3,805 characters and the visible original day, August 27. Recognise its `page-date` field only on AHURI; retain day precision and hold old research and board appointments. |
| [SQM Research media](https://sqmresearch.com.au/media) | Follow only dated `/uploads/` PDF releases on the audited host. Two real PDFs were parsed, and the listings release's first page was visually inspected. Listings: September 1 release concerning August, 1,911 retained characters. Vacancy: August 13 release concerning July, 679 characters. Both are old today and must remain so. |

Additional protections and corrections:

- NSW's visible Sydney-local calendar day can legitimately differ from the date portion of a UTC timestamp. Compare those declarations in `Australia/Sydney`, including daylight saving, while preserving genuine conflicts and precision limits. This also helps existing search-discovered NSW releases.
- SQM extraction runs in a terminable worker with a four-second parsing deadline, 2MB input limit, eight-page document limit and bounded memory. Read only opening-page narrative; later chart/table values are not flattened into article evidence. Retain at most 6,000 characters. No new PDF dependency is needed.
- Require the printed standalone release date to agree with the dated PDF filename. Handle split day glyphs such as `1 3 August` without interpreting the reporting month, document creation metadata or crawl clock as a release date.
- HTML and PDF articles continue through the same freshness, evidence-length, subject, geography, duplicate and priority gates. Index sources remain excluded from the timestamp-dependent hourly RSS excerpt archive; they enter scheduled editorial discovery.
- Property-listings research is recognised as a housing subject. The social selector also recognises explicit new/social/affordable homes and numbered housing-delivery headlines, including Queenslanders as a geographic cue. Overseas headlines, absent Australian evidence, passing body mentions and individual property advertisements remain held.

Local regression validation passed 513 tests across 54 files, TypeScript and the frontend production build. Coverage includes real parsing of an original synthetic PDF, malformed/oversized/overlong PDFs, worker termination, later-page exclusion, direct fetch dispatch, nested articles, NSW timezone agreement/conflict, AHURI dates, discovery schema/link checks and downstream housing-supply selection. Real publisher observations used bounded read-only downloads; this workspace's Node DNS lookup failed for a direct network preview, so production availability must be judged from deployment reports rather than this environment's transport result. Release CI and deployment results are recorded in the associated pull request.

Remaining direct regional gaps: Victoria and WA return JavaScript-driven listings without usable static release links in this check; SA, Tasmania, ACT and NT returned 403. No access-denial workaround was attempted. Existing state search discovery remains. Other first-release blockers, unsupported official adapters, licensed/paywalled access and the multi-day human-labelled recall benchmark remain unresolved. Five more sources and passing tests do not establish 10/10 editorial quality.

## Follow-up: ASIC and Victoria public newsroom adapters

Two more direct routes are enabled: **83 inputs, 41 direct and 42 Google discovery queries**. This is an inventory count, not a quality score or availability claim. The previous ASIC and Victoria route gaps are resolved by reading the same anonymous discovery services advertised by their public frontends.

| Route | Evidence and treatment |
| --- | --- |
| [ASIC newsroom](https://www.asic.gov.au/newsroom/media-releases/) and its [public release JSON](https://download.asic.gov.au/asic-nga/data/newsroom/newsroom-mr-latest.json) | The HTML page delegates discovery to JSON. Accept only `media release` records and original same-origin release paths; deduplicate links and take at most 12. Ignore index descriptions and all index clocks. The original release's `displayDate` metadata supplies a calendar day, scoped to ASIC release paths. Created/modified dates cannot substitute for publication. |
| [Victorian media centre](https://www.premier.vic.gov.au/media-centre) | Its public Nuxt frontend posts anonymous search queries to its same-origin `/api/tide/elasticsearch/…/_search` proxy. Use that advertised route, restricted to published news on site 4 and housing-delivery/rental/planning headlines, sorted by release date. Accept only the observed `/site-4/slug` form and resolve to public article URLs. Keep index text and dates out of article evidence. Partial/failed searches remain visible failures. |

The old Victorian Elasticsearch host in the frontend configuration returned 404; the active public search provider uses the same-origin proxy. No authentication, private API or access-denial workaround is involved. Both adapters retain the existing outbound DNS/redirect checks, 8-second feed timeout, 2MB discovery limit, 12-candidate cap and publisher reading/publication budgets. The Victorian POST is a read-only search with a fixed query; other sources retain GET requests. Both routes stay outside the timestamp-dependent hourly RSS archive and enter normal scheduled editorial discovery.

Six original articles were downloaded with bounded, read-only requests and evaluated using the production extraction/date/selection functions at 12:00 UTC on September 10:

- [ASIC superannuation disclosure notices](https://www.asic.gov.au/about-asic/news-centre/find-a-media-release/2026-releases/26-212mr-three-super-funds-issued-infringement-notices-for-misleading-investment-disclosures): 4,662 readable characters; September 8 publication day; eligible for Australia. The fresh registered-agent cancellation sample supplied 423 characters but lacked an established economic/property consequence and remained held. A liquidator-conduct release supplied 1,944 characters and September 10 evidence and was eligible. Eligibility is not a promise of final selection or a must-cover judgment.
- [Shepparton housing delivery](https://www.premier.vic.gov.au/new-homes-sheppartons-youth-and-young-heart): 1,994 readable characters, original September 7 timestamp; eligible for Property and headline-level property-social consideration. It previously failed the topic gate because “new homes” was absent from the Desk's delivery vocabulary. Recognise explicit new/social/affordable homes, homes built/delivered and making way for more homes; retain foreign-headline and individual-property-promotion holds. Social selection also recognises Shepparton and the delivery phrases, while still requiring Australian evidence.
- Two older Victorian delivery releases supplied 2,229 and 2,327 characters and September 2/September 1 publication timestamps. Their topics are now recognised, but both remain held as old. No crawl-clock refresh or evidence-threshold reduction was used.

NAB's [current economic commentary listing](https://business.nab.com.au/tag/economic-commentary) returned links after the earlier candidate feed failed. Its sampled [August housing update](https://business.nab.com.au/tag/economic-commentary/nab-australian-housing-market-update---Aug-2026) yielded only 410 characters, mainly a video introduction, and no recognised original publication date. Do not enable this route on the strength of HTTP 200. Broader bank research discovery remains unverified.

Remaining gaps include WA's dynamic listing, the previously denied SA/Tasmania/ACT/NT routes, other unsupported official/industry listings and blocked or licensed publishers. Production availability can differ from audit downloads (Professional Planner subsequently returned 403 in production). Keep those failures visible. The daily coverage-review tool and seven scheduled read-only audits supply follow-up evidence; future audit results and human-reviewed recall are not yet established. No social posts or unrelated deployment settings were changed. This release uses the normal editorial schedule rather than forcing another same-day full-feed refresh.
