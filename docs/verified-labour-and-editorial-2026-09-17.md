# Verified employment coverage and editorial safeguards

## Operating responsibility

Ruben Laubscher explicitly confirmed on 17 September 2026 that he owns and runs The Desk. The terms and operating runbook now record that statement. It is no longer an unresolved owner-identification action. No company registration, ABN, account transfer, contributor assignment or professional engagement has been inferred or created.

Existing controls already include publishing pauses, incident/contact procedures, subscriber consent events, privacy-request inventory, source-rights holds and reviewed asset checks. Owner identity and provider security are separate: current MFA, recovery access and historic subscriber consent cannot be established from this declaration. No subscriber, credential or provider-security settings were changed. Cloudflare remains deferred as instructed. No owner action is needed to release this update.

## New verified coverage

The ABS Labour Force release supplies four measures for each of eight states/territories: employed people, monthly employment percentage change, unemployment rate and participation rate. The reader deliberately uses the single **trend** table for every jurisdiction; the six-state seasonally adjusted table is not mixed with territory trend data.

Verified 17 September against both the [latest release](https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release) and [July 2026 release](https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/jul-2026). Both returned identical values. The reduced test fixture retains the original title, reference field and complete trend table. Attribution: Australian Bureau of Statistics; [copyright and licence conditions](https://www.abs.gov.au/website-privacy-copyright-and-disclaimer).

The source reader requires one publication title, reference-month field, period-labelled trend table, unique state columns and exact measure rows. Changed units, malformed/missing/suppressed values, duplicate tables/rows, unsupported geographies and future periods fail closed. No imputed or manually hardcoded production values. Responses have a byte cap, timeout, one-hour successful-data cache and one-minute retry cache; concurrent requests share a fetch.

All twelve public market files display this as **state context**, including server-rendered content. State searches and supported state employment questions can read the same data. Ask citations preserve the selected month, with a link to the dated ABS release. Unsupported places, annual-growth/quarter requests, job counts, different series adjustments and absent requested periods are not silently substituted. The current reader requires a reference month no more than three months old; an explicit historical request can display a matching stored response labelled with its actual period. There is no claim of a historical archive: when that period is not in the available response, the reader says unavailable.

Employed people are not jobs, job vacancies or local employment counts. State labour figures do not establish a city or suburb outlook. These measures are not added to automatic investment rankings. Purchase prices, rental yields, completions, listings and local employment remain separate coverage opportunities requiring their own verified contracts.

## Repeatable editorial controls

Percentage checks now compare original reporting sentences for geography, measure, cadence and adjustment basis. A number merely appearing elsewhere in an article cannot verify a contradictory assignment of that number. Generated enrichment fields with these bounded contradictions are withheld using the existing hold diagnostics. Headline checks also run at routine story intake, with a recorded `headline-evidence:*` decision; the headline cannot verify itself. Rezoning/height-limit proposal wording is included.

These are conservative contradiction checks, not a universal fact checker. Unlabelled, multi-claim sentences, unsupported causal interpretations and contradictions outside the recognised vocabulary still require source review. No additional model calls, paid data or new vendor were introduced. Existing public records and external posts are not rewritten by the new intake gate.

The restored live-browser review confirmed PR309's corrected Bowen Hills headline/summary and notice, but found a remaining counterpoint implying completed rezoning. This release withdraws only that exact observed field, with the existing ID/source/value guard protecting later edits. The public correction record already covers the proposed-versus-completed distinction. The story correction date now comes from its own record instead of a hardcoded 16 September label.

## Verification

PR311 deployed as `f1688e198d6503fcd1de010a4d1c8c402fb3e1a4`, after all 2,834 tests passed. Its live API returned all 32 matching observations; browser checks confirmed the July reader, June unavailable state, operator wording and Bowen Hills withdrawal/date. A live Ask comparison found both state records but was withheld by model review. The follow-up provides a bounded table answer only when the complete state/measure/period request and packed source records match. Unsupported scope retains normal review; no model review is bypassed for interpretive claims. The exact live question is covered by a router regression proving that neither generation nor model review is called for this supported lookup.

Focused parser, question-scope, display, editorial and intake regressions cover changed source schemas, state/city boundaries, historical substitution, percentage units/cadence, contradictory headlines and valid claims that must continue to publish. Full CI includes the database suites, security checks, TypeScript, dependency/dead-code checks, rights inventory and production build. Exact revision, counts, deployment and live-page observations are recorded on the release pull request.
