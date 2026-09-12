# Automatic Reel companion Stories

Every newly published automatic Reel is enrolled for one companion video Story.
The Story uses the same reviewed full-screen visual sequence, approved local
Kokoro bm_fable voice at speed 1.0 and burned-in subtitles. It keeps the complete
opening, evidence and first explanation scenes, then the complete takeaway.
Passages are cut on measured scene boundaries. Exports are 1080x1920, 30 fps and
at most 35 seconds, with audible narration verified by decoding the result.

The fixed footer says “Full Reel on our profile”. This is a separate video
Story, not a native tappable Reel reshare or link sticker. Do not describe Story
reach as original Reel views or promise increased distribution.

## Delivery and recovery

The existing five-minute scheduler checks Story delivery after checking Reels.
There is no extra timer, paid service, posting schedule or manual preview publish.

1. The winner of the permanent Reel publication claim stores its exact stat and
   script in a separate immutable source record before the Meta publish call.
   It does not rewrite the Reel's publication receipt.
2. The scheduler reads durable confirmed Reel history. A source without a
   confirmed Reel media ID can never cause Story publication. Old posts without
   an enrolled source are not backfilled.
3. Within two hours of the Reel's confirmed publication, the worker claims a
   separate Story preparation attempt. It renders from the saved source using
   the production voice settings, extracts complete passages and creates a
   video STORIES container. The temporary MP4 remains available throughout
   Meta's processing wait.
4. Only a ready container can acquire the permanent Story publication claim.
   That claim permits one publish call. Its exact returned Story media ID is
   saved separately and read back before success is reported.
5. Preparation failures get at most two attempts, at least fifteen minutes
   apart. Interrupted preparation can expire after fifteen minutes. Confirmed
   or uncertain Story publication locks never expire or reset automatically.
   A rate/integrity error pauses preparation. Existing Story cooldown applies.
6. A Story failure never republishes or fails an already confirmed Reel.
   Source-storage and delivery faults appear in the existing server error log.
   If source storage failed, the Reel can still publish, but its missing Story
   requires inspection rather than an invented or substituted source.

Recovery after a restart requires no in-memory asset or new source fetch. The
worker re-renders the immutable source once per preparation attempt. This adds
local render work, bounded to two attempts per Reel; it uses no paid generation.

## Durable records

All records use the existing job_runs table. No database schema or Railway
settings change is needed.

| Record      | Identity                                              | Purpose                                                      |
| ----------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| Source      | reel-story-source-[hash of Reel publication key/date] | Exact immutable source, stored only by the Reel claim winner |
| Preparation | reel-story-prepare-[Reel media ID]                    | Bounded preparation retries                                  |
| Publication | reel-story-publish-[Reel media ID]                    | Permanent one-call lock and confirmed Story media ID         |
| Measurement | reel-story-reach-[Story media ID]                     | Separate Story reach snapshot                                |

Records retain the Reel's reference date. The media ID in each identity keeps
different publications distinct. Never clear a running or failed publication
record to force a retry. Inspect the specific Meta container if its outcome is
uncertain; do not guess from unrelated recent posts.

## Measurement

The same scheduler requests Story reach at the first check at least thirty
minutes after the Story's confirmed publication, within its first twenty-three
hours. One successful snapshot is retained with both media IDs, observation
time and actual age in minutes. An unavailable reading remains null, not zero;
at most two collection attempts are made, fifteen minutes apart. This is an
early observation, not a controlled estimate of incremental Reel reach.

## Review and verification

Tests cover confirmed-source gating, duplicate/racing workers, uncertain
publication, persistence failure, quota/readiness failures, cooldown, bounded
preparation, immutable source identity and isolated Story reach. The existing
real-voice Sydney checklist test also exports and fully decodes the Story.

Before release, inspect the actual narrated MP4, including the final passage
and the footer below the subtitles. After deployment, verify the Story plan in
runtime logs. The first future enrolled Reel must have a distinct confirmed
Story media receipt before anyone claims the Story actually went live.

Meta reference: https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media
