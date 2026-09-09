# Local property data

This release connects local facts to market searches, Ask and market comparisons. It adds no model calls to collection and requires no paid data subscription.

## Sources and scope

| Source | Dataset | Frequency | Geography |
| --- | --- | --- | --- |
| ABS Regional population | Population, annual growth and migration components | Annual | Published ASGS Edition 3 SA2s in all eight states/territories |
| NSW Fair Trading | Median weekly rent calculated from valid new bond lodgements | Monthly | Publisher postcodes and dwelling/bedroom categories |
| Queensland RTA | Published median weekly new-tenancy rents and contextual bond counts | Quarterly | Publisher postcode, suburb and LGA tables |

Source URLs, attribution, reuse notices and definitions are in `shared/localData.ts`. The Queensland workbook contains its own CC BY 4.0 notice; a changed notice stops the parser for review. ABS boundary editions are checked against the release page. Statistical areas and publisher-defined rental geographies are not silently joined or relabelled as each other.

NSW uses at least ten valid observations per rent category. Unknown rents, bedrooms and dwelling types are excluded and counted. Other dwelling types are excluded because they may include garages or car spaces. Suppressed Queensland medians stay missing, even where the previous year has a value. Bond counts are not claimed to be the precise median sample.

## Collection and recovery

The enabled in-process scheduler checks each source daily in its own durable job, from 00:15, 00:20 and 00:25 Sydney time, with catch-up and at most two attempts per day. Existing collection leases fence late writes and recover interrupted attempts. A persistent twelve-hour success cooldown prevents repeated successful downloads. Each source retries separately.

Downloads are restricted to the registered HTTPS publisher, including redirects, with streamed size and timeout limits. Workbooks are checked as bounded ZIPs and parsed in an isolated worker with memory and time limits. The maintained `read-excel-file` dependency reads values; formulas and macros are not executed.

A SHA-256 fingerprint includes parser version, resource URL and source bytes. Unchanged files do not get parsed or create another snapshot. Bump the parser-version prefix in `collect.ts` when a parser change should reprocess identical source bytes.

Validated datasets are published as immutable JSON release snapshots. One insert publishes the complete dataset; a failed parser cannot publish half a file. Reporting periods, retrieval times and last successful checks remain separate. Older or late writes are rejected. Prior snapshots remain available after a failed refresh.

Each source snapshot is bounded to 12 MB and cached for one minute. This initial design keeps roughly six MB of normalised current data across the three source types, based on the September 2026 source probe. It avoids a schema migration per metric. Before substantially expanding history or source volume, replace whole-snapshot reads with indexed per-area records; do not increase these bounds indefinitely.

## Read paths

- `markets.localData` reads stored data only, matching exact source area names and optional state/type. It does not initiate collection.
- Ask matches named locations and relevant subjects. Ambiguous names across states are withheld; capital-city names do not automatically select a small namesake SA2. Explicit postcode context prevents calendar years being mistaken for locations.
- Ask's optional local evidence has a twelve-second budget. A failed optional source does not fail the answer, and completed local evidence survives another source timing out.
- Existing capital-city CPI rent observations can support correctly scoped rent-inflation questions. They cannot stand in for median weekly rent or vacancy.
- The City of Sydney planning evidence reader uses stored snapshots; questions do not start a planning download. Opening the market's planning panel uses the existing bounded planning reader.
- Market comparisons preserve their eight-source limit and equal per-side budgets. Source links open the local panel with state/type retained.
- Admin → Health → Local dataset coverage reports source periods, checks, failures, areas by jurisdiction and excluded rows.

## Validation

Run `pnpm exec tsx scripts/ingest/probe-local-data.ts` for a read-only check against current publisher files. It makes no database writes and no model calls. A September 2026 probe returned 2,450 ABS SA2s, 528 NSW postcodes and 1,055 Queensland geography records. Queensland totals combine overlapping geography types and must not be described as distinct markets. Source probes do not establish production storage: verify Admin coverage or public local-data reads after deployment.

Focused tests cover reconciled population/state totals, wrong source periods, suppressed values, small samples, geographic ambiguity, retained snapshots, duplicate processing, denied access, redirect boundaries and optional-source timeouts.

## Remaining scope

This is the first implementation package from the coverage audit. Remaining local rent connectors, ABS LGA history, nationwide planning, listings/vacancy, property transactions and authorised auction access remain separate work. Existing state-level population data remains contextual; no national or state rent median is manufactured by averaging local medians. Local datasets are not yet inputs to automatic Signals/social editorial selection.

## Rental expansion — 9 September 2026

Three additional free sources use the existing fenced daily collectors, persistent
12-hour success cooldown and content hashes. Collection makes no LLM calls and
needs no paid account. Failed downloads or schema checks preserve the last good
snapshot. These datasets feed local Markets cards, comparisons and Ask evidence.

| Source | Discovery / licence | What is stored |
| --- | --- | --- |
| SA Housing Trust | `https://data.sa.gov.au/data/api/3/action/package_show?id=private-rent-report`; catalogue Creative Commons Attribution | Published quarterly suburb/postcode medians by house/flat and bedrooms. Counts are rounded to five; one-to-five counts are suppressed. Medians with displayed counts below 15 are withheld. |
| Government of WA / National Housing Data Exchange | `https://housing-data-exchange.ahdap.org/dataset/west-australia-rental-bonds-data-2023-current`; CC BY 4.0 | Monthly postcode medians calculated from lodgements. Source has no dwelling type/bedroom split. At least ten valid rents required. |
| Tasmanian Department of Justice | Data.gov.au catalogue search restricted to the publisher organisation; only CC BY / CC BY 4.0 resources | Monthly private-housing new bonds in the Active Bonds sheet, by postcode/type/bedrooms. Closed bonds and community housing excluded; at least ten valid rents required. |

The SA workbook splits five postcodes between Metro/Country blocks. All ten
component rows are excluded, not combined. Duplicate suburb names likewise
remain ambiguous. Regional/SLA tables and aggregate rows are not mislabelled as
suburbs. Counts are contextual and are not summed across overlapping geographies.

WA's roughly 4 MB ZIP includes historical files and macOS metadata. The reader
validates its directory, reads only the precisely named current lodgement CSV,
limits expansion to 5 MB for that entry, and never extracts files to disk or
retains archive metadata. Host access is restricted to the catalogue and its
specific public S3 bucket's `/RentalBondsWA/` path.

Tasmania's 2024–25 catalogue folder currently contains June 2026 resources.
Selection uses resource filenames and verifies row lodgement dates, not the
folder year. The new 2026–27 folder currently has no downloadable resource.

Source checks on 9 September: SA June 2026, 881 areas / 510 published category
medians; WA August 2026, 215 postcodes / 115 published medians; TAS June 2026,
77 postcodes / 27 published category medians. Other groups remain withheld.
These are source/parser checks, not production storage verification.

### Victoria and remaining coverage

The official release page is `https://www.dffh.vic.gov.au/publications/rental-report`.
It lists September-quarter 2025 LGA rents and moving-annual suburb rents, with
reuse metadata on Data Vic. Both its download alias and direct XLSX file timed
out from this connection (30 seconds, then 55 seconds). No unverified Victorian
parser is enabled. Next: obtain a successful permitted download, inspect and test
the actual seven-sheet layout, then add the collector. Keep quarterly LGA and
moving-annual suburb periods distinct. ACT and NT local rent connectors remain
unimplemented; nationwide ABS population does not imply nationwide rent coverage.

### Auctions

The SQM permission enquiry recorded in `published-market-metrics.md` remains
pending. A mailbox search found no SQM reply on 9 September. Public viewing
does not establish automated collection or redistribution rights. No new enquiry,
purchase or publisher scraping was performed. PropTrack/REA remains disabled.
Markets now explicitly explains this pause instead of implying collection is
about to populate the missing cells. A future approved partial feed must show
its actual geographic coverage; a combined reported-markets rate is not a
national rate. Derive aggregates only from compatible same-week counts and the
approved publisher methodology, never by averaging rounded state percentages.
