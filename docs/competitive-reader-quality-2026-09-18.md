# Competitive reader-quality review, 18 September 2026

The benchmark covers work The Desk can implement with its existing reporting, data, code and publishing assets. Audience size, paid datasets, owner account actions and unavailable physical-device testing are not deductions. A top score means the defined reader and publishing checks pass with no unresolved defect found in this audit; it does not mean every historical interpretation has been independently re-reported or every future output is guaranteed correct.

## What the comparison showed

| Comparable | Observed strength | The Desk gap and implementation |
|---|---|---|
| [Glasshouse](https://heyglasshouse.com/) and its [Instagram](https://www.instagram.com/glasshouse.aus/) | Specific property research jobs, shareable outputs and image-led news covers with an immediately visible point. Product claims on its website were not independently accuracy-tested. | The Desk already has market files and sourced sharing. Daily carousel covers gave too much space to generic copy and too little to the illustration. Move the credited illustration above the complete headline, remove filler, retain estimate/source/date labels and send the final card to a relevant guide. No competitor imagery or copy is reused. |
| [The Urban Developer](https://www.theurbandeveloper.com/) and its [editorial charter](https://www.theurbandeveloper.com/editorial-charter) | Strong story identity, topic organisation and explicit editorial standards. | Counterpoints need their underlying headline, and the curator needs to be distinguished from the original publisher. Add headline links, clarify the byline, remove duplicate category decoration and keep only populated reading-angle controls. |
| [Cotality insights](https://www.cotality.com/au/insights) and [index methodology](https://www.cotality.com/au/our-data/indices) | Repeatable market readings connected to methodology and further coverage. | Add durable, dated explainers connected to current reporting and data. Explain index/median, preliminary/final, asking/paid rents and the stages of housing delivery. Definitions remain separate from current observations. |
| [The Daily Aus](https://www.thedailyaus.com.au/) and [its editorial approach](https://www.thedailyaus.com.au/about-us) | Accessible explainers and clear source/correction commitments across formats. | Make a social reader’s next destination useful: original story evidence plus the concept behind it. Strengthen generated-copy review with complete field assessments and verifiable supplied-text anchors. |
| [The Squiz](https://www.thesquiz.com.au/) | Distinct daily and deeper explanatory reading jobs without assuming prior knowledge. | Add a question-led Property explained hub, reachable from the homepage, navigation, relevant stories and social sources. |
| [ASIC Moneysmart mortgage calculator](https://moneysmart.gov.au/home-loans/mortgage-calculator) | A practical way to understand rate/repayment scenarios with visible assumptions. | Extend The Desk’s existing repayment mathematics into a two-rate comparison. Clearly label hypothetical inputs, validate empty/invalid values and explain fixed-rate, term and fee limitations. No inputs are saved or sent for calculation. |

These observations concern the reviewed public pages and social profiles. They are not claims about competitors’ traffic, conversion, private operations or the accuracy of their whole archives.

## Implemented scope

- Seven sourced guides: interest rates, housing supply, rents, population, house prices, auctions and housing tenure. Each contains three distinctions, a practical reading question, a primary methodology link, review date and routes back to Australian reporting/current data.
- Matching server-rendered content, per-page metadata, self canonicals and sitemap entries. Unknown guide slugs are genuine missing pages. The interactive repayment tool is progressive enhancement.
- Story-specific Ask requests now carry a validated story ID, use the same public presentation rules as the story page, reject held/missing/empty-source stories and retain the selected story in the evidence set. Its counterpoint is presented for assessment, never substituted for source evidence. Cached answers are separated by selected story.
- Every nonempty generated editorial field requires one unique review assessment. Supported fields require exact, whitespace-normalised anchors in the supplied evidence. Missing, fabricated or draft-only anchors withhold the field; malformed/incomplete reviews fail closed. This remains a bounded model judgment, not a proof of semantic truth, and supplements existing claim checks.
- Daily carousel covers and takeaway destinations use the existing publishing renderer and licensed illustration inventory. Existing posts and accepted documentary exports are not regenerated. Future automated posts use the new renderer.

## Acceptance checks for a 10/10 scoped release

1. A new reader can identify The Desk’s proposition, original publisher and the difference between reporting and interpretation.
2. Every displayed counterpoint identifies its story; opening Ask carries that story through to evidence review without exposing held content.
3. Empty interpretation controls and duplicate category decoration are absent from the changed homepage components.
4. All seven guides have substantive, sourced definitions and a working path to relevant reporting and data.
5. The repayment tool produces independently checked amortisation results, handles zero interest and refuses empty/out-of-range/fractional-term inputs without displaying stale results.
6. Guide routes have meaningful initial HTML, page-specific metadata, canonicals and sitemap entries; invented slugs do not receive a success page.
7. New social covers fit complete long headlines in both themes and supported image dimensions, with visible source, claim status and illustration credits.
8. Social captions remain within platform limits with attribution intact and a useful explanatory destination.
9. Editorial review rejects missing assessments, duplicate fields, fabricated quotes and draft-only evidence; existing numeric/scope safeguards continue to pass.
10. The reviewed change passes type, dead-code, rights, security, database regression, full test and build gates; the exact merged revision deploys successfully and changed public journeys are checked live.

Production acceptance and final score belong in the release record and the full audit after deployment. Passing automation alone does not satisfy the live reader checks.
