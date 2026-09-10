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

All six registered topics pass `assertProductionCandidate` before selection:
visible source/reference context, evidence identity, complete uniquely keyed
narration, duration budget, caption style/length and exact storyboard binding
where available. These are structural checks, not automatic fact-checking or
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

The cinematic housing design is a reviewed recipe, not a universal template
already applied to every topic. Other existing topics retain their own visual
recipes. New narrative formats require editorial and full-render review before
registration. The reusable production settings and technical checks apply to all.

## Continuous motion

Narrated housing exports use the frame compositor in `housingMotionRenderer.ts`.
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

## Publishing

Existing scheduler and Meta delivery remain in charge. At most one automatic
Reel per Sydney day, in the existing 6:30pm to 8pm window, subject to current
evidence, credentials and readiness. Confirmed or uncertain publication slots
are never reset to repost after a design/voice change. This rollout does not
manually post the preview or change the schedule.
