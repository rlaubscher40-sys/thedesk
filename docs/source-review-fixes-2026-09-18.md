# Source review fixes · 18 September 2026

Production was recovered at PR317, commit `310aa8caa413dffa07141073cd78753d0b406d04`, with successful Railway deployment `ecbbaf49-d245-4192-88df-1cb758958a6e`. These changes follow the public source review, not an assumption that opening a PR proves deployment.

During validation, PR304 and then PR318 merged separately. This change integrates main at `b120c0e8e4fb454c35844f75dc14e14753900f13`, preserving their briefing, Ask, editorial-review and source-correction changes. In particular, PR318's guarded removal of record 287372's wrong-country region remains in place. The additional changes here preserve the archived source text and URLs.

## Reviewed findings

- Evidence 278267 is a [Homes Victoria recruitment advertisement](https://jobs.careers.vic.gov.au/jobtools/jncustomsearch.viewFullSingle?in_jnCounter=226686920&in_organid=14160), posted September 16. Salary, application requirements and a closing date do not make this housing-market reporting. Careers hosts and job-advert formats are held on ingestion and in search/market read projections. Ordinary reporting about construction vacancies is retained.
- Evidence 99278 describes [Perth, Ontario](https://lanarkleedstoday.ca/2026/09/02/more-than-1000-homes-coming-after-caivan-perth-development-wins-approval/). The original identifies the Ontario Land Tribunal and Lanark County. Ambiguous Perth/Newcastle references now require usable Australian context; Google roundup descriptions and query targets supply none. Records 287372 (Yahoo News UK) and 101096 (dailyrecord.co.uk) are conservatively held for unresolved Australian geography, without claiming a completed original-source review of either.
- Story 3930103's [original article](https://www.realestate.com.au/news/hasnt-stopped-sydney-suburbs-defying-price-slump/) supports its headline and summary, but does not establish the generated low-base explanation, market recovery or unqualified policy causation. Only the exact observed counterpoint and partner guidance are withdrawn, guarded by story ID, original URL and byte-exact prior values. A public correction notice records the change; later manual edits and distributed copies are preserved. The original's Wentworth Falls table/prose discrepancy is not repeated in the Desk summary and is not asserted as a Desk error.

## Safeguards and boundaries

Archived evidence remains intact and directly accessible with an exclusion notice and original URL. Excluded records no longer endorse their stored region or offer a story-specific Ask link. Empty excerpts are explicitly labelled headline-only. Existing roundup cleanup and hotel-booking exclusion remain in force.

Shared claim checks hold recognised unsupported base-effect/recovery language; generation instructions require original-source support and attribution for causal opinions. These bounded checks do not certify every possible inference or every historical story. PR316's source-checked corrections remain unchanged.

Regression coverage exercises ingestion, search, market selection, direct archive reads, the evidence page, unsupported interpretations, and idempotent exact-value corrections. No imports, paid model calls, email or social publication are part of this release. ABS series, regional primary notes and council-rent data are unchanged. Source 3960065 remains unverified because the original was unavailable; no speculative factual correction is made.

CI and deployed acceptance results are recorded in the pull request and operational follow-through after verification.
