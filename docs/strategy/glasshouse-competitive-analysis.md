# Glasshouse: what they are doing, why it is working, and what we take from it

Date: 6 September 2026
Subject: `@glasshouse.aus` / heyglasshouse.com

---

## 1. First, correct the frame

Glasshouse is **not a competitor to The Desk as a product**. It is worth being
precise about this, because the wrong frame produces the wrong roadmap.

|                | The Desk                                                | Glasshouse                                                        |
| -------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| What it is     | A subscription media product on Australian property      | Consumer/agent iPhone app                                          |
| Core asset     | Aggregated public news (RSS) + LLM editorial layer       | Proprietary property dataset (5M+ AU properties, Valuer General)   |
| Who pays       | Nobody yet. Free list now, paid tier the goal            | End users, 3-day free trial into subscription                      |
| The job it does| Tells you what moved in Australian property, and why     | Tells you what the house in front of you is worth                  |
| Instagram is   | The top of the acquisition funnel                        | The entire top of the acquisition funnel                           |

They are not taking our customers. **They are taking the same attention we are
trying to build**, in the same category (Australian property), on the same
surface (Instagram), and they are doing it far more effectively.

So the honest read is: they do not beat us at the thing The Desk is. They beat
us badly at the thing The Desk's Instagram account is trying to be. That is the
comparison worth acting on, and everything below is scoped to it.

**Correction (6 Sep).** Earlier drafts of this document described The Desk as an
internal briefing tool serving InvestorKit partnership work, and treated its
audience as "partners". That is wrong: this is a standalone product whose goal
is an audience that eventually pays for a subscription. The mistake came from
the repo describing itself that way — the README opens with "Private
intelligence briefing tool for Ruben Laubscher (Head of Partnerships,
InvestorKit)" — and it matters beyond this document, because the same framing is
baked into the content generators. See item 9.

---

## 2. The scoreboard

From the profile as observed:

- **24 posts. 57.2K followers. 4 following. Verified.**
- A broadcast channel ("glasshouse updates", 191 members).
- Bio: "Property intelligence. Building Glasshouse." → single link to
  heyglasshouse.com.

That is roughly **2,400 followers acquired per post published**.

The Desk, by contrast, publishes on three automated schedules:

- `instagram-daily` — 07:13, a 3-story carousel
- `instagram-coverage` — 12:13, the "Wider Lens" carousel (tech/business/global)
- `instagram-weekly` — Sunday 09:19, edition cover + topic cards
- plus 24h Stories (currently able to be paused via `INSTAGRAM_RESUME_DATE`)

That is **~90 posts a month against their ~24 all-time**. We are outposting them
by more than an order of magnitude and losing. Volume is not the lever, and
continuing to pull it is actively costing us: three mediocre posts a day trains
the ranking system that our account is low-engagement, which suppresses the
reach of the good posts too.

---

## 3. Why they are winning — seven structural reasons

### 3.1 One post, one number, one idea

Every Glasshouse post resolves to a single sentence built around a single
figure:

- "21,465 people left New South Wales."
- "$1.66B wiped off Australia's asking prices."
- "50 years of house prices."
- "$4 billion. Ten banks."

Ours resolves to "here are the three stories moving Australian markets today."
That is a *table of contents*, not a hook. A table of contents has no
screenshot value, no share trigger, and nothing for a viewer to react to in the
half-second the algorithm gives it.

This is the single biggest gap and the cheapest one to close.

### 3.2 They lead with the number; we lead with the headline

Compare the information hierarchy.

Glasshouse card: the **number** is the headline, set huge in a serif. The
context ("MORE THAN ANY STATE HAS LOST IN TWENTY YEARS") is demoted to small
letterspaced mono underneath.

Our `renderDailyStoryCard`: the **news headline** is the 60–74px serif hero, and
the number, if there is one at all, is buried in the why-it-matters body text at
17px.

We already have the right typographic system. We are pointing it at the wrong
content.

### 3.3 Open loops that force carousel completion

Their cards end with an explicit swipe instruction: "WHERE THEY WENT →",
"STATE BY STATE →". The first slide poses a question the rest of the carousel
answers. Completion rate is one of the strongest ranking inputs Instagram has,
and they are engineering it deliberately.

Our carousels are three *unrelated* stories in priority order. There is no
reason to reach slide 2, and slide 3 answers nothing that slide 1 asked.

### 3.4 Video, and a face

Their grid carries multiple Reels: a founder talking to camera on a street, and
what is clearly a produced mini-documentary ("$4 billion. Ten banks." /
"THE PENTHOUSE SYNDICATE · A GLASSHOUSE STORY · 2026"), plus an animated chart
piece.

**We post zero video.** Reels remain the only surface on Instagram that reliably
delivers reach to non-followers. A static carousel is a retention format shown
mostly to people who already follow you. We are running a retention format as an
acquisition strategy, which is why the follower count does not move regardless of
how often we post.

The talking-head piece matters for a second reason: it puts a human on the
account. Ours is anonymous and visibly automated.

### 3.5 Proprietary data versus aggregated news

This is the deepest advantage and the hardest to copy.

Glasshouse owns the dataset. "1,179 price drops this week, 148 rises, median
-6.0%, 16,015 homes listed below what they asked" is a number **only they can
publish**, computed from their own index. It is inherently novel, inherently
un-scoopable, and it doubles as a product demo — the stat *is* evidence the app
works.

The Desk ingests Google News RSS and public feeds. By the time we post it, the
AFR has already run it, and so has every other property account. We are
competing on framing of commodity information. That is a losing position on a
recommendation-driven feed, because novelty is the input.

**But we are not as empty-handed as that sounds — see section 4.**

### 3.6 Named, recurring franchises

Their formats are audience-facing brands with fixed templates:

- "WHAT'S HAPPENING IN AUSTRALIAN PROPERTY" (dated, W/E 6 September 2026)
- "WHERE AUSTRALIANS ARE MOVING"
- "BIGGEST CUTS THIS WEEK"
- "A GLASSHOUSE STORY"

A viewer learns the format, then anticipates it. That is what converts a
one-time viewer into a follower — following is a bet on *future* posts, so the
account has to make the future legible.

**Correction (6 Sep, on implementation).** An earlier draft of this section
said our formats carry only internal job names (`daily`, `coverage`, `weekly`)
and needed audience-facing ones. That was wrong, and checking the renderers
before acting on it is what caught it. The covers already carry proper titles:
"Today's Briefing", "The Wider Lens", "This Week in Australian Property", and
now "The Number". This gap was mostly already closed; what was missing was the
open loop below, not the naming.

### 3.7 The content has somewhere to go

Their funnel is complete and short: post → bio → heyglasshouse.com → App Store /
waitlist → 3-day trial → subscription. The content and the product are the same
argument. "You see a property. Why guess what it's worth?" is simultaneously the
hook and the pitch.

**Correction (6 Sep).** This section previously said we have no offer at the end
of the funnel. That was wrong, and checking the repo before recommending
anything is what caught it. The Desk has a real product: a double opt-in email
newsletter (daily brief + weekly recap), with an `isPremium` flag already on the
subscriber table for a paid tier. The funnel is post → bio → site → subscribe.

The actual problem was narrower and more fixable: nothing measured whether it
worked. `subscribers.source` recorded which *form* converted someone, never
which *channel* brought them, so an Instagram subscriber and a Google one were
indistinguishable. That is now closed — see 5a.

---

## 4. What we already have that we are not using

This is the encouraging part. Most of the machinery needed to close the gap is
already built and running in this repo.

| Asset we already have | Where it lives | What it could be |
| --- | --- | --- |
| **~30 tracked AU metrics with daily history** | `daily_metrics` + `daily_metric_history` | The raw material for "one big number" cards. We are already storing cash rate, auction clearance, national dwelling value, mortgage arrears, consumer confidence, net migration, building approvals, CPI, unemployment, wage growth — every day, with the previous value and a full time series. |
| **A working ABS SDMX client** | `scripts/ingest/lib/abs.ts` | Glasshouse's "21,465 people left New South Wales" is ABS interstate migration. We already have the client that queries this API. We are pulling five series from it and could pull the demographic ones that make the best cards. |
| **`context` field on every metric** | `daily_metrics.context` | Already designed for exactly the Glasshouse subtext line: "ANZ NOW EXPECTS EXTENDED HOLD", "BELOW 60% FOR 7 STRAIGHT WEEKS". |
| **A full Instagram publishing pipeline** | `server/instagram/`, `server/og/instagramCards.ts` | Graph API, quota handling, duplicate guards, publish-verification, temp image serving, six card renderers. Adding a format is a renderer plus a job, not a new integration. |
| **Engagement metrics coming back in** | `instagram_posts` (reach, saved, shares, likes, comments) + `instagram-insights` job | We can actually measure which format wins. Nobody is looking at this data. It is the fastest way to stop guessing. |
| **A real editorial voice, enforced** | `server/prompts/voice.ts` | Single source of truth, already applied to every generator. |
| **Design system that is genuinely close to theirs** | Playfair Display + JetBrains Mono + deep navy + amber | Our visual language is *not* the problem. Serif hero, letterspaced mono kickers, hairline rules, no rounded cards — that is the same design thesis Glasshouse is executing. |

We have a metrics warehouse and a publishing pipeline, and we are using neither
to make the kind of post that actually travels.

---

## 5. What to implement, ranked by leverage against effort

### Tier 1 — high leverage, low effort, uses what exists

**1. A "one number" stat card format.**
New renderer variant plus a prompt that picks the single most striking figure
from the day's `daily_metrics` movement (largest delta, longest streak,
threshold crossed) and writes one Glasshouse-style line for it. The number is
the hero at ~200px+; `context` becomes the letterspaced mono subtext; source
and as-of date go in the footer rule. This is the format that built their
account and we have the data warehoused already.

**2. Cut posting volume by roughly two thirds.**
Kill or heavily reduce the midday "Wider Lens" coverage carousel. It carries no
partner angle, no proprietary insight, and no reason for an Australian property
audience to engage. Three posts a day of commodity news actively suppresses the
account. One strong post a day beats three weak ones on every ranking input
that matters.

**3. Name the franchises and put the name on the card.**
~~Give each format an audience-facing name in the kicker slot.~~ **Already
done** — see the correction in 3.6. The covers carry real titles; only the new
stat format needed one ("The Number").

**4. Add the open loop.**
Slide 1 poses, slides 2–n answer, and the first card names what the swipe
actually buys. Direct effect on completion rate, which is one of the strongest
ranking inputs on a carousel.

**5. Actually read the insights we are already collecting.**
`instagram_posts` has reach, saves and shares per post, refreshed daily. Build
the one admin view that ranks formats by saves-per-reach. Then let the data,
not this document, choose what we post.

### Tier 2 — high leverage, real effort

**6. Video.**
Even the lowest-fidelity version — a slow Ken Burns pan over the hero image with
the stat animating in, rendered server-side — puts us on the only surface that
reaches non-followers. The higher-fidelity version is Ruben to camera, 30
seconds, once a week, on the week's most interesting number. That solves the
"faceless automated account" problem at the same time.

**7. ~~Build one genuinely proprietary series.~~ Started (6 Sep).**
We cannot match their transaction data. We do not need to. We have a year of
daily history on ~30 Australian macro and property metrics that nobody else is
charting together.

**"The Month in Numbers" now exists** (`server/metrics/monthlyReview.ts`, on the
Trends page). It ranks each metric's month against that metric's *own* normal
monthly move, which is only possible because we kept the history — and which
immediately reorders the obvious reading: a 2.9% ASX month ranks below a 0.22
point CPI month, because the first is ordinary for the ASX and the second is
twice normal for CPI.

**It now publishes** on the 1st of each month, as a carousel that leads with
the biggest move rather than a contents page, and skips a month where nothing
cleared its own range.

**Interstate migration is started, not finished.** A correction to an earlier
claim in this document: `scripts/ingest/lib/abs.ts` is not an SDMX client, it
is a regex scraper against ABS release pages shaped for one headline number per
page. A per-jurisdiction extractor now exists and is tested
(`scripts/ingest/lib/absStates.ts`), including the check that makes this series
attractive — interstate migration must sum to about zero across the eight
jurisdictions, so a bad extraction is detectable rather than publishable. It is
deliberately not wired into the daily ingest, because ABS is unreachable from
the environment this was built in and only the live page can prove the
patterns. `pnpm probe:abs` is the one command that closes that.

Remaining on this item: run the probe with network access, wire the series in,
then it is a card in the same shape as The Number.

### Tier 3 — the strategic question, not an engineering one

**8. ~~Decide what the Instagram account is for.~~ Resolved.**
The account is the top of the funnel for a subscription product: audience
first, paid tier later. The offer already exists (the newsletter), and as of
5a the conversion from channel to subscriber is measured. What was a strategic
question is now a reading on a panel.

**9. ~~Strip the partner framing out of the content generators.~~ Done (6 Sep).**
The prompts still write for a persona this product does not have. Every feed
item gets a `partnerTag` block addressed to
`Institutional / Broker / Adviser / Buyers Agent`, and `sayThis` is generated
as a line to open a *partner conversation* — the ingest brief literally asks
for "why a partner would care". For an audience of property-interested readers
being asked to subscribe, that is the wrong reader in the model's head on every
generation, and it shapes the daily feed, the Instagram captions and the weekly
edition alike.

The partner roles became three reader positions (Buying / Holding / Watching)
and every generator now writes to a reader rather than an intermediary. It was
more than a prompt edit in the end: the personas had schema, UI in two design
systems, persona colours and site copy behind them.

With that done, the remaining gap to Glasshouse is entirely Tier 2: video, a
face on the account, and a number nobody else can publish. Nothing in Tier 1
or in this item moves the account past its current ceiling — they make the
existing posts work harder and make the copy address the right person. The
attribution loop should now be allowed to run long enough to say whether the
funnel converts before committing to video.

---

## 5a. What has shipped against this (as at 6 Sep)

- **Tier 1.1 — the stat card format.** Done. "The Number" posts one metric a
  day at 16:41, chosen by `server/instagram/statPick.ts` from our own metric
  history and rendered by `renderStatCard`. It publishes nothing on a day when
  no metric clears the bar, which is the behaviour that keeps the format worth
  following. The figure and the claim under it are computed, never generated,
  and a model-written line that introduces a figure absent from the source
  facts is discarded.
- **Tier 1.2 — cut the posting volume.** Done. "The Wider Lens" is off the
  schedule. The day's run is now the 07:13 briefing and 16:41 The Number, plus
  the Sunday edition: two scheduled grid posts a day instead of three. The
  endpoint and admin button survive for a hand-fired one.
- **Tier 1.3 — name the franchises.** Was already done; see 3.6.
- **Tier 1.4 — the open loop.** Done. The cover's swipe line names the payoff
  it withholds rather than the headlines it just listed, and the caption opens
  with the day's own hook instead of a sentence that never changed.
- **Tier 1.5 — read the insights.** Done. The admin panel now compares formats
  on median saves, shares and engagement per 1,000 reach
  (`client/src/lib/instagramInsights.ts`). It declines to name a winner until
  two formats have at least four measured posts each AND the gap between them
  is wide enough to survive a sample that small, because a confident league
  table built on five posts is worse than no table.

- **Attribution (added 6 Sep, not originally in this plan).** Subscribers now
  record the channel they arrived from, not just the form that converted them,
  and the admin groups them by it. This was done before any Tier 2 work
  deliberately: video is the most expensive item on the list and its value
  depends entirely on whether this funnel converts, which nothing could
  previously answer. A day spent deciding whether to spend weeks.

**What Tier 1 has not changed.** Everything above makes the existing posts work
harder. None of it puts us on Reels, gives the account a face, or produces a
number nobody else can publish — items 6 and 7, which are where the actual
distance between the two accounts sits. Expect the measurements above to show
formats separating from each other, not the account separating from its
current ceiling. That comes from Tier 2, and from section 8.

---

## 6. What NOT to copy

- **Do not chase their post volume downward as an aesthetic.** Their 24 posts
  are not the cause; the quality per post is. Posting rarely and badly is worse
  than what we do now.
- **Do not redesign the cards.** Our visual system is already in the right
  family. The gap is what the cards *say*, not how they look.
- **Do not invent numbers to make punchier cards.** Every figure we publish has
  to trace to `daily_metrics.sourceUrl` or a named release. Their credibility
  advantage is that their data is first-party; ours has to be that ours is
  sourced and checkable. Losing that loses the only durable position we have.
- **Do not build a property-data app.** They have a dataset and a head start.
  That is not the fight.

---

## 7. The one-line version

They publish one surprising, proprietary, screenshot-able number at a time and
point it at a product you can buy. We publish three commodity news headlines a
day and point them at an internal tool. We already own a metrics warehouse and a
publishing pipeline good enough to do the former — we have simply never pointed
them at each other.
