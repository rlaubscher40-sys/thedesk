# Reader and editorial follow-through · 17 September 2026

This release addresses findings from the live desktop browser review. It is not a claim that every device, historical claim or future output is perfect.

## Reader experience

- Shared labels increase from 12px to 13px at the default reading size, with less letter spacing and more line height. Source and methodology notes in market readers increase to 14px.
- Shared buttons retain a minimum 44px height and can wrap within their container. Long market names no longer require an unbroken button label.
- Quarterly history links have 44px minimum targets and a visible current-period treatment. The sales table's scroll region can receive keyboard focus.
- Market files expose section shortcuts so readers can reach reporting and sources without scrolling through all the data panels. Links only appear for sections supported by the page, including regional and demo files.
- A single reporting reference uses the singular label.

## Verified editorial corrections

Original publisher HTML was retrieved successfully and its article body read on 17 September. Exact record ID, URL and prior-field guards protect subsequent editorial changes; existing database integration tests exercise every correction, idempotence and source/value mismatches.

| Story | Source | Correction |
| --- | --- | --- |
| 3960033 | [Mortgage Professional Australia](https://www.mpamag.com/au/news/general/home-resale-profits-ease-as-housing-downturn-takes-hold/590058) | Profitable and loss-making resales have separate median holding periods, 9.1 and 8.1 years. The previous inference that most losing sellers held briefly is unsupported. The unestablished Sydney trend and forecast spread of losses are withdrawn. |
| 3960062 | [NSW ministerial statement](https://www.nsw.gov.au/ministerial-releases/town-hall-square) | The IPC provides advice; the minister decides on state significance. The statement does not establish a faster approval pathway or a delivery timetable. |
| 3960058 | [CBA newsroom](https://www.commbank.com.au/articles/newsroom/2026/09/stand-ready-more-interest-rate-rises-imf.html) | Possible cuts depend on sharply slowing growth and inflation coming under control. Reform recommendations are not stated prerequisites for cuts. |

Public correction notices explain these changes. Already distributed copies are not rewritten. The shared claim checker and generation instructions now address the recognised cohort inference, decision-authority and conditional-guidance errors. These bounded rules do not establish universal factual accuracy.

## Regional reporting

Each of the four regional directory markets receives its own 40-record budget, with at most three pages scanned, alongside the existing eight state budgets. Sanitised, eligible, dated, housing-relevant records still have to mention the locality. Duplicate records are merged. The maximum returned evidence pool is 960 records; combined with the 1,001 daily-story candidates it remains below the existing 2,000-item directory cap.

Verified Google News discovery routes add dedicated Townsville and Newcastle queries. Successful feed parsing produced 18 and 36 candidates respectively; the existing evidence admission rules retained six and thirteen on the captured responses. These are discovery candidates, not verified local stories or independent publisher corroboration. Search terms and a publisher's name do not establish a story's locality. Original-source access, rights holds, geography and editorial quality checks remain in force. Townsville Council presented a human-verification block; no bypass was attempted. A working Newcastle Council feed was inspected but not added merely to inflate the source count with unrelated council news.

## Validation and acceptance

- Focused claim, regional retrieval, directory, quarterly-reader and source checks passed (62 tests); subsequent expanded editorial and public-HTML checks passed (115 tests).
- TypeScript and dead-code/dependency checks passed. The rights inventory was regenerated.
- New regression cases verify that regional records survive a busy capital-city sample, unsupported conclusions are held while qualified statements survive, and section shortcuts resolve in capital, regional and demo pages.
- Full CI, security, build and isolated-database gates are required before merging. Production acceptance checks will verify corrected story fields and notices, regional counts, the new navigation, label sizes and quarter links.

The cloud browser exposes a desktop viewport. A browser-zoom shortcut did not change its measured width, so it is not responsive or physical-phone evidence. CSS changes improve narrow-container behaviour, but actual iPhone/Android rendering remains a separate verification item. Private-account controls and deferred Cloudflare work retain the original audit requirements.
