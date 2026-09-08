# The Desk: Australian social rhythm

Implemented 8 September 2026. This is a four-week editorial/timing trial, not
an account-specific optimum or a growth forecast. The source of truth is
`shared/instagramSchedule.ts`; the admin panel uses the same rules even while
Ruben travels. No new service, subscription, credentials or spending.

## The working calendar (Sydney, DST automatic)

| Format | Eligible start | Job |
| --- | --- | --- |
| Property briefing + supporting Stories | Mon–Fri 7:30am | Existing source-led property selection |
| The Number | Tue/Thu 12:30pm, except the 1st | Existing property metric evidence bar; quiet days skip |
| Weekly recap | Sunday 9:30am | Existing weekly edition |
| Monthly property numbers | 1st 12:30pm | Replaces that day's number slot; only eligible property series |
| Narrated Reel | 6:30–8pm when a new verified topic is eligible | One Reel per Sydney day maximum; currently two monthly topics |

Five weekday briefings, two optional number cards and one weekly recap means
at most eight regular grid slots a week, plus qualifying monthly work. This is
not a requirement to fill all eight. Saturdays have no routine feed slot.
Evidence arriving after 8pm waits for the next evening. A second eligible Reel waits for
another day. No artificial daily videos or recycled month identities.

The morning read serves a Sydney start to the day. Lunch and evening provide
additional Australian time windows, including later local hours in the west
than a Sydney morning post would. These are hypotheses to test, not measured
follower activity. Example: the Reel's 6:30pm Sydney start is:

| Audience | While Sydney uses AEST | While Sydney uses AEDT |
| --- | --- | --- |
| Sydney, Melbourne, Hobart, Canberra | 6:30pm | 6:30pm |
| Queensland | 6:30pm | 5:30pm |
| South Australia | 6pm | 6pm |
| Northern Territory | 6pm | 5pm |
| Western Australia | 4:30pm | 3:30pm |

The IANA Australia/Sydney clock handles DST, including the October/April
transitions. Do not substitute a fixed UTC cron. Jobs check every five minutes;
rendering and Meta processing add time. Feed jobs stop catch-up after one hour,
so restarting at lunch cannot send an old morning briefing. Manual posting
remains immediate and is not governed by these automatic windows.

## Recognisable design and useful content

- Navy and warm off-white covers alternate against the last recorded grid post;
  amber is an accent. Pinned/manual posts can interrupt the checkerboard.
- Keep Playfair headings, a dominant number or property question, readable
  supporting text and restrained branding. Do not make a checkerboard more
  important than understanding an individual post in the feed.
- Existing Reel frames were inspected: question-led subtitles, dominant number,
  explicit geography/period, meaning and a relevant next step. No fresh live
  profile-grid/crop review was possible in the timed-out browser session.
- Male George narration tells the decision story. Subtitles use the same trusted
  script. The screen carries figures; the voice explains definitions, meaning
  and limits. Never manufacture causes, yields, completions or investment ranks.
- Daily/stat captions now use one useful save/share prompt, plus the relevant
  product destination. Broad ASX/finance hashtags are removed from the common
  tag set. Topics and useful explanations matter more than adding more tags.
- Monthly social selection now uses the existing exact property-series filter;
  the site's wider monthly data remains available separately.
- Weekly edition content still depends on that edition's editorial quality.
  This release does not convert every edition into a verified narrated story.

## How to learn without pretending we have a winner

Hold the schedule steady for four weeks; check delivery failures weekly. Avoid
changing voice, design, timing and topic simultaneously after one weak post.
Use the existing 24–48-hour metrics review: reach, saves/reach, shares/reach and
separate sample counts. This window is approximate, not equal exposure time;
format/topic differences and tiny samples cannot support causal conclusions.
Missing metrics stay unknown. Review watch time/completion in Instagram where
available; do not invent it or equate saves/shares with site visits.

Separately inspect attributed comparison visits and confirmed subscriptions.
A share-button click is not a proven share or returning reader. Keep original
sources and evidence limits in the destination. Evaluate a sequence of posts,
not just the highest single reach number. If data is insufficient, extend the
trial rather than inventing an optimum. No automatic engagement optimiser is
implemented. More varied verified Reel topics remain the next editorial build.

Primary references checked 8 September 2026:
- Meta's Instagram Insights guide describes follower locations and active times:
  https://www.facebook.com/business/help/441651653251838
- Instagram's originality/recommendations announcement:
  https://creators.instagram.com/blog/recommendations-and-originality
  (Search returned the official announcement; direct retrieval was throttled.)

These sources do not establish the proposed hours as optimal for The Desk.
