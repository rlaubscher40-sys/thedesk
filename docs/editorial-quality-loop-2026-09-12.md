# Editorial quality loop

Requested scope: group event coverage, check generated claims, carry editorial quality to socials, recover source discovery and turn coverage reviews into traceable fixes.

## Changes

- The daily page groups saved related-coverage relationships, chooses the highest-priority lead and exposes the other reports through accessible disclosure lists. Article IDs, source links and original reporting remain intact. Additional editor pins remain full cards. Relations are not labelled as independent confirmation or proof of identical events.
- Social story selection preserves editorial priority across eligible housing and financing stories. Related coverage is diversified within a selection; changed dates, figures, places and explicit corrections/withdrawals remain eligible. No permanent event-wide lock blocks follow-ups.
- Generated context is checked against the original headline, summary and extracted reporting for unsupported numeric units, figures, named places/months, housing delivery status, forecasts presented as outcomes and unqualified allegations. Checks run after generation, at ingest for supplied context, and within the durable completion transaction. Held fields remain null, the source story stays available and the job records `claim_fields_held`. Manual edits retain precedence. This is a bounded evidence-mismatch check, not general factual verification or a truth score.
- The source reader can try at most two explicitly configured public alternatives from the same publisher and channel. RBA speech RSS and its verified interviews/speeches index recover through each other. The normal cache, cooldown, request limits, article eligibility and publication-date checks still apply. Reports retain the primary failure, attempted alternatives and the route that returned candidates. Other failed publishers remain visible gaps; no paywall bypass or proxy is added.
- Must-cover reviews accept a diagnosed failure stage, evidence/fix note, change link and implementation timestamp. The review suggests the next investigation from saved outcomes and distinguishes open work, awaiting recheck and actual publication observed after implementation. Earlier publication and selected-only decisions cannot close a follow-up. This observation is not proof of causality or a substitute for an editor's regression review.
- Reviewed events trace their exact source reservations to Instagram carousel confirmations. A receipt must contain the actual article ID and a valid media ID. Reservations, malformed receipts, a similar-title lock and later/future receipts are not counted as delivery. Metric-backed reels retain their existing metric evidence contracts and are not falsely matched to article receipts.

## Validation and deployment

- Regression fixtures cover planned/completed housing, monetary and percentage units, conditional forecasts, alleged lending fraud, unsupported locations/months, grouping cycles/missing parents/editor pins, meaningful follow-ups, source recovery/cooldowns, remediation chronology and receipt identity.
- Database integration checks exercise unsupported-field persistence and confirmed versus uncertain social records. They run in CI's isolated MySQL database.
- Local TypeScript, frontend and server builds, dead-code audit and focused/broad tests precede full CI. Full database and video release gates remain required before merge.
- Read-only replay of the live September 11 feed groups the housing-model and investor-exit reporting while preserving every report. No social post was published to test this release.
- No new package, model call, paid source, schema migration or scheduled task is introduced. Existing saved daily reviews remain compatible.

## Ongoing measurement

Keep independently selected, editor-reviewed expected stories. For a confirmed miss, record the diagnosed stage, implement a source/reader/selection repair with a regression, link that change and recheck production. Unknown sampled evidence must remain unknown. A longer source list, passing tests or a single successful collection does not establish complete recall, factual accuracy or a 10/10 system.
