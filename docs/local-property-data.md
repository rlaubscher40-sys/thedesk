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

This is the first implementation package from the coverage audit. Other states' local rent connectors, ABS LGA history, nationwide planning, listings/vacancy, property transactions and authorised auction access remain separate work. Existing state-level population data remains contextual; no national or state rent median is manufactured by averaging local medians. Local datasets are not yet inputs to automatic Signals/social editorial selection.
