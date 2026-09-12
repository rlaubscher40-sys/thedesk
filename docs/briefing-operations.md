# Briefing selection and acceptance

The automatic weekday briefing uses `pickBriefingStories` and
`unpublishedBriefingSelection`. Current Sydney feed/date, source timing,
Australian property scope, canonical story identity and permanent publication
locks remain required. There is no model call or additional paid source.

Reported data/news rank ahead of announcements, forecasts and commentary.
These are lexical editorial labels, not fact-checking scores. A quoted speech
remains a reported statement, not proof its prediction will occur. Explicit
promotional copy, boilerplate, missing usable detail and the observed auction
sales/clearance-rate mismatch are held. Headlines and summaries stay attributed
publisher copy. The entire eligible day is checked for prior publication before
limiting to three stories; six used stories cannot hide a seventh fresh item.
Canonical URL and normalised-title checks do not detect every paraphrased
duplicate event. No claim of perfect story selection is made.

Admin's **Why these briefing stories?** is a read-only view of the same picker.
It is neither a reservation nor a promise to publish. Rehearsals use the same
picker but cannot recreate historical publication locks. The preview script no
longer overrides the lead with an earlier hand-selected story.

New daily carousel receipts carry `briefingVersion: story-v2` and
`storyFollowupVersion: 1`. Every companion image Story has an `ig-story-` claim
derived from its confirmed carousel media ID and source ID. One non-idempotent
Meta call follows the claim. Success requires a read-back of that exact Story
receipt; timeouts and unavailable persistence remain locked. The admin audit
distinguishes confirmed, uncertain, not confirmed and older untracked Stories.
The existing spaced background delivery is retained. A restart before delivery
can still interrupt it; missing confirmation must not be treated as success or
used to reset a publication lock. This is receipt tracking, not a new recovery
worker. It does not change the separately implemented Reel Story flow.

The existing scheduler collects feed insights at **08:17 and 20:17 Sydney**.
Previously its sole 07:17 run was before the 07:30 briefing, delaying that
format's first mature reading to almost 48 hours. Existing bounded batches,
12-hour per-post retry spacing and preserved first-day snapshots remain.
Collection logs now include observation/publication times and returned counts
alongside persistence status; a failed persistence result is not saved evidence.
No credentials are logged. The report defaults to the **24–30-hour** band, with
30–36, 36–42 and 42–48-hour alternatives. Each metric retains its own sample count;
unavailable counts stay null and zero reach cannot form a rate. This is a
descriptive comparison, not causal evidence of design improvement. Profile
visits and follows are not provided by this report; do not label them zero or
infer them from reach or website clicks.

Next acceptance: inspect an actual scheduled weekday carousel's media ID,
caption, source links, cropping and companion Story IDs, then compare several
same-age save/share readings. Deployment and rehearsal images alone do not
establish publication or engagement. Use authorised admin access and Railway
logs; never post a rehearsal or reset uncertain locks to produce acceptance.
