# The Desk documentary production system

The standard is a person-led documentary in which the evidence and the pictures do equal work. The Harry Triguboff cut accepted on 14 September 2026 is the creative benchmark. A new film needs its own research, decisions and images.

## The next request

“Make the next The Desk documentary about [person]. Use the documentary production standard, research the business progression, show sourced AUD figures, and deliver the reviewed MP4 and source package.”

A subject is enough to begin. An angle or deadline is optional. The reusable `desk-documentaries` skill carries the method forward; its project copy lives in `.codex/skills/desk-documentaries`.

## What stays consistent

- Australian property stories, Australian English and AUD throughout. Display A$; identify historical conversion and periods. Avoid em dashes in public copy.
- Introduce the person before explaining the empire. Establish a specific tension or question, then answer it through the business progression.
- Fable narration at speed 1.0, portrait video at 1080 × 1920 and 30 fps, stereo AAC at 48 kHz, readable subtitles and protected source space.
- The Desk's editorial serif, plain supporting text, dark green/ivory palette, restrained gold and event-specific colour emphasis.
- Actual dated archive material, original explanatory graphics, purposeful motion and a restrained score beneath the voice.
- A downloadable MP4, source dossier and a review of the actual encoded film.

These conventions save repeated decisions. They do not require every story to have the same scenes, number of cuts, crisis or ending.

## Research the business, not just the biography

Build a chronology of events, decisions and consequences. Find the first credible project and the missing steps between that project and later scale. Investigate changes in selling, financing, ownership, management and the customer paying for the property. Include setbacks when supported, and keep dates in sequence or clearly signal a deliberate return to an earlier year.

For each financial claim record the amount in AUD, what it measures, its period, source, qualification and date checked. A land price is not total development cost; gross proceeds are not profit; rent is not profit; personal wealth is not company value. Two apartment contracts do not establish the whole project's average or revenue. A cumulative built total does not establish current ownership.

Only say one project's sale funded the next when the source establishes that connection. Otherwise show the first verified result and the next documented decision, preserving the unknown financing bridge. Do not fill a story gap with plausible arithmetic or unsupported causation.

Prioritise original company/project records, court records, first-person accounts with attribution and credible reporting. Read the actual source page. Keep disagreement and missing evidence in the dossier. Free access to an article does not grant rights to its photographs.

## Write the story spine

A useful sequence is the person and opening stakes, the early work, the first verifiable deal, changes in the model, a setback and response, later scale, and the payoff. Adapt the sequence to the evidence. The operating renderer currently uses eight production scenes with up to two spoken phrases each; those containers are not a formula for the biography.

For every turning point ask: what happened, what decision changed the business, what verifiable number makes it concrete, and what happened next? Remove sentences that repeat an on-screen heading without advancing understanding. Keep qualifications that materially change the meaning of a figure.

The Harry benchmark preserves the stretch between Gladesville and World Tower: individual sales, float and buyback, reported debt, Queensland, finance and management, and Regis. That is the depth to reproduce, not those exact events.

## Direct the pictures

Assign every shot a job. A face identifies a person; a map explains movement; a building image establishes a real place; apartment divisions explain separate sales; retained rooms explain continuing operations. A camera move or number animation should help the viewer understand the event.

Use actual photographs for named people and projects, with visible dates and provenance. Clearly identify later context images. Mark schematic buildings and floor plans as illustrations. Keep titles, facts and subtitles clear of each other and Instagram's controls. Do not draw a decorative growth curve that implies an invented historical series.

Change pace with the story. Most visual sections can run a few seconds; short chapter interruptions and longer complex explanations are deliberate exceptions. The automated review flags sections shorter than 1.2 seconds or longer than 8 seconds for inspection. Those are editorial prompts, not proof of failure.

New subjects require authored visuals. The current Harry renderer is bespoke. Add an appropriate director/recipe and shot metadata for a new subject, reusing the production style and helpers rather than substituting names into his scenes.

## Sound and finishing

Keep the voice natural and intelligible. Check names, dates and money by listening to the complete MP4. Music should support the emotional progression, lower under speech and finish with the picture. The Harry score is original code-generated instrumental audio; it does not need a commercial music subscription.

The technical review measures the encoded audio, confirms that it covers the measured narration and checks the media format. Human listening and a phone-size visual review remain necessary. Record a limitation when an environment cannot support listening; never convert a waveform measurement into a claim of creative approval.

## Repeatable commands

From the The Desk project, create an evidence-first brief:

```sh
node --import tsx scripts/new-documentary.ts lang-walker "Lang Walker" /absolute/new-brief-directory
```

The output has empty evidence, no release date and `research-required` status. It is deliberately not registered for publication.

After research and authoring, register the episode, public reading notes, sources, checked assets and visual treatment. The maintained locations are:

| Material                                   | Project file                                |
| ------------------------------------------ | ------------------------------------------- |
| Narration and eight production scenes      | `server/instagram/documentaryEpisodes.ts`   |
| Source records and public reading notes    | `shared/documentaryReels.ts`                |
| Image credits, licences and file checksums | `shared/documentaryPhotos.ts`               |
| Visual timing and sound direction          | `server/video/documentaryDirection.ts`      |
| Timed visual purposes                      | `server/video/documentaryShotPlan.ts`       |
| Harry's authored sequences                 | `server/video/personDocumentaryRenderer.ts` |
| Review criteria and research brief         | `server/video/documentaryProduction.ts`     |
| Exact previously reviewed exports          | `server/instagram/documentaryReviews.ts`    |

Export a registered episode:

```sh
node --import tsx scripts/review-documentary.ts triguboff-apartments /absolute/new-export-directory
```

The equivalent package commands are `documentary:brief` and `documentary:review`. Each export produces the MP4, cover, caption, measured narration record, production dossier, source links, timed shot list, every visual section's frame, contact sheets, audio measurements and editorial review sheet. A failed technical check stops the command. An existing output directory is not overwritten.

The workflow also handles the other registered documentary episodes, whose reviews use their own phrase counts and images. Passing the workflow does not upgrade an older film's creative quality or grant it approval.

## The ten editorial checks

The maintained questions are in `DOCUMENTARY_REVIEW_BAR`. Record a verdict and an observable reason for each: person and hook; complete progression; factual evidence; money clarity; purposeful and licensed pictures; pacing; mobile legibility; voice; sound; ending payoff. A weak item goes back to the relevant production stage. Do not average a factual error away with attractive visuals.

“10/10” is the quality bar, not a guarantee of audience response. Once films are published, use the metrics Instagram actually supplies to compare opening retention, viewing depth, saves and shares across comparable episodes. Note the denominator and posting context. Feed demonstrated weaknesses into the next brief; do not attribute improvement to a change from one small sample.

## Schedule and release

Retain Wednesday's The Deal and Sunday's Property Empires within the existing Sydney publishing window. The approved launch buffer is four exact reviewed exports. A missed date does not backfill silently and new topics remain in the research backlog until their own evidence, film and review exist.

Changing script, assets, direction, sound or render inputs invalidates an earlier review. Increment the renderer version when the rendered treatment changes. Keep technical checks and creative approval separate; the export command never posts or approves itself. Use the user's current authorisation for code and publication actions, then verify the required checks and deployment receipt.
