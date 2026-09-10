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
households, a city comparison or a price/rent forecast. The source read retains
the rounded 81-per-100 ratio. No local shortage is inferred from state
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

## Human context and source attribution

Printed page 44 (PDF page 55) links high living and housing costs to adult
children staying in the parental home longer. This is separately attributed
context, not a consequence measured by the housing-flow calculation.
https://nhsac.gov.au/sites/nhsac.gov.au/files/2026-04/ar-state-housing-system-2026.pdf#page=55

The earlier key-and-door scene is superseded by the modelled deposit comparison
below. The reported living-at-home context remains on the source read. The
former white excerpt panel stays removed; source credit sits beside the story.

## Reproduce review

```sh
node --import tsx scripts/review-housing-balance-reel.ts --out /tmp/desk-housing-gap
```

Produces a Fable-narrated, subtitled MP4, caption, six scene JPEGs, evidence,
measured phrase audit and final timeline. `--frames-only` skips speech and video.
It never posts. Housing has a 46-second cap; other formats retain 32 seconds.

The count-up uses one cubic ease-out for both digits and bar width. Intermediate
figures are animation states, not observations. Net supply, demand and gap use
a fixed 300,000-home scale. The rounded ratio remains on the source read. The Reel uses that time to explain price pressure.
Hard-cut frames avoid ghosted numbers. The renderer decodes the finished picture
stream and checks coverage of the measured timeline within two frames.

Subtitles convert only verified spoken counts to digits, retaining every other
word and its measured phrase timing. The caption and public source destination
carry the same finding and distinguish it from accumulated shortage. See
`reel-editorial-standard.md` for the current design and delivery requirements.

## Affordability explanation, 10 September 2026

The revised story adds the mechanism previously missing between the flow gap
and the human consequence. NHSAC chapter 2, section 2.1.1, explicitly links weak
new supply relative to demand to upward pressure on prices. Sections 2.1 and
2.3 cover rental conditions, construction costs, labour and feasibility.
The same report also attributes much of 2025 price growth to interest-rate
reductions expanding spending power. Underlying housing need must not be
confused with effective demand from buyers able to pay.

RBA's 2019 housing model supports the vacancy/rent mechanism and the importance
of rates, rents and momentum for prices:
https://www.rba.gov.au/publications/rdp/2019/2019-01/full.html

The explanation is conditional pressure, not a national or local price forecast.
No observed price-growth series, percentage effect or affected-person count is
inferred from the 55,000-home calculation. The competition graphic is labelled as illustration. Construction now uses
a credited archive photograph, labelled with its publication year.


## Modelled deposit hurdle, verified 10 September 2026

The same pinned report gives 9.0 years in 2015 and 11.2 years in 2025 to save a
20% deposit on a median-priced dwelling. Printed page 3 (PDF 14) gives the pair;
Chart 3.2 on printed page 54 (PDF 65) specifies annual saving of 15% of gross
median household income. Printed page 57 (PDF 68) discusses the 2025 result.

This is a modelled benchmark, not observed saving behaviour or a required
minimum deposit. Its decade differs from the 18-month supply/need comparison.
The Reel does not attribute the 2.2-year difference to the 55,000 flow gap.
The 9.6-year ten-year average is not the 2015 observation and must not replace
9.0. The shared reviewed values are in `shared/housingAffordability.ts` and
included in the evidence hash and publication verification-date gate.

## Connected six-sequence cut

1. Australia is building homes, so why is buying one getting harder? A separate
   monochrome architectural photograph frames the affordability question.
2. One developing comparison: 232,000 net additions, 287,000 extra need,
   then the 55,000 additional gap. Three measured phrases own the three reveals.
3. The gold gap marker travels into an explicitly illustrative competition
   diagram; the voice explains upward pressure on prices and rents.
4. The marker moves to a years ruler. The modelled deposit benchmark extends
   from 9.0 to 11.2 during the second measured phrase. Its dates and assumptions
   are visible separately from the housing-flow reference period.
5. Credited archive construction photograph, with a restrained crop pan,
   accompanies the explanation of high costs and labour shortages.
6. Building more is not the same as catching up. Illustrative net additions
   outpace new need, explaining what must happen to reduce the shortage.

The original photograph and licence/provenance record are bundled with the
renderer. See `reel-archive-photography.md`. It is contextual archive imagery,
not evidence of a current building project or of delay at that particular site.
