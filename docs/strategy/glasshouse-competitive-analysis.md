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

> **Correction, and what shipped.** The first Reel built off this section was
> silent, on my argument that feed video is watched muted and that licensed
> music is a rights problem. Ruben's verdict on the output was blunt and
> correct: next to theirs it was a slideshow. Two things were wrong in that
> argument. Muted viewing is an average across all video, not a description of
> the people who actually follow an account off a Reel. And "everything it says,
> it says on screen" is only true if the screen is worth watching — ours was
> four stills with a zoom that, because `zoompan` anchors its crop top-left by
> default, was not even pushing into the number.
>
> `server/video/statReel.ts` now narrates (`server/video/narration.ts`, OpenAI
> TTS), counts the figure up to itself, cross-dissolves its beats, and cuts the
> pictures to the *measured* length of each spoken passage rather than to a
> fixed table. The script is assembled from the card's own already-verified
> strings — nothing is written for the audio — so the factual-integrity contract
> is unchanged. Preview it at `/api/instagram/preview/reel`.
>
> What is still not fixed is the second half of this section: there is no face.
> A synthetic voice is not a person, and nothing here closes that gap.

### 3.4a One of their Reels, frame by frame

Ruben screen-recorded ten seconds of one. It is worth reading closely, because
most of what I had assumed about it from the grid thumbnails was wrong.

**It is not a data post. It is a documentary.** The caption reads "Frank Lowy
arrived in Sydney in 1952 with nothing. He'd survived the Holocaust, his father
was killed at Auschwitz, fought in Israel's war of independence at 17, and
landed in…". The subject is the founder of Westfield. The numbers are beats in
a story about a person, not the story.

**The format has a name and a slug.** A dim, letterspaced mono line sits at the
top of every frame: `, THE FILE · WESTFIELD · 1952 TO 2018`. Format, subject,
time range. It does in seven words what a masthead does.

**It opens on a count-up.** $3,575,021,484 → $20,712,729,352 → $29,431,589,748
→ $32,580,777,778 → $33,000,000,000, over roughly a second and a half, easing
hard into a round final figure. Same device I had already built, executed
better in three ways: monospaced numerals so nothing shifts, full precision on
every intermediate value, and a smooth 60fps count rather than discrete ticks.

**Elements accumulate; nothing is replaced.** A slug, then a label, then the
figure, then an archival photograph in a red-ruled plate captioned FRANK LOWY,
then a wireframe globe with a route drawing itself across it — Filakovo 1930,
Budapest the ghetto, Israel 1948, Sydney 1952. By the end the screen is a dense
dossier. Each beat adds an object of a *different kind* in a *different region*
of the frame. Ours stacks four text elements in one column.

**The frame never moves.** No push, no drift, no parallax. It reads as more
confident for it, not less. I had added a continuous zoom; it is now cut to a
third of what it was, and only to stop a four-second hold feeling frozen.

**Their route also draws in discrete steps** — one labelled dot at a time,
about a second apart. This is worth recording because it settled a question I
was about to spend a lot of render budget on: a stepped reveal of a data
element is not a defect, it is the convention.

**Two things I could not check.** iOS screen recording does not capture app
audio, so the track is silent at −91dB — the voice-over is still unheard, and
"Original audio" in the header is all we know about it. And ten seconds is
plainly the opening of a much longer piece.

**What this changes.** The visual craft is copyable and mostly now copied. What
is not copyable in an automated post is the archival research, the photograph,
and a script about a person. That is a produced piece, not a template — which
is the same conclusion section 8 reached about their product, arriving from the
other direction: their reach comes from things that do not scale, ours has to
come from something that does. The answer to their globe is not a globe. It is
the series: `server/og/sparkline.ts` draws the metric's own history under the
claim, captioned with its true range and reading count, and animates it across
the Reel. A news aggregator cannot print that line, because it is months of
readings nobody else assembled rather than a figure.

### 3.4b The second Reel, which inverts the conclusion above

A second recording arrived, of a different post. It is the more important of
the two, and it contradicts the thing I had just spent a day building for.

**The engagement is not close.**

| | Frank Lowy (documentary, voice-over) | Crown Sydney (data scan, no voice) |
|---|---|---|
| Likes | 566 | 1,319 |
| Comments | 19 | 11 |
| Reposts | 16 | 17 |
| Shares | 293 | **996** |

Their dense data piece beats their narrated documentary 2.3× on likes and
3.4× on shares. **Its audio is Nicholas Britell's Succession main title theme.
There is no voice on it at all.**

So the brief I was working to — "theirs had voice over" — was drawn from their
weaker format. The voice is not what is working. This does not mean ripping it
out: it is built, it costs a third of a cent a post, it is a real point of
difference against an account using a TV theme, and it is one of their two
formats. But it is not the lever, and the next thing to measure is a narrated
Reel against a silent one.

**What the winning post actually does.** A green mono status slug
(`SCANNING · CROWN SYDNEY, ONE BARANGAROO · GLASSHOUSE`). A two-line serif
headline with its numbers spelled out in words — "Eighty-two homes. One point
two billion dollars." A live counter in green climbing 28 → 61 → 87 SALES
FOUND. Four data points arriving one at a time, each a mono figure over a tiny
uppercase caption with a dot marker: `271.3m` tallest building in Sydney, `75`
floors, `$2.2B` to build, `146,500m²`. And a wireframe model of the tower
filling with green dots from the bottom up as the "scan" finds each sale, with
a slow dolly in at the end.

**The lever is density.** Seven specific numbers about one subject, against the
one number our Reel had. One number is a claim and people scroll past claims;
seven is a reference, and a reference gets shared 996 times. The wireframe is
not what is being shared — the wireframe is how they made a database query
watchable, and a database query is a thing we also have.

`server/metrics/statFacts.ts` is the response: the move on the previous
reading, the range across every reading held, the typical reading, and the
count of readings and how far back they go. All arithmetic on the same series
the chart draws, none of it written by a model, and each one omitted when the
readings do not support it — a four-reading series gets no "typical value",
because that would be a statement about noise.

**What is still not copied, and why.** No status slug in green (green is
theirs; ours is amber). No live "records scanned" counter — the honest version
of that is the metric count, and it is a smaller, less interesting number than
theirs. And no licensed music: a recognisable prestige theme is doing real work
for them and is the one part of that post that carries a rights question
somebody should answer before we imitate it.

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

**The data path changed, for the better.** Two corrections to earlier drafts:
`abs.ts` was never an SDMX client, it was a regex scraper; and scraping was
never the constraint. The ABS publishes all of it through a **free, keyless
official API**, which the ingest now prefers, with the proven scrape kept as a
fallback so no working metric can break during the switch.

This matters beyond tidiness. The API returns **whole time series**, so the
monthly review can rank a month against decades rather than against the year of
readings we have happened to collect.

**The consuming half is built.** Each move now carries how far back you have to
go to find a bigger one in the same direction, the card leads with that ahead of
the ratio, and a backfill converts an API series into the history the review
reads. That turns "2.3 times its usual month" into "the biggest fall since June
2022" — the Glasshouse-shaped claim, from free data, computed by us. It works on
the history we hold today and gets better the moment a flow is wired up.

It will not overstate itself: with nothing bigger behind a move the claim is
bounded by when tracking started, and under a year it says nothing at all.

**On mortgage arrears, a correction to my own suggestion.** I called swapping it
off LLM-news-extraction onto APRA a free win. It is free, but it is not the
small job I implied: APRA publishes it as a spreadsheet, this repo has no
spreadsheet parser, and there is no catalogue endpoint to probe the way ABS has
one. So it means a new runtime dependency plus guessing at sheet names and
column positions in a workbook nobody here has opened. That is the same mistake
as guessing a dataflow id, and it should be done probe-first or not at all. The
other three LLM-extracted metrics (auction clearance, dwelling values, consumer
sentiment) are genuinely paid data, so the workaround is right for them.

Remaining on this item: run `pnpm probe:abs` with network access to read the
dataflow ids off the catalogue, paste them into the `api` blocks, and the
interstate-migration series becomes a card in the same shape as The Number.

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
