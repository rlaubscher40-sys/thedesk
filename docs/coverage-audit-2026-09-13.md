# Coverage follow-up, 13 September 2026

## Verified corrections

Public API replay confirms Bega #3870062 and packaging #3870060 are published. These close the previous publication gaps, not a comprehensive coverage benchmark.

APRA #3840110 still used $9.8 trillion as the retirement system's assets. The [10 September original](https://www.apra.gov.au/news-and-publications/apra-revises-proposals-implement-governments-retirement-reporting-framework) identifies that as assets across supervised institutions, including banks and insurers. The exact-old-value repair replaces this generated takeaway with a scoped transparency statement and conditional 2028 publication timing. It retains the story, source dates, prior corrected counterpoint and editorial notes.

The article extractor now excludes APRA's institutional footer. A separate claim check catches this specific population transfer in previously cached source text; it does not claim general semantic fact checking. Shared generation instructions also require each number's institution, population, place and period to remain intact.

## Access health is not coverage

Production's 08:45 UTC daily report (18:45 Sydney) recorded 18 article HTTP 403 outcomes, four HTTP 401s, a 429 and two timeouts, despite zero failed discovery sources. Professional Planner, Mercury, Herald Sun and Adelaide Now were among the article denials. Professional Planner is already configured as a public index, not RSS; the generic HTTP error label incorrectly called index failures RSS failures. New errors distinguish these formats and omit raw exception text.

Article reads now retain bounded process-local cooldowns: six hours for the exact URL after a 401/403, and at least one hour across an origin after a 429, respecting longer Retry-After values. Other articles at a publisher are not assumed denied from one 403. Cooldown outcomes remain failures, not successful retrievals or editorial rejections. This state is not durable across restarts; no process-global or permanent access resolution is claimed. Requests already in flight can finish. No proxy, paid source, credential change or extra retry is introduced.

Admin and hourly logs explicitly distinguish discovery, article access and publication. The existing overall outcome counts include cooldowns; detailed failure entries remain a bounded sample.

Professional Planner's public newsroom is readable in source review, but that does not establish permitted automated article retrieval in production. ASIC and APRA remain independent original-source alternatives for their regulatory events; no automatic equivalence or substitute corroboration is assigned.

## Tasmania: a reviewed alternative, not forced backfill

Reviewed Pulse Tasmania's [editorial policy](https://pulsetasmania.com.au/editorial-policy-complaints/), [politics index](https://pulsetasmania.com.au/section/politics/) and actual article HTML. The index yielded 10 same-publisher news links. It is now a bounded discovery source under the ordinary subject, original-date, disclosure and reading-budget checks, with newsroom weighting rather than official-source status.

The [review report](https://pulsetasmania.com.au/news/mps-back-urgent-review-of-tasmanias-short-stay-laws/) carries publication timestamp 9 September 2026, 06:24:38 UTC. It describes a non-binding motion, not an already commissioned compulsory review. The current headline gate rejected its short-stay **laws** vocabulary; the policy matcher now covers laws, legislation and reforms while still excluding holiday reviews. That reproduction does not prove the historical protected selection decision. Its original publication is outside the current freshness window and remains so.

The index also exposed a [subsequent possible-revival report](https://pulsetasmania.com.au/news/treasurer-abetz-remains-open-to-reviving-short-stay-levy-after-upper-house-defeat/), published 10 September 19:00 UTC (11 September Sydney). The ordinary HTML download provided readable text and publication metadata; disclosure checks passed and the current local assessment returned eligible, score 76. It reports openness to a future levy, not passage or reinstatement. Eligibility in a replay is not publication confirmation, and the freshness gate will expire normally.

No older event is given a new source date, no production story is manually inserted, and no special collection is triggered. Tasmania publication remains unverified pending the normal publishing path. Protected admin decisions were not inspected.

## Tests

Regression checks cover exact APRA repair and edit preservation, asset-population scope, institutional footer removal, denied-URL versus origin rate-limit scope, Retry-After, bounded cache size, index error labels, Pulse discovery paths, short-stay law eligibility and unchanged rejection of old articles. The isolated database test checks APRA wording, previous timing correction, note retention and idempotence. Full CI is the merge gate.
