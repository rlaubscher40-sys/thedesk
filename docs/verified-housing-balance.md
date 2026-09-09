# Australia: the gap between new supply and new demand

The useful finding is that net new supply covered about 81 homes for every 100
additional homes needed. The approximate flow shortfall was 55,000 homes in the
18 months from July 2024 to December 2025. Building a large number of homes did
not mean the country was catching up with additional demand.

## Reviewed source

National Housing Supply and Affordability Council, *State of the Housing System
2026*, released 30 April 2026. Printed page 21 (PDF page 32) reports all three
figures together for the first 18 months of the Housing Accord:

| Measure | Approximate dwellings | Treatment |
| --- | ---: | --- |
| Gross completions | 263,000 | Homes finished in the period |
| Net new supply | 232,000 | Completions after demolitions |
| New underlying demand | 287,000 | Estimated additional housing requirements |

Source: https://nhsac.gov.au/sites/nhsac.gov.au/files/2026-04/ar-state-housing-system-2026.pdf#page=32
Publication: https://nhsac.gov.au/reports-and-submissions/state-housing-system-2026
Downloaded PDF SHA-256: `23ebfc6b1439c5506e3cc607a8f44e34b5b5f310b80fed9f84407a130630eb57`.
Extraction checked on 9 September 2026 against the rendered page and glossary.

Calculation: 287,000 - 232,000 = approximately 55,000 additional shortfall.
232,000 / 287,000 × 100 = 80.84, rounded to 81 net new homes per 100 needed.
263,000 - 232,000 gives approximately 31,000 implied demolitions. This is derived
from rounded numbers, not an independently published exact demolition count.

The report also includes an older 2024-25 annual comparison. This recipe uses the
later 18-month window above, consistently throughout the script, pictures,
caption and public source page. Do not mix its numbers with the annual window.

## Scope and refresh

These are national historical flows in dwellings for one common period. Demand
is modelled from demographic characteristics and household formation. It is not
raw population growth, a target, approvals or buyer enquiries. Glossary: printed
page 93 (PDF 104). Model discussion: printed page 73 (PDF 84).

The difference is not Australia's accumulated shortage, a count of homeless
households, a city comparison or a price/rent forecast. The 100 house icons show
a rounded ratio, not 100 real dwellings. No local shortage is inferred from state
population or city approvals. The original approvals recipe stays an approvals
explanation, while this sixth recipe supplies an independently matched finding.

The checked-in snapshot is a manually reviewed extraction, not a live feed.
A report update requires inspecting the primary source and committing the new
vintage, values and reference window. The matcher rejects altered units, scope,
period, basis, values or source identity. The recipe cannot publish before its
verification date and expires on 30 April 2027 pending renewed review. If a new
report supersedes it earlier, update or withdraw the snapshot then.

Publication identity remains tied to this source/window, with the reference end
2025-12-31. Rechecking the same topic changes its evidence hash without resetting
its publication key. Existing quotas and uncertain-publication locks still apply.
The public source page and bio destination ship with the recipe in the same PR.

Credit: Based on National Housing Supply and Affordability Council data.

## Reproduce review

```sh
node --import tsx scripts/review-housing-balance-reel.ts --out /tmp/desk-housing-gap
```

This produces a Fable-narrated, subtitled MP4, caption, seven scene JPEGs and the
complete evidence/storyboard JSON. `--frames-only` skips speech/video generation.
It never posts. The 32-second runtime guard and measured passage timing apply.
Australian English and no em dashes are required for the caption.

The ratio reveals one house per 30fps frame, then holds the completed grid.
Single-frame hard cuts use concat instead of a zero-duration xfade, which can
silently truncate the picture stream. The renderer decodes the finished video
and checks that its pictures cover the measured timeline within two frames.
The encoded-timeline regression test exercises both hard cuts and dissolves.

The net-supply, demand and gap labels count up with their corresponding bars.
One cubic ease-out produces a rounded value for both the digits and bar width,
so intermediate pictures never imply different quantities. Counters start at
zero, land on the reviewed figure and hold for reading. Intermediate figures
are animation states, not observations. Numeric ticks use hard cuts to avoid
ghosted digits. The ratio counter tracks the exact number of illuminated icons.
The revised design gives the headline number more prominence, shortens chart
headings and uses fixed-height monospaced counters to prevent layout jumps.

The quiet-layout pass removes page counters, the progress strip, duplicate date
lines, explanatory paragraphs and decorative comparison icons. Each scene body
is limited to 25 words of essential copy. Geography, reference period, source,
approximation and the estimated-demand label remain visible. Full calculation
and limitations remain in the unchanged caption and public source read. The
gap is explicitly labelled additional, not total accumulated shortage.

Supply keeps the same row, position and 840px scale when demand enters beneath
it. The ratio reserves a fixed-width counter to prevent the /100 from shifting
at the change from one to two digits. Static introductory and closing scenes
hold without redundant animation ticks; moving data still uses eased count-ups
and measured narration, with a final reading hold.

### Connected visual sequence

The review Reel uses the actual 2026 Council report cover on its source scene,
with the full publisher name, report title, publication date and printed page 21.
`server/og/fonts/nhsac-2026-cover.jpg` is a proportional JPEG rendering of PDF
page 1 from the pinned source PDF above, produced with Poppler at a 1,000-pixel
long edge. It is bundled with the existing editorial assets and must be present
for this scene to render. The source cover is documentary attribution, not an
endorsement of The Desk.

The net-supply animation starts at 263,000 and subtracts approximately 31,000
implied demolitions to arrive at 232,000. Both the figure and the gold bar use
the same rounded animation value. The demolition estimate is labelled as
implied by rounded figures. Supply, demand and shortfall share fixed positions
and the same 300,000-home scale. The 55,000 shortfall is highlighted within the
demand bar beyond the supply endpoint. The ratio grid finishes with 81 gold
homes and 19 coral homes, then holds. Fable delivers the closing takeaway:
“More homes built doesn't mean the housing gap is closing.”

The demand passage explains the household meaning of the estimate: households
needed about 287,000 extra homes. Its chart label says “Estimated extra homes
needed”, so viewers do not need to interpret the technical demand label.

### Human context and opening question

The opening now puts the surprising contrast on screen immediately: 263,000
homes built, yet the gap grew. A new, explicitly illustrative household scene
shows a person leaving a shared home and forming a separate household. This
explains one mechanism behind additional dwelling need; it is not an observed
family, a demographic count or a claim that all moves add housing demand.
The household illustration precedes the three continuous chart scenes so the
established net-supply bar stays in place through demand and the gap.

The additional passage uses measured Fable speech timing, bounded hard-cut
animation and a reading hold. The shorter shortfall and ratio lines keep the
story concise. The close states the implication: supply must outpace new
demand to close the gap. Exact data, source attribution, publication identity
and the post caption are unchanged.
