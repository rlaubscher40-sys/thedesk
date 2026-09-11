# Repeatable Reel production

## Approved baseline

Ruben selected Fable after the external voice audition on 10 September 2026.
Use local Kokoro Fable (`bm_fable`) at speed 1.0. It is a British stock voice,
not an Australian voice clone. Australian English applies to the writing.
The external audition is not a production dependency.

`productionReelOptions` is shared by the publisher, admin preview and review
commands. Narration and burned-in subtitles are mandatory for publishing,
even if a caller tries to disable subtitles. Missing audio or captions blocks
the post before a Meta container is created. The default voice is immutable.

All eight registered topics pass `assertProductionCandidate` before selection:
visible source/reference context, evidence identity, complete uniquely keyed
narration, duration budget, caption style/length and mandatory visual/script binding.
These are structural checks, not automatic fact-checking or
an engagement score. The deterministic adapters retain their source checks.

## A new episode from an existing topic

Run `node --import tsx scripts/review-reel.ts --list` to see currently available
topics and evidence requirements. Withheld topics do not produce filler.
Copy the returned publication key and run:

```bash
node --import tsx scripts/review-reel.ts --topic <publication-key> --out /absolute/new-review-directory
```

The directory must not already exist. The command produces a narrated MP4,
the exact post caption and review metadata with the evidence, script, voice
settings and measured timeline. It never publishes. It uses current verified
evidence rather than changing dates on an old episode.

To review every currently eligible story in one run:

```bash
node --import tsx scripts/review-reel.ts --all --out /absolute/new-review-directory
```

This renders serially, checkpoints each completed MP4 and records withheld topics
and their evidence requirements in `manifest.json`. It does not fill missing data
with fixtures or publish anything. Synthetic edge cases stay in the test suite.

The existing housing review command remains a pinned historical regression
preview, not a live-data selection command. Its approved cinematic export is
39.6 seconds. No re-render is needed solely to reconfirm the same Fable choice.

## A genuinely new story or format

1. Write the finding, explanation, personal consequence and useful takeaway.
   Use `EditorialStory` and `assertEditorialStory` to map each to real scenes.
   Source any causal mechanism separately. Numbers alone do not prove a cause.
2. Add a deterministic evidence adapter and a registered topic. Match dates,
   geography, units and comparison bases. Define a stable publication identity
   that does not change when wording, voice or design changes.
3. Choose visual actions that explain these particular facts: shared-scale
   comparisons, a dated timeline, a process reveal or relevant credited imagery.
   Reuse `renderEditorialFrame`, the editorial fonts, measured phrase speech
   and source-footer conventions. Do not paste the housing numbers, photographs,
   causal claims or deposit assumptions into another story.
4. Bind its reviewed storyboard and narration, add source/meaning/limits to its
   caption and test missing, stale, changed and contradictory evidence.
5. Export with the shared production options. Check the encoded MP4, audible
   narration, timing, source legibility, numerical endpoints and final hold.
   Watch once without sound and confirm the takeaway remains understandable.
6. Review the actual performance after authorised publication. Compare similar
   topics at the same age using available watch time, shares and saves per reach.
   Do not substitute a design rating for audience evidence.

All eight registered topics now use scene-based continuous motion and the approved
documentary subtitle styling. They retain different visual explanations:

| Topic                        | Visual explanation                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Brisbane and Perth rents     | Shared-scale signed bars, growth versus price, return checklist                     |
| Eight-capital rents          | All eight observations, shared zero baseline, range versus average                  |
| Sydney rent change           | Previous and latest annual rates, correct rising/falling/unchanged meaning          |
| Brisbane and Perth approvals | Matched counts, permission/construction/completion, delivery versus need            |
| Sydney supply checklist      | Approval count, building stages, stage/place/timing questions                       |
| New home-loan rates          | New-loan averages, then amount, term, fees and repayments                           |
| Queensland and WA migration   | Signed net counts, arrivals minus departures, then local housing balance             |
| National housing balance     | Net supply versus need, uncovered segment, separate deposit context, archive camera |

`withEvidenceVisual` binds the seven numerical source adapters' observations, script and
attribution to their evidence hash. Editing a number or utterance afterwards
invalidates the binding. This is an integrity check, not independent evidence.
The national housing storyboard retains its existing strict source binding.
Future episodes within these recipes are automatic when current data qualify.
An entirely new story type still needs a verified adapter, a reviewed recipe and
a full export review before registration. Never claim arbitrary news automatically
receives a finished documentary treatment.

## Continuous motion

Narrated housing exports use `housingMotionRenderer.ts`; the other seven use
`evidenceMotionRenderer.ts` and `evidenceVisualLayout.ts`.
Every picture is evaluated on the 30 fps clock, with stationary Satori typography
cached separately from photos, bars, the timeline marker and phrase reveals.
Frames stream to the final encoder with backpressure instead of repeating a small
stack of full-page JPEGs. Subtitles and Fable audio use the same measured timeline.

Use `reelMotion.ts` for new reviewed motion recipes: explicit layer bounds,
speech-led progress, smooth acceleration and deceleration, and a reading hold
after each arrival. A bar uses the continuous underlying value while its label
rounds to the evidence's display precision. Intermediate animation frames are
not extra observations. Do not interpolate data text with optical flow or apply
a camera zoom to an entire page of typography.

The construction photograph continues through the ending on one camera path.
The uncovered housing segment carries into the competition explanation. Other
scene cuts stay clean so outgoing and incoming headings never overlap. Check
the exported MP4 frame by frame during active motion, as a 30 fps container can
still contain duplicated animation positions. Compare positions in a moving
region, not compression noise or an intentional reading hold.

Narration owns scene duration. Numbers finish before the sentence ends and remain
available to read. Adjacent scenes retaining a chart keep its completed values.
Body text has explicit widths, and marked text outside the viewport or its
individual layer bounds fails rendering rather than silently publishing a crop.
Validate tied, zero and negative rates as well as ordinary positive examples.

## Publishing

Existing scheduler and Meta delivery remain in charge. At most one automatic
Reel per Sydney day, in the existing 6:30pm to 8pm window, subject to current
evidence, credentials and readiness. Confirmed or uncertain publication slots
are never reset to repost after a design/voice change. This rollout does not
manually post the preview or change the schedule.

Eligible stories rotate by the least recently published evidence family. Families
without a confirmed publication come first; equal histories use the newest
reference date, then stable registry order. Freshness is checked by each source
adapter before this comparison, so a current quarterly population release can
get a turn before another monthly rent story. This is editorial variety, not a
prediction of engagement or a promise of a fixed daily sequence.

Rotation reads the permanent confirmed publication history for all registered
topic keys across reference periods, including temporarily withheld topics.
Failed attempts, skips and uncertain responses do
not count as audience exposure. The most recent confirmed post within a family
owns that family's position. A new observation month does not erase that history.
The same read protects the daily cap when a new source period arrives after a
post that day. If history cannot be read, the programme waits. No additional
database table, history reset or external scheduler is required.

The admin Reel panel shows the selected story, Sydney eligibility window, retry
time and blockers separately from a confirmed Instagram media ID. A window is
not a reservation. DST comes from the Australia/Sydney timezone database.
The scheduler emits a `[reel-plan]` runtime log when that status changes, including
the publication key and period, without credentials or a new public admin route.
Use this to confirm what is actually selected after deployment. Do not infer a
story's posting time merely from a merge or a successful preview.

The status panel and `[reel-plan]` log also retain `lastConfirmedPublication`,
separate from the next selection: permanent topic key, source period, family,
numeric media ID and publication timestamp. The bounded history query ranks
whole confirmed receipts, so IDs cannot be mixed with another period's time.
This remains available after rotation, restarts and loss of current source
evidence. A confirmed historical post does not clear another uncertain lock or
prove the next selected story was posted. History-read failures still block
publication. No extra Meta request, scheduler or publication write is added.

## Connected rent comparison and newer voice auditions

The rent comparison now reads the two source observations in separate measured
phrases. The first bar finishes on Brisbane's utterance; Perth starts on its own.
Completed bars remain through the gap explanation and move into a compact
comparison as weekly price and investment inputs are introduced. Unknown dollar
figures are shown as unknown, never invented examples. The opening and ending
reuse the credited architectural illustration as context, not as a photograph
of either named market. The caption includes its credit.

The user asked to audition newer voices on 10 September 2026. Kokoro `bm_fable`
and OpenAI `fable` are different voices. The existing approved production voice
remains Kokoro while a replacement is auditioned. The current OpenAI Speech guide
recommends `cedar` and `marin` with `gpt-4o-mini-tts`:
https://developers.openai.com/api/docs/guides/text-to-speech

With OPENAI_API_KEY securely available in the authorised review environment:

```bash
node --import tsx scripts/review-reel.ts --topic instagram-reel-abs-rents-brisbane-perth-v1 --audition-voice cedar --out /absolute/new-audition-directory
```

Use `marin` for the same-script comparison. The explicit audition option uses
Australian editorial direction, measures returned PCM and rebuilds the complete
MP4 around the new audio. It never speeds up an existing recording, substitutes
Fable on error, exposes the key, or changes the automatic publisher. Its metadata
identifies the actual provider and voice. Missing access is a clear failure.
Listen for accent consistency, natural stress, correct numbers and the complete
story before promoting a new voice into production. Do not claim this audition
was heard or approved merely because the code or mocked tests passed.

## Borrowing costs and population movement

The programme now includes eight reviewed recipes across four evidence families:
existing rents and supply, plus borrowing and population. These are additional
source-driven episodes, not a promise of daily fresh news or daily Reels.

- **New home-loan rates:** monthly RBA F6 FLRHOFTA/FLRHIFTA, average rates on new
  owner-occupier and investor loans funded in the same month. All institutions,
  fixed and variable rates. Both exact rates are spoken and animated separately.
  The comparison leads into loan amount, term, fees and repayments. Do not label
  the difference a matched-borrower premium, an available offer or the cash rate.
  `/social#new-loan-rates` reads the same source observations, rounded to one decimal place, provides the
  definition and links to RBA F6 and ASIC Moneysmart. Publication identity is one
  episode per source month, unchanged by revisions or visual edits.
- **Queensland and WA interstate migration:** annual sums of four consecutive
  ABS net internal migration quarters for both states. Counts are signed; net
  losses and zero have their own spoken wording. The animation explains arrivals
  minus departures, then a conceptual change of residence. It must never show an
  invented measured route, gross arrival count, city population or homes required.
  The takeaway is to check local household growth, vacancies and completions.
  One episode per source quarter; not a forecast of prices or a new monthly read
  of unchanged quarterly data. Bio links go to the comparison's state context.

`verifiedContextReels.ts` owns source eligibility and meaning. `contextReelLayout.ts`
provides the reviewed six-scene treatments. Actual Fable phrases own count-up and
bar timing, and the loan bars remain complete through their explanatory scene.
The shared production gate, captions, subtitles, scheduler and permanent locks
apply to both. The RBA review/public read caches one source attempt per hour,
including failures. ABS uses its existing cache. No additional LLM or speech API
is used; production remains local Kokoro Fable at speed 1.0.

The RBA parser remains pinned to original monthly new-loan series, units,
publication metadata and freshness. Missing/mismatched/future/stale observations
are withheld. Migration additionally rejects duplicate rows, unknown statuses,
non-integer counts, mismatched quarters and old retrievals. Revised observations
can change the evidence hash but not reopen their publication identity.

Source and explanation review:
- https://www.rba.gov.au/statistics/interest-rates/
- https://www.rba.gov.au/statistics/tables/csv/f6-data.csv
- https://moneysmart.gov.au/home-loans/choosing-a-home-loan
- https://www.abs.gov.au/statistics/people/population/national-state-and-territory-population/latest-release

Fable was reconfirmed by the user on 11 September 2026. Newer-voice auditions
are deferred and are not a task prerequisite. Keep the review-only code dormant
until the user reopens that choice.
