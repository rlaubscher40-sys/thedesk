# September 14 coverage repairs

This implements Ruben's request following the assistant-reviewed provisional
sample. It is not a human-approved coverage benchmark or a recall score.

## Reproduced causes and changes

- Employment vacancies were unconditional housing evidence. Shared retrieval,
  social passage checks and editorial topic selection now require housing
  context; the audited Pulse government-job story becomes AU/MACRO.
- The ABC market-liveblog adapter matched only one exact slug. The September 14
  `asx-markets-business-live-news-september-14` variant now uses the same dated
  Australian-close checks. The retrieved page supplied no qualifying domestic
  close, so the reader holds it rather than selecting a US opening or sign-off.
- The legacy ABC masthead includes “Australian Broadcasting Corporation”. Its
  complete suffix is now removed before geography assessment. The audited US
  card moves to Business; exact old generated fields are cleared, not reused
  as Australian evidence. Later editor changes and Ruben's notes survive.
- Mortgage reporting naming the Commonwealth Bank and Reserve Bank lacked a
  recognised domestic anchor. It now qualifies unless its headline explicitly
  describes an overseas event. This does not whitelist all ABC news.
- Policy vocabulary now recognises net-negative migration proposals, migrant
  worker/visa policy and card surcharging. Proposals remain proposals.
- A bounded claim guard distinguishes a housing service horizon from a build
  timetable, and homes from beds. Exact-value repairs correct the Housing
  Australia and broker cards. They are linked as related reporting, not
  independent confirmations; neither publication is deleted.

## Public source checks, 14 September 2026

| Route | Evidence and limitation |
| --- | --- |
| [ABC mortgages](https://www.abc.net.au/news/topic/mortgages) | 19 dated article links; includes the missed mortgage report. That report also occupied position 13 in the captured Business RSS, but absence from historical saved rows alone does not prove its original pipeline outcome. |
| [ABC federal government](https://www.abc.net.au/news/topic/federal-government) | Includes the One Nation proposal. The separate migration-policy topic page did **not** include that article, so it was not added as the solution. |
| [ABA RSS](https://www.ausbanking.org.au/feed/) | Ten entries, including the surcharge implementation reminder. Industry attribution, not regulator weighting. |
| [REIWA public releases via National Tribune](https://www.nationaltribune.com.au/topics/reiwa/) | Scoped to the topic's main article listing, excluding global ticker/sidebar links. Article reading requires REIWA body attribution AND an original REIWA release reference. Other National Tribune reporting remains unreviewed. This is public republication, not independent corroboration. |
| [REA RSS](https://www.realestate.com.au/news/feed/) | Returned 50 RSS entries. Restored as primary discovery; the verified newsroom remains an explicit fallback. Neither route bypasses article access restrictions. |
| [FAAA RSS](https://faaa.au/feed/) | Ten entries; the sampled 19 August consumer-compensation statement yielded 4,031 characters after selecting its explicit post body instead of a related article card. Old releases remain old. Association commentary supplements advice coverage but does not replace independent Professional Planner reporting. |

Direct REIWA requests returned 403. Professional Planner's previously observed
article denials remain publisher restrictions; this release does not claim to
remove them. The tested IFA RSS also returned 403 and was not added. Existing
per-article denial cooldowns and origin-wide 429 backoff remain unchanged.

## Four-event replay

Freshly downloaded pages were passed through the actual date, article and
selection functions. All four events below were selected in a bounded replay
using the four new discovery inputs. Other article bodies were unavailable in
that replay and explicitly labelled `not-in-provisional-replay`; this is not a
full competitive production run. Direct Node transport in this workspace could
not run the all-source network probe; its errors are not production failures.

| Event | Publication and reporting dates | Result |
| --- | --- | --- |
| [ABC mortgage competition](https://www.abc.net.au/news/2026-09-14/mortgage-war-return-banks-customers-falling-property-prices/107134688) | 14 September Sydney; discussion includes June/July rate cuts | 3,950 characters, PROPERTY |
| [ABC One Nation proposal](https://www.abc.net.au/news/2026-09-14/750k-visas-cut-under-one-nation-plan/107149702) | 14 September Sydney; proposed three-year visa reduction, not legislation | 6,003 characters, AU |
| [ABA surcharge reminder](https://www.ausbanking.org.au/preparing-for-the-removal-of-card-surcharging/) | 14 September; preparation for 1 October, not a newly announced ban | 3,376 characters, AU |
| [REIWA affordability republication](https://www.nationaltribune.com.au/wa-housing-and-rental-affordability-at-record-lows/) | National Tribune publication 14 September 16:45 Sydney; original REIWA release dated 13 September in the audit; figures concern June quarter 2026 | 5,973 characters, PROPERTY; stored publisher timestamp belongs to the republication, not the original release or reporting quarter |

## Deployment verification

The ordinary feed pipeline gets one durable, bounded post-release collection
claim. It does not force these four candidates into publication, bypass article
access restrictions, manufacture dates or initiate social posts. Publication
must be verified from saved public rows, not selected counts or job success.

Check these existing records after deployment:

- `3870157`: government jobs in AU/MACRO, not Property.
- `3870114`: US excerpt in Business, with exact stale context removed.
- `3870115`: service horizon corrected; `3870156`: homes, not beds, and related
  coverage linked to the primary report.
- APRA, Bega and packaging prior repairs remain intact.

The older Tasmania review was a non-binding motion on 9 September. It is not
republished as a fresh compulsory review. Its historical coverage gap remains
separate from the functioning Pulse discovery route.

## Production verification and bounded follow-up

PR #275 deployed successfully. The four existing corrections and the housing
relationship were verified in public records; APRA, Bega and packaging remain.
The recovery read 107 articles and inserted 15 rows. Actual publications include
ABC's migration proposal (`3900001`), ABA's implementation reminder (`3900003`)
and the REIWA republication (`3900004`). The mortgage event was still absent.
Seven submitted rows were held at the final quality gate, but the logs did not
name them; this is **not** evidence that the mortgage story was one of those
seven. Protected decision records were not inspected.

The follow-up prioritises potentially current ABC topic-index paths over
clearly older paths. This is only a reading-order hint: URL dates do not become
publication timestamps, older paths stay available in the reserve, and actual
publisher evidence still decides freshness. The captured mortgage index had
four older, higher-scoring headlines ahead of the current report. That is a
reproduced reading inefficiency, not a proven explanation of its last outcome.

A separate, single durable recovery claim reads only the configured ABC
Mortgages source, excluding unrelated evidence-pool candidates while retaining
recent-URL, duplicate, date, evidence and publication checks. Private logs now
identify sampled candidate outcomes and final quality holds without article
bodies, query strings, credentials or editorial notes. A bounded log sample
still cannot prove failed discovery for omitted candidates.

Live enrichment also exposed a mislabelled figure: ABA's $660 million estimate
describes lower payment costs helping offset surcharge removal, not annual
surcharge revenue. Exact-value corrections fix that card and preserve the
eftpos/Visa/Mastercard scope. ABA extraction now excludes related transcripts.
The REIWA takeaway is narrowed to WA's explicitly reported June-quarter
affordability measures rather than an inferred Perth population scope.

Professional Planner article 403s continued in production. REA discovery had no
reported failure in this recovery. Working alternatives and cooldowns are not
permission to bypass publisher restrictions and do not establish full coverage.
