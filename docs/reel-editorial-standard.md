# The Desk Reel editorial standard

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

Open with the buyer's question: Australia is building homes, so why is buying
one getting harder? Establish
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
part of the demand bar. The competition illustration is symbolic, not a count of households or bidders. The closing additions bar crossing a need marker is
explicitly illustrative, without invented forecast numbers or dates.

The rejected white evidence panel and excerpt crops are removed. Show the full
Council name in a quiet, consistent source footer, followed by year and page.
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
