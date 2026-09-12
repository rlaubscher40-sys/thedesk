# The Desk Reel editorial standard

## Required across every automatic Reel, 12 September 2026

Full-screen visual storytelling is a programme requirement, not an optional
borrowing template. The earlier loan-only rollout left the next queued migration
story in its old text layout. A successful preview of one recipe did not verify
the whole rotation. Do not repeat that release mistake.

Every automatic recipe must have an explicitly reviewed sequence covering its
complete narration: full-screen opening imagery, relevant imagery in at least
one explanatory scene, and a photographic takeaway. Dense evidence comparisons
may use a clean full-screen graphic for legibility. Photography must support the
meaning of that beat; placing every old paragraph over an image is not sufficient.
Use sparse lower headlines so the photographic subject remains visible.

`server/video/reelVisualStandard.ts` is the shared sequence registry used by the
production gate and actual video renderers, including national housing. Unknown
recipes, missing scenes or incomplete opening/explanation/takeaway coverage are
rejected. Missing bundled images stop rendering before any upload. This proves
structural coverage, not semantic quality, factual truth or audience engagement.

Current sequences:

- Borrowing: bank, Australian money, home and measured repayment graphics.
- Population: moving boxes, net-movement comparison, a new home and construction
  context. No particular household, state-to-state route or suburb is asserted.
- Rent comparison: architecture, matched growth bars, money and price/cost checks.
- Capital rents: architecture, eight-city chart, money illustrating price vs rate.
- Sydney rent change: architecture, the two annual rates, money and their meaning.
- City approvals: construction, approval counts, building stages and a home.
- Sydney supply checklist: construction, the actual count, stage/place/timing,
  a home and a practical reading takeaway.
- National housing: the previously reviewed architecture, supply/demand graphics,
  deposit example and construction sequence remain in the same registry.

Retain local Kokoro bm_fable, speed 1.0, 30fps measured-speech count-ups, burned
subtitles, financial/data source notes and visible image credits. These bundled
photos use restrained camera moves; do not describe them as drone footage or
live video. Photographic scenes use the navy treatment even when clean charts
use a light variant. No paid source, runtime media search or extra scheduler.

Before releasing changes to this standard, inspect the rendered opening,
explanation, data and takeaway of every affected recipe, including the next
queued story. `scripts/reelVisualReview.ts` renders saved verified programme
candidates through the production renderer without publishing. Rehearsal JSON
records the exact candidate, sequence, measured timeline, voice and MP4 hash.
Unavailable sources and unchanged measures stay withheld; test fixtures remain
labelled synthetic and must never become current-market preview claims.

An already-confirmed Reel retains its publication lock. A visual redesign does
not authorise deletion, replacement, reposting or a changed publication key.

## Photographic covers and specific openings

Every future automatic Reel uses `renderReelCover`, not the old vertical stat
card. It takes the opening photograph from the same eight-recipe registry as
the video. Missing or unreviewed recipes, altered evidence/script bindings and
missing photographs stop cover preparation before a publication claim.

`reelOpening.ts` supplies the opening scene, spoken hook, caption hook and cover
headline. Source builders apply it before binding the verified script. Migration
copy handles net gains, losses and zero. Rent copy distinguishes the annual rate
from dollar rent and handles negative or tied observations. Approval copy does
not promise completed homes. Publication keys, reference dates and evidence
hash inputs stay unchanged when editorial copy changes.

The 1080x1920 JPEG keeps brand, headline, explanation, reference period and data
source inside y=420..1500, the centre square also retained by a centre 3:4 crop.
The full portrait includes the photograph credit. This is an authored crop
margin, not a guarantee of every Instagram app surface or user-adjusted crop.
Inspect exported portrait and centre-cropped covers at thumbnail size alongside
actual narrated opening frames. `scripts/reelVisualReview.ts` exports the cover
JPEG beside every voiced MP4 and its review metadata.

This release does not establish stronger retention or reach. Compare matched-age
audience evidence before drawing that conclusion. Expanding the curated photo
library remains a separate editorial improvement.

## Reference and purpose

Reference: https://www.instagram.com/reel/DcvHmYLAycw/ and Ruben's supplied
screenshots and descriptions. Direct playback was unavailable. Exact cut timing,
vocal performance and sound design have not been independently assessed.

The target is immediate understanding: what is happening, why it matters and
what the viewer should remember. Each important spoken fact needs a meaningful
visual counterpart. More animation alone is insufficient.

## Story before design

Write and review four beats before choosing graphics or synthesising speech:

1. Finding: what the evidence shows, with matched geography and period.
2. Explanation: the mechanism connecting the finding to an outcome, with its
   own source. A numerical comparison alone does not establish causation.
3. Consequence: the effect on the viewer's choices or circumstances.
4. Takeaway: the useful understanding the viewer should leave with.

Map each beat to an actual scene and record what the evidence cannot establish.
The housing recipe now carries this brief as structured data and validates it
before rendering. Missing beats, evidence or scene references fail. Changes to
its reviewed claims fail the existing exact-story validator. This structural
gate supports editorial judgement; it cannot prove that arbitrary prose is true
or compelling. Other formats must adopt the same editorial review standard;
this change does not claim automatic semantic review of every future post.

## Current housing story

Open with the measured finding: Australia added homes but fell about 55,000 short
of estimated new housing need. Establish
232,000 additions after demolitions versus 287,000 estimated extra homes needed
in the same national 18 months. Show the additional 55,000 gap. Then explain
how limited supply relative to demand puts upward pressure on prices and rents.
Make the human consequence concrete through the Council's modelled deposit
benchmark: 9.0 years in 2015 to 11.2 in 2025, with assumptions visible. Explain why high building costs and labour shortages impede a quick
response. End by resolving the question: building more is not the same as catching up;
net additions must outpace additional need to reduce the existing shortage.

Six sequences follow this argument, compressing the figures into one developing
comparison so the explanation arrives sooner. The previous ratio scene repeated the
finding without explaining it; it is replaced by competition and price pressure.
The public source read retains the ratio and the detailed definitions.
Interest rates, incomes and borrowing power also shape demand. The Reel must
not imply guaranteed price growth, that construction is always the largest
price driver, or that the 55,000 gap quantifies people priced out of a market.

## Design direction

The previous bold sans headings, coloured panels and house tiles were rejected
as too presentation-like and inconsistent with the website. Use its Playfair
Display editorial forms and Source Sans 3 prose, with JetBrains Mono confined
to small metadata. Bundled static subsets have separate derivative names and
retain their original copyright notices and the SIL Open Font License.

Use deep navy, warm ivory and muted gold. Prioritise large serif headlines,
italic emphasis, fine rules and generous space. Keep bars slim and consistently
scaled; hold the supply row in place as demand arrives. Mark the uncovered
part of the demand bar. The competition scene preserves that exact uncovered
segment and scale, then connects it to price and rent pressure. It does not
invent a count of households or bidders. The closing additions bar crossing a need marker is
explicitly illustrative, without invented forecast numbers or dates.

The rejected white evidence panel and excerpt crops are removed. Show the full
Council name in a consistent source footer, followed by year and page. Documentary
footers use 31px and 30px editorial sans at 1080px, with space above subtitles.
The public source read contains the report title, exact links and methodology.

Use licensed, credited real imagery where it adds context. Label archive
publication dates and keep imagery distinct from evidence of the specific
claim. The gold shortfall marker connects comparison, competition and deposit
scenes. The modelled deposit example has its own dates and assumptions; do not
imply that the 18-month housing gap caused its decade-long increase.

## Voice, timing and delivery

Use approved local Fable at speed 1.0. This reviewed story may run up to 46
seconds; other Reels retain 32 seconds. Never speed up narration to hide an
overlong script. Six sequences currently use eleven authored phrases (at most sixteen) through the
bounded local voice queue. Preserve 100ms before and 160ms after detectable
speech at phrase edges, with an 80ms join gap.

Measured phrase starts govern the comparison phases, deposit extension,
competition, construction constraints and closing takeaway. Use bounded animation steps and reading holds. Count-up
labels and bars share one eased value; internal geometry changes use hard cuts
on the 30fps grid. Text changes cut cleanly between sequences; only the gold
marker carries across. Do not dissolve entire text compositions over each
other. This is phrase timing, not forced word alignment.

Normalise the housing audio mix and encode stereo AAC at 48kHz in a fast-start
H.264 MP4. Check complete picture duration, actual encoded frames, subtitle
readability and decoded audio levels. Supply a direct MP4 download because the
inline preview has repeatedly failed for this user.

## Editorial gates

- State the story in one sentence before selecting graphics.
- Explain unfamiliar terms and give a concrete reason to care.
- Match figures to the same geography and period.
- Distinguish measured findings, reported context and illustration.
- Keep source attribution recognisable and the full evidence reachable.
- End with a usable takeaway rather than another repeated number.
- Use Australian English and no em dashes in captions.
- Assess retention, completion, saves and replies after posting. A design review
  cannot establish parity with Glasshouse's audience performance.

## Current review and research

See `reel-research-and-review.md` for primary references, the decisions they
informed, and checks on the finished export. Documentary subtitles use the
bundled editorial sans face rather than the monospaced metadata font. Other
Reel formats retain their existing subtitle treatment.

The opening uses a separate monochrome architectural photograph by Phillip
Flores. The construction photograph appears only with the supply constraints.
Both carry credit and context labels. The voice uses ordinary words such as
"estimated"; the precise modelling assumptions remain on screen and in the
caption/source read. Preserve the observed 2015 and 2025 values and their
measured phrase timing when simplifying the narration.

## Cinematic composition

The opening and construction scene now use the credited photographs across
the complete 1080x1920 canvas, with controlled pan and zoom and a dark gradient
behind the headlines and source notes. This is animated archival photography,
not drone footage, a timelapse or generated evidence. The construction image
continues behind the final explanatory graphic with a deeper navy overlay.

The comparison numbers are larger and their labels sit above them to avoid
collisions during count-up. Both bars retain the same zero baseline and scale.
The gold uncovered segment remains geometrically consistent as it moves into
the competition explanation. The deposit uses a separate endpoint timeline:
9.0 in 2015 and 11.2 in 2025. The same rounded value controls its number and
moving marker. Intermediate values are animation, not annual observations.
The housing marker no longer appears in the deposit scene, avoiding a floating
decoration or a visual conversion between different units and periods.

## Subtitle readability correction

The documentary subtitle band is centred on the full canvas at x540/y1540,
below the source notes. Use the bundled editorial sans at 54px with bold
weight and a restrained 1.5px outline. The former 44px regular face at x504/y1490
looked weak, off-centre and too close to the evidence footer on a phone.
Keep at most two lines, with up to 34 characters per documentary line. Prefer
sentence boundaries and balanced line lengths within a cue. Other layouts keep
their 32-character limit and positions. Preserve the narration and measured
cue intervals; do not add word-by-word highlighting or rewrite the spoken copy.

Fable, the reviewed narration, dates, qualifications and publication identity
remain unchanged. Gemini's supplied 10-second concept informed the expanded
composition, but its generated numbers and changing logos are not reused.
