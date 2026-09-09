# Automatic social editorial programme

## One pipeline, not manual format prompts

The existing Sydney scheduler owns delivery. The five-minute Reel check uses
bounded, shared ABS caches and durable publication records. It makes no LLM or
speech call. Evidence-backed deterministic recipes produce the hook, finding,
meaning, limitation, next step, caption and source trail. Rendering only starts
for the selected ready candidate; its exact script drives both male narration
and subtitles. The cover and video carry the same editorial label and palette.

`getVerifiedReelProgramme` is the shared registry for publishing and the admin
explanation. Every recipe exposes its evidence requirement, selected hook,
reference month and publication state. Newest reference month wins; ties prefer
a different evidence family from the most recently confirmed available-topic
record, then stable registry order. This is a transparent editorial rule, not
an engagement prediction. Family rotation is limited to the candidate records
available in the current evidence window, not a reconstructed lifetime history.

| Recipe                 | Evidence                                          | Interpretation boundary                            |
| ---------------------- | ------------------------------------------------- | -------------------------------------------------- |
| Brisbane–Perth rents   | Matching annual CPI rent rates                    | Growth, not rent levels or yield                   |
| Brisbane–Perth supply  | 12 consecutive monthly approvals per city         | Permission, not completions                        |
| Eight-capital rents    | All eight rates, same reference month             | Range, not Australian average                      |
| What Changed: Sydney   | Two consecutive annual rates, non-zero difference | Change in annual rates, not monthly rent inflation |
| Before You Buy: Sydney | 12 consecutive Greater Sydney approvals           | Check stage, place and timing; no shortage verdict |

Each recipe has a permanent topic/month identity. Revisions never reset it.
Missing or invalid evidence means no candidate; narration/subtitle/render
failures block publication. Uncertain Meta responses keep their permanent
locks. The shared daily limit and Sydney evening window are unchanged. Five
monthly recipes are not five guaranteed posts or a twice-weekly programme.

Daily/weekly carousels also remain automatic: current Sydney feed/edition,
source references, explicit Australian scope, property-led source headline,
priority ordering, canonical story deduplication, source-preserving copy,
rendering and durable publication receipt. A neutral release headline may use
its source summary to establish relevance. A passing housing mention in a
broad political headline cannot lead. Foreign housing titles and known Canadian
Perth homonyms are excluded; unknown geography is held for carousels. This is
conservative rule-based selection, not complete geographic entity resolution.
Daily source records now preserve feed and publisher-declared publication dates.
Date checks run before enrichment and again during source selection; original
publisher dates cannot be replaced by a recent modified/feed date. Missing
publisher metadata is explicitly unconfirmed; missing legacy date records and
conflicting metadata hold automatic news publication. See
[property-news-quality.md](property-news-quality.md) for scope and limits.
Manual Wider Lens remains separate. No legacy post is edited or deleted.

## From the post to the evidence

The existing tagged homepage bio URL opens a Reel sources panel. `/social`
provides topic-matched free reads, an eight-capital rate table and a bounded
story-number lookup. Untagged homepage visitors have a visible sources link.
No profile edit, new account or AI answer is required. Source panels have
stable anchors, and Sydney's rent panel includes the previous annual rate so
the new story's comparison can be checked. Live panels can change after a post;
the visitor is told to match reference months. Archived evidence references
retain their `/evidence/:id` routes instead of invalid negative story IDs.

## Outcome collection, not fabricated learning

Instagram's existing scheduled insights collector retains the 24–48-hour
comparison window and sample counts. A new admin report aggregates 28 days of
first-party Instagram landing, onward-read, source-open and site-share sessions.
Only fixed editorial cohort labels are stored, in the existing event namespace
and campaign column; no raw query, city input, email join or persistent ID is
added. DNT, bot filtering and request limits still apply. Page views remain
separate from events. Missing data is unavailable, not zero.

These are separate distinct-session columns, not a joined conversion funnel.
Do not divide them into a conversion rate: an action can follow a landing
outside the selected window. Bio visits cannot identify the originating post;
forwarded links, new tabs and blocked tracking limit attribution. Confirmed
subscriber acquisition remains in its existing separate report. Public event
requests are observational, not authenticated proof of a human conversion.

Review results weekly at comparable post ages, inspect saves/shares with their
denominators, and change one editorial variable at a time. No automatic
frequency increase or claim of a winning recipe from tiny samples is added.

## Live review on 9 September 2026

Instagram browser access worked. Profile displayed 207 posts / 10 followers,
three navy pinned launch posts, and navy/light alternation beneath that row.
The newest visible carousel DdCqfhak60V contained a broad super/pension headline
and two US housing stories under Australian-property hashtags. Its link to
story 3810011 worked. At roughly 8h: 2 views, 3 likes, 0 saves/shares/profile
activity. Pinned comparison DdBeOKhk_r9 at roughly 19h: 5 views, 2 likes,
0 saves/shares/profile activity. These early, tiny observations are not
comparable 24–48h samples or evidence of audience growth.

The Brisbane–Perth comparison loaded with the matching source panels, but
Canadian Perth references and negative archived-story links were visible;
this release addresses both. No live Reel was identified in the inspected
grid, so actual published narration/subtitles remain unverified. The Desk admin
requires a fresh sign-in. Local browser preview access was blocked; synthetic
cards and complete videos are checked separately, then public UI after deploy.
Railway reported 14 separately staged changes on initial inspection; this
work does not accept or mutate that staging patch. Security changes on main
are preserved. No email, profile edit, manual Instagram post or paid API added.

# Social publishing and reading links

## Repeatable Reel captions

All five verified Reel recipes use `buildReelCaption`: short hook, exact finding,
meaning/limits, source method, revision flags, one save/share prompt and a
topic-specific reading direction. The 1,400-character editorial ceiling fails
closed; it never truncates numbers or limitations. This is deterministic copy,
not an additional model request.

Raw ABS API URLs remain on the existing evidence pages. Captions identify ABS
and the measure and link to the matching free Desk page. The compact bio page
shows every Reel topic, including Brisbane–Perth supply. Existing campaign
attribution names remain unchanged. Caption URLs omit fragment anchors because
Instagram interpreted `#housing-approvals` as a stray hashtag; the clickable bio
destinations retain their anchors. Eight-capital rent captions now point to
`/social`, which displays all eight values rather than only a market search.

Source pages can update after publication; every caption asks readers to match
the post's reference period. Periods, signed values, geography, series definitions
and revision flags stay in the caption. Audio scripts, evidence hashes, schedules
and permanent publication keys are unchanged; copy edits cannot republish a month.
This release does not edit existing Instagram captions or establish engagement gains.

## Published carousel reading links

The Instagram-tagged homepage and `/social` show up to six recent story links
(three on the compact homepage). These come from story IDs written to a
permanent slot receipt only after Meta returns a confirmed media ID. The
public response contains only the story ID, title, source, posting date and
server-owned reading URL. Account metrics and raw receipts remain private.

The read is cached for one minute and considers at most twelve confirmed slots
from the last thirty days. Missing/deleted sources and stories that no longer
pass the property/source-date rules are omitted. Old receipts without story
IDs are not reconstructed from rankings or fuzzy headline matching. The story
number form and archive remain available for those posts. The index is based
on saved confirmation, not a live Meta deletion check; manually removing a post
does not remove its still-public source story. It adds no Meta or model call.
