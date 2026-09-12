# Property briefing design, September 2026

Daily publication and authenticated previews share `briefing.ts` and
`briefingCards.ts`. The automatic morning slot stays Monday to Friday at 07:30
Australia/Sydney. This change makes no manual post and reopens no publication
identity. Weekly, Number and Reel publication routines retain their formats.

The 4–6 slide sequence is a photographic lead cover, attributed reported detail,
a labelled general reading guide with pictograms, up to two supporting stories,
and a practical takeaway. All slides use the same navy or cream palette. The
cover removes the old mini headlines and unrelated metric strip. Source/date
information moves to readable evidence slides. Supporting 9:16 Stories use the
same evidence design. Admin daily-slide index 0 is the evidence slide; indices
continue through the final takeaway. The cover remains its own preview kind.

Publication consumes source title and summary, never generated/cached sayThis,
whyItMatters or counterpoint. Most headlines remain intact; the explicitly
matched housing-supply/mortgage-stress intersection has a short neutral cover
heading, with the original source title retained in the caption. The publisher
is attributed. A modelled or forecast result is visibly labelled as an estimate.
Statistical estimates alone do not classify an observation as a forecast.

General explanation recipes cover supply stages, rent measures, loan measures,
auction reporting, projections, geographic overlap and geographic comparison.
They are labelled as reading guides, not independently verified implications of
an article. The headline's subject takes precedence over incidental summary
keywords. No quantitative chart is invented from an unstructured headline.

Source summaries remain attributed source copy, not independent fact checking.
At most the first complete sentence can be used when a summary exceeds the
card's length budget. No clipped numeric claim, ellipsis, isolated sensational
clause or unsupported automatic headline rewrite. Empty, duplicated, overlong,
ministerial-boilerplate and explicitly conflated approved/were-built summaries
cannot enter this briefing. This is a bounded quality filter, not general
semantic verification. A thin pool yields fewer supporting stories; no usable
pool stops publication before media upload or publication reservations.

Captions add reported detail before the original headline, explain a relevant
reading distinction and next step, then use one save invitation. They retain
publisher timing, source story identities and attributed first-party reading
links. Caption length is checked before any Meta container is created. Whole
optional opening detail can be removed to fit; source claims are never sliced.
Alt text follows every actual slide, including the explanation diagram.

Photography reuses the bundled, licensed assets documented in
`reel-archive-photography.md`: Damon Hall construction, Phillip Flores
architecture and Pixabay Australian money. Visible credits identify illustration
or archive use. No depicted property, date or location is claimed as news
 evidence; no image service, new dependency or paid model/voice call is added.

Terminology references checked 12 September 2026:
- ABS building approvals methodology: https://www.abs.gov.au/methodologies/building-approvals-australia-methodology/jun-2026
- ABS commencement definitions: https://www.abs.gov.au/articles/average-dwellings-commencement-times
- ABS activity series distinguishes commencements and completions: https://www.abs.gov.au/statistics/industry/building-and-construction/building-activity-australia/latest-release
- RBA explains the cash rate and influence on loan rates: https://www.rba.gov.au/

Offline review: `node --import tsx scripts/briefingPreview.ts SAVED_FEED_JSON OUTPUT_DIR`.
This uses archived public feed rows and renders navy/light variants, all slides,
a Story and the actual caption. It never calls Meta. The user's earlier example
3840168 is preferred only when it passes the same content gate; its ambiguous
approved/were-built summary currently fails. The live publisher continues its
normal priority selection and unpublished-story checks.

Tests cover evidence boundaries, source attribution, rejection before upload,
publication locks/recovery, alt-text alignment, forecast classification, and
actual 1080×1350 / 1080×1920 exports. Visual review also includes long headlines,
long descriptions and light/navy palettes. No engagement increase or optimum
posting time is claimed: compare later reach, saves and shares at similar ages.
