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
