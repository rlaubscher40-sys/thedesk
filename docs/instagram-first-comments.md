# Automatic first comments

New confirmed feed posts and Reels enrol one short editorial question when
their post record is saved. The question is selected from the published lead
headline (lending, rents, supply, migration, auctions, affordability or prices).
Briefing and neutral fallbacks never invent a fact, source, personal opinion or
property angle. Copy uses Australian English, no em dashes, links, hashtags or
mass tagging, and at most 300 characters. No additional LLM or paid service.

## Delivery

- The existing five-minute scheduler sends at most one comment per account per
  five-minute bucket across replicas, between five minutes and two hours after
  enrolment. This is an operational interval, not a claimed algorithm optimum.
- Post recording and the immutable question are written in one transaction.
  Recovered publications do not enrol. Duplicate recording cannot change the
  question or restart its clock; existing posts are not backfilled.
- A separate permanent per-media claim precedes the single non-idempotent POST.
  Timeouts, missing IDs, interrupted workers and persistence failures never
  unlock it. Only the exact returned comment ID with a read-back receipt counts
  as confirmed. Investigate uncertain outcomes on the original post manually.
- Account permission, token and rate/integrity failures pause all comments for
  24 hours. Those posts remain locked; a later fresh post may try after the pause.
- Missing durable storage stops commenting. Comment failures do not retry the
  original Reel/carousel or block Story delivery. All records use `job_runs`;
  no schema migration or second scheduler is required.

The connected token needs `instagram_manage_comments` for the existing
Facebook Login integration, in addition to its publishing permissions. Having
permission to publish media does not establish permission to comment. A logged
`access_denied` needs the token/app permissions inspected and, if necessary,
the account reauthorised. Never print the access token in logs or support copy.
The release performs one bounded, read-only comments request against the latest
recorded post and logs `[first-comment-access]`. This verifies read access
without sending a test comment to an old post; the first future confirmed
comment remains the end-to-end write check.

## Measurement and operational checks

The insights collector subtracts the programme's one verified comment from the
stored comment and total-interaction counts. It checks the exact saved comment
ID; an uncertain publication, unavailable database or unreadable comment leaves
those counts unknown instead of inventing zero. Likes, saves, shares and reach
remain unchanged. Manually written account comments are not classified by this
programme. Historical readings before this feature retain their previous meaning.

Runtime logs use `[first-comment-plan]`: `published` includes both media and
comment IDs, `nothing-due` means no eligible unclaimed source, and `locked` or
`paused` requires inspection. The existing admin server-error log exposes failures.
Do not claim a first comment went live without a confirmed comment receipt.

## Story distribution

Keep the existing automatic companion video Story, saved-source recovery,
one-publication claim and separate Story measurement. Production logs on
14 September confirmed Reel `18087576824244605` with companion Story
`18081216389336980`. This change does not publish another copy of that Story.

Pinning comments, native reposts and the tappable native Reel-to-Story card
remain manual. Companion Stories say “Full Reel on our profile”. A second
Story is not automatically scheduled here: resurface selectively after real
performance evidence and a fresh editorial takeaway, not as a blanket repeat.
There is no guaranteed engagement or reach uplift.

Meta reference: https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-media/comments
