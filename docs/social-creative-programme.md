# Finding-led weekly cards and eight-capital rent stories

## Weekly presentation

The weekly cover and Story lead with the first selected property topic's full
headline, not a contents list, edition-wide take or unrelated ASX strip. A
topic-specific reading question explains what to check before acting. The
edition week is explicitly an edition date, not an invented statistical period.
The caption and artwork point readers to the same numbered edition.

Navy/light selection stays owned by the existing publisher. Both cover shapes
share one design tree. Long headlines scale down, preserving trailing city and
time qualifiers; empty or over-200-character headlines fail for editorial
review instead of silently deleting part of a claim. Supporting-slide headline
clipping is removed too. Header, category and reading-prompt labels are larger.
The source-grounded weekly selection and copy rules are unchanged. Edition
topics still lack structured original-source provenance; the new visual does
not imply independently verified weekly synthesis.

## Third recurring Reel topic

Eight-capital rent growth reuses the existing bounded, cached ABS CPI rents
feed. It explains the range between the highest and lowest annual percentage
changes in rents actually paid. It is not a national average, dollar-rent
ranking, statewide measure, rental yield or investment recommendation. The
caption includes every capital and the common reference month, revision flags,
primary source, series URL and a Markets destination with distinct attribution.

All eight latest city observations must exist and share a completed reference
month no more than three calendar months old. The adapter rejects duplicate
rows, invalid months/flags/numbers, unknown cities, mismatched latest releases,
rates below -100%, and finer-than-one-decimal inputs that could mask displayed
ties. Retrieval must be valid and no more than 24 hours old (one minute of
forward tolerance allows a bounded fetch after the scheduler captures its
clock). A missing latest city never becomes zero or an older comparison.
Ties and negative rates have neutral wording. The evidence hash is canonical
by city order; the permanent topic/month lock survives revisions and copy or
voice changes.

The existing two topics keep priority and their publication records. The new
topic shares the existing Sydney evening window, daily cap, uncertain-response
locks, bounded retries, free male voice and required subtitles. No new provider,
credential, paid API or scheduled window is introduced. Three monthly topics
are not a twice-weekly editorial programme.

## Verification and audience review

`scripts/socialCreativePreview.ts` renders labelled synthetic review fixtures;
they must never enter the publishing data path. Optional `--video` creates a
spoken review clip. Logic tests cover complete/missing/stale/revised evidence,
ties and falls. Scheduler tests cover progression and the shared daily cap.
The real full-narration suite renders all three topics with audio and subtitles.

Phone-size image inspection checks actual layout; render smoke tests alone do
not prove that text fits. These changes do not establish better engagement.
Review first-day reach, shares/saves per reach and attributed Markets visits
after enough comparable posts exist. Live Instagram grid/retention checks and
full weekly source provenance remain separate work.
