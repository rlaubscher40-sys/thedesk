# Local data browser audit, 9 September 2026

Authenticated production browser checks covered Markets, two Ask answers and the City of Sydney planning snapshot on Signals. These are sampled checks, not certification of every locality or every generated answer.

| Exact Markets lookup | Observed stored evidence |
| --- | --- |
| NSW postcode 2000 | August 2026: one-bedroom flat $900/week; two-bedroom flat $1,350/week |
| QLD postcode 4000 | June 2026 quarter: two-bedroom flat $850/week; 287 contextual bonds; small categories withheld |
| SA postcode 5000 | June 2026 quarter: two-bedroom flat $650/week; 230 rounded bonds; reviewed-release notice |
| WA postcode 6000 | August 2026: all dwellings $649/week; 281 valid rents; no dwelling/bedroom split |
| TAS postcode 7010 | June 2026 quarter: two-bedroom flat $500/week; 19 observations; small categories withheld |
| VIC postcode 3000, ACT postcode 2600 | No exact local dataset match; these remain coverage gaps |

The SA Ask answer returned the correct figure and period, and its source link opened the matching record. A QLD historical Ask answer returned $800/week for June 2025 with 345 contextual bonds, but its citation opened the latest June 2026 table ($850/week). The date mismatch was reproduced by clicking the source link.

The fix pins local citations to their observation period, displays that period in Markets, and keeps it when requesting a market brief. A period no longer stored displays an explicit gap instead of substituting the latest figure. Historical evidence is labelled as historical. Existing unpinned briefs are not rewritten.

The historical answer also overstated statistical reliability from a bond count and called an old median a floor for current negotiations. Ask instructions now explicitly prohibit those inferences. Prompt changes reduce this risk but do not guarantee every future model answer; the numerical evidence and prose still need separate evaluation.

Signals correctly labelled the August 2026 City of Sydney pilot as council-only proposals: 92 original applications, 268 reported proposed dwellings, and 59 applications missing dwelling counts. It did not present those as approvals or completions.

Auction collection remains pending source access. The free Domain viewing link is not an ingestion feed and does not establish statewide or national coverage. Government access enquiries for VIC, ACT and NT remain pending. No paid source or extra scheduled LLM call is introduced by this fix.

Verification: regression tests reproduce the date mismatch and cover latest, historical, missing and suppressed observations. Production verification after deployment should check the pinned QLD link, default latest link, missing-period link and a fresh historical Ask answer.

## Follow-up verification and retrieval fixes

After PR #203 deployed, the June 2025 postcode 4000 citation opened the historical
$800/week two-bedroom flat observation and the explicit historical notice. The
March 2025 link displayed the missing-period message without substituting a
newer observation. A fresh Ask answer returned $800/week, June 2025 and the
correct period-pinned citation. Its additional prose still speculated about
current local rent from national commentary. Numerical retrieval and model
interpretation therefore remain separate quality checks.

A current two-bedroom-flat rent question for postcode 0800 NT returned
insufficient evidence instead of inventing a local median. Live Admin showed
2,450 stored ABS SA2 areas across all eight jurisdictions: NSW 642, VIC 522,
QLD 546, SA 174, WA 265, TAS 99, NT 68 and ACT 134. Rent releases were NSW/WA
August 2026 and QLD/SA/TAS June 2026. SA still correctly showed publisher access
paused alongside the reviewed import; a stored release does not prove automatic
updates work. These counts are coverage evidence, not end-to-end testing of
every area or publication-quality checks of every generated answer.

Code inspection found that natural-language month requests were filtered by
year alone. This could provide a June observation to a March question; CPI
evidence had the same year-only check and the planning reader ignored requested
dates. Explicit month/year, quarter/year, ISO dates and years now constrain
retrieval. An absent requested period supplies no substitute. Relative dates
and complex date ranges are not fully interpreted by this small deterministic
parser.

Local fact evidence is now separated by reporting period, each with its own
Markets citation. Multiple localities share the existing six-source budget
before additional history is added. Suppressed/insufficient-sample observations
remain available as evidence of withholding, with a prohibition on replacing
them with zero, another category or an old value. Historical evidence names the
latest stored release period without attributing its values to the historical
citation. This does not guarantee compliant generated prose.

Focused verification covers all eight state/territory identifiers using
deliberately colliding same-name SA2 fixtures, source and boundary preservation,
wrong-month exclusion, separate comparison citations, withheld values, latest
and historical tables, CPI/planning period exclusion and Ask/Markets integration.
No new source download, collection model call, paid service or schema change.

Remaining work: full natural-language geography/date evaluation on real suburb
questions; stable historical citations for the separate CPI/planning panels;
conditional workbook requests before large downloads; more detailed Admin
coverage-gap reasons; and permitted VIC/ACT/NT rental sources. Automatic local
rent-driven Signals remain unimplemented. The council planning pilot remains
scoped to proposals, not approvals or completions.

## CPI and planning evidence links — 10 September 2026

The live Melbourne search with `rentPeriod=2026-06` reproduced another date
mismatch: the panel headlined July's 2.5% annual CPI rent change and showed June's
2.6% only as the previous rate. New CPI evidence links now carry the exact month
to the Markets search panel. The selector never substitutes another month;
missing/invalid requested months produce an explicit gap. The market-brief action
preserves a valid requested CPI month. CPI history is limited to the observations
retained in the retrieved series; this change does not create an indefinite CPI
archive or freeze later ABS revisions to the same observation.

New City of Sydney planning citations link to Signals with the lodgement month
and stored snapshot fingerprint. That path reads the exact stored council/month/
revision, without collecting the live source or creating a new snapshot. Missing
or invalid pins never call the latest-period collector. Planning panels show a
dated-evidence notice and a link to the displayed revision; local Markets also
honours a requested planning month-end period. Default unpinned panels keep their
existing live behaviour. Old answers' previously unpinned URLs are not rewritten.

Ask can retrieve explicitly requested CPI months still present in the series and
historical planning months retained in storage, with separate dated citations.
Historical evidence is not described as current activity. Source geography and
the distinction between proposed dwellings, approvals and completions remain
unchanged. Parser, reader, router and rendered-panel regressions cover exact,
missing, invalid, old and revised evidence. No migration, paid source, new model
call or historical collection backfill is introduced by the implementation.
