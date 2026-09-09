# Visual supply and demand Reel

The question is whether housing supply is keeping up with household demand.
The approvals are evidence about the start of potential supply. They do not
answer the whole question, and the Reel must not invent a shortage verdict.

The eight measured passages open with the question, reveal the dated Brisbane
and Perth approvals together, turn a permit into construction and a finished
home, introduce households needing homes, and return to the original question.
The images carry the exact figures. Narration carries their meaning, without
spending most of the clip reading five-digit numbers or a bio instruction.
The final frame and caption still name the exact visible bio destination.

Two bars share a zero-based scale. A short reveal of up to eight frames is followed by
reading time. Static closing graphics are rendered once. The same site holds its position through the building stages.
Gold represents supply and teal represents households. The house and household
illustrations are conceptual, not measured household totals, a one-to-one ratio,
a delivery forecast or a suggestion that all approvals become finished homes.
No invented people photos, local shortage sizes or completion rates appear.

The current adapter has city approvals, not matching city completion and
household-demand observations. The existing population series is state-level.
Do not combine it with city approvals to calculate a city shortage. A future
quantified supply-demand story needs matching geography, period and definitions,
including care with household formation, available stock and replacement homes.

## Repeatable editorial approach

Each episode needs one plain-English question, a concrete reason it matters,
verified evidence, a visual explanation and a takeaway that answers the question
as far as the evidence allows. Write that causal sequence before drawing scenes.
A statistic without an interpretation is not a finished story. Neither is a
series of caveats without a useful explanation.

Use motion to reveal the thing being discussed. Keep related objects in the
same position, introduce one concept at a time, give numbers time to be read,
and use subtitles to support the narration. Avoid adding effects without a
story purpose. Keep a consistent identity while varying the evidence, question
and visual device across episodes. Do not claim this single recipe improves all
other Reel formats or guarantees engagement. Review completion, watch time,
saves and shares against comparable posts after publication.

Every caption uses Australian English and no em dashes. The shared generation
rules state this explicitly. The two verified-caption builders and final Meta
submission guard reject em dashes and common American prose spellings. The
spelling check is a backstop, not a complete grammar checker; official names,
URLs and ambiguous words must still be reviewed in context. It does not silently
rewrite facts or proper names. Captions retain the date, source, definitions and
material revision flags, with a short AI narration disclosure.

## Selected voice and timing

Ruben selected local Fable after listening to the comparison. It is now the
production default at speed 1.0, including the child-process fallback and review
script. George and Daniel remain bounded audition options. Cache keys include
voice and speed. No paid service, credential or hosting change is introduced.

A scene starts at its measured WAV passage boundary. Sub-phrase subtitle timing
remains length-weighted, not word-level forced alignment. The renderer rejects
storyboards whose evidence identity, narration or order differs from the recipe,
and rejects measured videos above 32 seconds.

No scheduler, monthly publication key, daily quota, evidence hash definition or
uncertain-publication lock is reset. Revising the treatment cannot repost a month
already published. Other recipes keep their existing visual renderers, while
using the selected default voice and shared caption style guard.

## Reproduce the historical review

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm setup:voice
node --import tsx scripts/review-supply-reel.ts --out /tmp/desk-reel-review
```

The script uses the checked-in ABS snapshot matching the supplied July 2026 post:
27,628 Greater Brisbane approvals and 22,229 Greater Perth approvals. This is a
historical review, not a new release lookup. It writes a narrated and subtitled
MP4, caption, scene JPEGs, voice sample and metadata. It never publishes. Use
`--frames-only` for layout inspection, or `--voice bm_george` to audition George.
