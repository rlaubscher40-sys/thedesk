# Coverage follow-through, 17 September 2026

The audit identified four unmatched events, one duplicate and a misleading population standfirst. These changes address the verified code paths; they do not claim comprehensive event recall.

- CBA discovery restricted article slugs to `asx-close` and `australian-shares`. Its current index includes both the IMF report and a new ASX-close slug outside that pattern. Discover dated newsroom paths, then retain ordinary relevance, original-date, rights and evidence checks.
- NSW discovery searched only title housing keywords and rejected titles shorter than 18 characters. Search indexed release content, allow short official release titles, and use the publisher's index summary only to rank reading. It never supplies article evidence or a publication date.
- The Queensland land search contains Glenden's September 15 release. Add that route and recognise worker-accommodation legislation in independently retrieved official release text. A registration of interest is not a completed land sale, and an introduced bill is not enacted law.
- NSW and Queensland official release paths can establish their topic from the article body, as existing designated primary releases do. Unrelated releases remain ineligible. First-person NSW statements receive the ministerial role explicitly declared on that release.
- Recognise Al Jazeera's `traffic_source` as tracking only on that publisher. The same canonical identity governs discovery, recent-story filtering and durable insert claims across channels. Preserve content IDs and case-sensitive URLs elsewhere.
- Guarded, repeat-safe record corrections withdraw duplicate 3960020, retain 3960010, and correct population story 3960017 against the ABS primary release. Existing notes and subsequent edited fields remain intact. The population commentary now distinguishes slower growth from a capital loss and correlation from causation.
- Prefer a relevant opening finding over a keyword-heavy later aside. Preserve the strongest matching sentence when the opening is unrelated. These are bounded extractive rules, not semantic certification.
- Read saved editorial reports back from the database, verify the complete JSON and log a compact success receipt. A mismatch throws rather than reporting success.
- One durable scheduler claim runs a collection limited to the three updated source routes after deployment. Existing source dates, publication locks, legal holds, deduplication and enrichment remain in force.

## Verification

Captured live index/article replay selected the four audited URLs through ordinary selection gates, with original dates and non-empty excerpts. Other index candidates were excluded from that replay, so it is not a full production ranking benchmark. Local checks passed 838 tests, TypeScript and dead-code checks; two database-dependent tests await full CI, including exact correction guards and a 170-source/300-decision report round trip.

Production publication, correction visibility and report read-back receipts must be checked after deployment. Recurring ATO/Victorian timeout reports and Reuters access denials are not established causes of these misses. Access restrictions and source-rights holds remain enforced.

## Production follow-up

PR #310 passed all 2,791 tests and deployed. The scoped recovery saved and read back its complete report (3 sources, 50 retained decisions) and published the IMF, Town Hall and Glenden events. Live checking also exposed a regression: generic economic/housing mentions in state-government releases admitted five unrelated articles; publisher limits then excluded the apprenticeship report.

The corrective change requires state-release relevance in the title and first two substantive paragraphs, extending to four for apprenticeship/workforce headlines (bounded to 1,800 characters), with a housing, planning, worker-accommodation or property-tax subject. Generic productivity/employment language and distant background mentions cannot qualify these releases. Animal rehoming and award-winner announcements are excluded explicitly. Five exact new records are withdrawn without deleting notes; the Town Hall excerpt is corrected to preserve the procedural qualification. A distinct, one-time claim collects the repaired routes again while normal duplicate checks prevent replaying published stories.

The corrective patch passes 846 local tests, TypeScript and the dead-code check. Its full CI and production result remain separate gates. The initial four-URL replay was insufficient to detect competition from unrelated candidates; subsequent verification uses the entire captured set of 50 candidates and independently retrieved articles.

The full captured-source replay retrieved all 50 candidate article pages. With no prior-publication set, all four audited events pass and the unrelated releases are excluded. With the URLs observed as already published, only the missing apprenticeship release is selected.
