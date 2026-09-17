# The Desk documentary Reel programme

## Producer recovery, 17 September 2026 (Sydney)

The durable work queue is [documentary-editorial-queue.json](documentary-editorial-queue.json).
Run `pnpm documentary:status` to check its recovered input identities against the
current registered films, report expired provisional slots and find the oldest
continuation. This is a read-only recovery preflight, not a publishing gate or a
claim that autonomous production is commissioned. It accepts held records only;
promoting a film requires the actual evidence/review and publishing integration.

Recovered main `efab66ba440cf6fef8a4cd5cab3ac1f2fd672ecf` was deployed successfully
as Railway deployment `4e52b7a6-ad31-4b5e-afcc-b9e922045bb2`. No documentary PR was
open. PR 286 had already delivered the four distinct previews and merged them;
do not redo that production. All four saved input fingerprints match current
main. Current exact-export reviews do not match these four films, so the launch
gate remains closed. There is no verified four-film reviewed/unpublished buffer.

The producer can inspect code, retrieve files, measure media and inspect still
frames. It has no exposed capability for a full perceptual listen or continuous
audiovisual review. No listening, human approval or delegated creative approval
was fabricated. No film was rendered, approved, reserved or posted in this run.
The next continuation is Harry's existing exact master, not another Harry story.
The expired 16 September Lowy slot is not backfilled; assign future Wednesday
and Sunday slots only once every release gate has passed.

The saved four-preview ZIP is incomplete: it ends after Harry's frame 28 with no
central directory. Recovery verified CRCs for all 115 complete members, including
Grollo and Lowy's complete packages and the four-export manifest. The separate
Harry review ZIP passed its archive integrity test. Standalone Grollo, Lowy and
Walker MP4s match that manifest. Walker's original detailed review package is
missing from the incomplete archive; preserve this limitation when reconstructing
source notes. Do not call an archive repaired merely because the MP4s are intact.

Live scheduler logs identify the 16 September Melbourne approvals Reel
`17908474461521259` and its companion Story `18185474161365503`, with Brisbane
approvals selected for 17 September. The public gallery also exposes the national
housing-gap and Sydney-approvals Reels. These underlying events and takeaways
differ from the four historical documentary treatments. However, the authenticated
Reel plan returned HTTP 403, so these observations do not establish complete
publication history, every permanent receipt or the entire future queue.

Existing code retains Wednesday/Sunday slots, the shared daily cap, retired-film
receipt locks and ordinary fallback. It does **not** yet enforce a semantic
subject/event/takeaway duplicate review across both programmes. Before promoting
any film, recover the complete authenticated history and upcoming queue, complete
that comparison, record the exact export and reviewer authority (delegated is not
human), and implement/test the missing queue-to-publisher integration. Neither this
ledger nor a green deployment claims those outstanding gates are enforced.

All ordinary news, housing, market-data and supply/demand production is untouched.

## Distinct four-subject lineup, 15 September 2026

The active registry now contains **Harry Triguboff, the Grollo family, Frank Lowy and Lang Walker**. Grollo ownership and Meriton accommodation are superseded previews, removed from active scripts and public reading entries. The older records below document earlier work rather than additional scheduled films.

Harry's accepted 169.7-second MP4 and input hash remain unchanged. Grollo's 106.4-second film adds dated Melbourne and Darwin photography, a labour camp, concreting, workforce growth, family roles, project risk and reconstruction. Lowy's 84-second film follows Blacktown, the 1960 float, Hornsby and later expansion using a portrait, shopping-centre photography, share arithmetic and opening-day imagery. Walker's 84.6-second film follows earthmoving, the listed business, two exits and later projects using waterfront exteriors and interiors, an excavator, transaction diagrams and Parramatta photographs.

All values are AUD with periods and measure labels. The Lowy share issue is aggregate issue value, not net cash or Hornsby's complete financing. Walker's rounded 2006 amount comes from the readable secondary company history; the cited original deal documents were not accessible in full. It is not personal profit or a traced source of Parramatta funding. The archive register records each image's photographer, date, licence, adaptation and checksum. Adapted photographic sequences retain CC BY-SA terms in captions and public notes.

The existing slot mapping is Lowy on Wednesday 16 September, Grollo on Sunday 20 September, Walker on Wednesday 23 September and Harry on Sunday 27 September, all provisional in the existing Sydney evening window. Subject-list order is not a change to these dates. The new films still require exact-export creative review and a complete listen. No approval or Instagram receipt is inferred from a successful render or deployment; missed dates must be reassigned after review. Ordinary daily Reels retain their separate programme.

## Completing the launch buffer, 14 September 2026

The user asked to build the other three films rather than waive the four-film launch gate. The three older scripts have been replaced with distinct, person-first historical stories:

- **The half they kept:** Bruno and Rino Grollo, the move into part-ownership and the April 2020 Rialto transaction. A$644m is the transaction adviser's reported enterprise value of the 50% interest sold by St Martins to the GIC/Dexus joint venture. Grollo Australia retained its half. It is not a Grollo payout, a whole-building price or profit.
- **Before the skyline:** Luigi and Emma, the 1928 arrival, 1948 weekend enterprise, 1952 full-time transition, workforce growth from 35 to 128, the Reserve Bank project setback, 1968 handover, Bruno and Rino's roles, Darwin reconstruction and Rialto. More than A$350m is reported company worth in 1994, not personal wealth or a current valuation.
- **A different customer:** Harry's 2003 accommodation launch, operating model, 2017 rebrand, the Federal Court's 2018 A$3m company penalty for review manipulation and the September 2023 Melbourne opening with 298 suites. The penalty is attributed to Meriton Property Services, not Harry personally; no current misconduct or comparative profitability is asserted.

`documentaryLaunchEpisodes.ts` holds the scripts. `documentarySeriesDirection.ts` and `documentarySeriesRenderer.ts` provide authored sequences, source-aware captions, exact-count grids, room plans, family-role diagrams and a single-building ownership split. These are explanatory illustrations, not fake archive footage. Existing individually licensed photographs retain their dates and provenance. No licensed Grollo portrait was obtained, so the films introduce family members by name rather than inventing a likeness.

The `series-led-v1` treatment receives measured Fable narration, subtitles, an original score, cut-specific frame sheets and encoded audio checks. Its direction is bound separately by episode. A regression test preserves Harry's accepted input hash. The Deal remains capped at 90 seconds; the family film at 150. Ordinary Reels and Wednesday/Sunday publishing rules are unchanged.

The final exports must still pass the exact-export editorial and complete-listening review. This implementation does not add approval records, bypass the launch gate, post to Instagram or pretend that technical audio measurements are a human listen. The dates below remain provisional until the reviewed buffer is complete. Older statuses below are historical.

## Current production status, 14 September 2026

The user accepted the 41-section cinematic Harry direction and asked to make that standard repeatable. The reusable workflow is documented in [the production playbook](documentary-production-playbook.md) and maintained in the project’s `desk-documentaries` skill. A named subject can start a research-required brief; registered episodes export a measured shot list, source dossier, encoded audio/format audit, full section frame sheets and explicit editorial review questions alongside the MP4.

Renderer version 8 enlarges the opening portrait and key figures, improves masthead contrast and preserves the score fade through the final picture. The new Harry master is 169.7 seconds with 41 visual sections. All section frames plus opening and ending were inspected. It passed encoded media checks at -17.53 LUFS and -4.07 dBTP; audio covers the complete narration and picture. A complete human listen to this exact new MP4 remains a review item. The 8.07-second Regis illustration is a deliberate sustained explanation, retained after visual inspection.

Input hash: `ee8cf73ded8469d8925262eb5917cd4fdc77cc853aca14bf0c9e6c51152d9aef`.
Video SHA-256: `724fbffc77d3ee4fd5892134b053bbdc7146a90d048a9c66333ea0754bff72b9`.

A separate Meriton accommodation export passed the same workflow: 69.6 seconds and 14 measured sections. This validates reuse, not a creative upgrade or publication approval for that older episode. A Lang Walker starter brief has no claims, release date or publication eligibility.

The four-film launch gate remains closed. No changed export inherits earlier approval, no new review was added to `documentaryReviews.ts`, and no Instagram post was made by this production work. Wednesday/Sunday remain the intended cadence once the reviewed buffer is complete. The records below describe earlier revisions and retain their historical status.

## Earlier research-led rollout status, 14 September 2026

The user authorised proceeding after delivery of the revised 163.3-second Triguboff MP4. Its input fingerprint and video SHA-256 were rechecked against the final export and recorded in `documentaryReviews.ts`. Repository implementation and deployment may proceed. The creative holds described below are historical.

Only this revised film is currently approved. The other three historical records remain invalidated and need editorial revision and review. The existing four-film launch gate therefore continues to withhold documentary publication, including the provisional 27 September Harry slot. Ordinary daily Reels remain eligible under their existing rules. Reassign documentary dates once the reviewed buffer is complete; deployment alone is not an Instagram publication receipt.

The earlier rollout push was rejected by automatic approval review because it could not verify permission for the specific GitHub destination. The user subsequently answered yes to explicitly authorising these changes to `https://github.com/rlaubscher40-sys/thedesk`, followed by merge and deployment after CI passes. That destination approval is resolved. Local type checking, dead-code audit and client/server production bundles passed, alongside 73 affected tests. The broader tests exposed an obsolete credit-wording assertion; documentary credits now check their recorded date, licence and Commons provenance, with the existing illustration/archive check retained for other photographs. This test-only correction does not change the approved video fingerprint.

## Research-led implementation, 14 September 2026

The revised Triguboff film implements the completed 18-source research report. Its 408-word narration retains the person-first opening and restores the middle: individual apartment sales, the float and buyback, the 1974–76 debt episode, Queensland expansion, formal finance and property-management divisions, Regis, World Tower's staged occupation, hospitality, the GFC acquisition and the later return to borrowing.

Sixteen measured visual beats use a 1930 Tianjin map, a dated 2008 Gold Coast photograph, the existing portrait and building photographs, original apartment-sale diagrams, an ownership sequence, the three Regis level counts and a World Tower section. The coast image is labelled as context, not an image of the named developments. The map is paired with a journey chronology, not a geographic travel line. Image provenance and byte hashes are in `shared/documentaryPhotos.ts` and bound into the reviewed renderer inputs.

All displayed financial amounts are AUD. The individual Regis contract prices, Victoria Park acquisition, historical debt and group rental income retain distinct measures and periods. There is no invented Gladesville profit, final World Tower return or exact project-to-project transfer. The source notes distinguish the 1989 formal finance division from earlier vendor lending, and the 2013 borrowing from the unsupported claim that Meriton never borrowed again.

The person-led biography has a 180-second editorial ceiling, shared by render and eligibility checks. Other Property Empires episodes remain at 150 seconds and The Deal at 90 seconds. Documentary subtitles allow up to 96 cues while preserving the two-line limit, minimum display time and measured phrase boundaries. Standard Reels retain the 48-cue bound. The local Fable voice remains at speed 1.0.

Renderer version 6 invalidates earlier review records. This is a new creative review export; no posting approval, release-date reassignment or deployment is implied by generating it. The earlier export descriptions below are historical records.

Final review export: 163.3 seconds, 1080 × 1920, 30 fps. The complete 16-beat encoded sequence and subtitle clearances were inspected. Type checking and 94 focused tests passed. All 63 cues preserve the script; shortest cue is 1.076 seconds. Input fingerprint: `3549288aaf799538eeb8a6b6ed31c27453c4c782748c8912fb51dd13ff2588ff`. Video SHA-256: `6c6455d25f18d74df230cc5e886bb69fab4a13bc45105aae4883f89adb86e8b3`.

## Editorial hold, 14 September 2026

The user rejected the initial visual and storytelling direction. The GitHub destination was subsequently authorised, but deployment remains paused for this editorial revision. The first four exports below are historical review records, not launch-approved films. Renderer version 2 invalidates all four previous approvals; the programme currently has no eligible documentary posts.

The replacement Triguboff pilot introduces his face, name and connection to Meriton first. Its 16 measured visual beats follow origins, the first eight flats, the builder replacement, the company name, the 1974 lender demand, retained rentals and World Tower. The builder and lender accounts are explicitly attributed to Triguboff's 2024 Forbes interview. Schematics are identified on screen; the 2008 portrait and World Tower photograph have individual provenance. There is no current wealth claim or invented historical document.

The six supplied Glasshouse references were revisited visually. Instagram playback audio was unavailable to the reviewer and the player did not yield a downloadable file. Do not describe this as a complete audiovisual review. Storytelling and visual approval from the user is still pending. The other three films need editorial revision after the direction is settled. Reassign release dates only after the launch buffer is complete.

The revised draft has narration and subtitles. Music and sound design have not been assessed against Glasshouse's audio and are not represented as complete.

Two weekly formats join the existing daily Reel programme. Wednesday's **The Deal** explains one business decision in 60–90 seconds. Sunday's **Property Empires** develops the historical company or family story in 90–150 seconds. Both use the existing 6:30–8pm Australia/Sydney window and the existing five-minute scheduler. This is a trial cadence, not a claim about the best time to post.

## Financial revision, 14 September 2026

The user accepted the stronger person-led visual direction and requested numbers that explain the business's progression. All public money amounts now use AUD. The Triguboff revision connects the A$6,800 historical-equivalent land purchase to eight flats and A$51,000 gross block-sale proceeds, then the later 18-flat Gladesville project. The conversion uses the official decimal rate and is not inflation-adjusted. Construction costs, net profit, the Gladesville sale price and an exact reinvestment transfer remain unverified.

The later rental story includes reported FY2020 rents of A$447 million and a separate comparison of group after-tax profit, A$356 million in FY2019 versus A$19.4 million in FY2020. These are group measures from Apartments.com.au's 1 December 2020 reporting on lodged accounts, not the founder's personal income or returns from the original eight flats. The chart uses a shared scale and zero baseline. Original accounts were not obtained. The complete source URLs and qualification are in `shared/documentaryReels.ts`.

The revised review export is 121.3 seconds. All 16 encoded visual beats, money labels and subtitle clearances were inspected. Type checking and 41 focused tests passed. Video SHA-256: `5aef1364703cb914a29b93485d301c311bea1352267cc25dfe7ef18ae0f0c6e5`.

Renderer version 3 binds the financial fact record to the export fingerprint and invalidates older review records. This export remains for creative review. The user authorised the repository destination earlier, but subsequent creative revisions paused rollout; no new destination permission is needed. Nothing has been pushed, deployed or published during this revision.

## Initial episodes

| Sydney date           | Series           | Episode                               | Editorial purpose                                                         |
| --------------------- | ---------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| Wed 16 September 2026 | The Deal         | Grollo: from builder to part-owner    | Explain the distinction between contracting and ownership.                |
| Sun 20 September 2026 | Property Empires | The family behind the Grollo skyline  | Connect Luigi and Emma, Bruno and Rino, larger projects and risk.         |
| Wed 23 September 2026 | The Deal         | Meriton's second apartment business   | Explain the accommodation operation launched in 2003.                     |
| Sun 27 September 2026 | Property Empires | Harry Triguboff: the apartment thread | Connect the 1963 business, accommodation and later historical milestones. |

These are release slots, not receipts of publication. They become eligible only after four exact exports have passed review and this change is deployed. A missed date does not silently backfill on another day. The ordinary evidence programme remains available on other days and when no reviewed documentary is assigned. Only one automatic Reel can publish in a Sydney day.

The rest of the proposed four-week pilot is an editorial backlog, not approved publication inventory:

| Proposed date    | Series           | Research direction                                                  |
| ---------------- | ---------------- | ------------------------------------------------------------------- |
| Wed 30 September | The Deal         | Lang Walker: selling and rebuilding a development business          |
| Sun 4 October    | Property Empires | Lang Walker: projects, cycles and the company story                 |
| Wed 7 October    | The Deal         | Stan Perron: the property portfolio alongside an operating business |
| Sun 11 October   | Property Empires | Stan Perron: the long development of the group                      |

Those four need their own sourced scripts, licensed imagery, exports and review records before entering the registry. Never reuse the first four episodes to fill those dates. Daylight saving begins in Sydney on 4 October; use the timezone clock rather than a fixed UTC offset.

## Production and sources

- `documentaryEpisodes.ts` contains the authored narration, chapter copy, source IDs and explanatory comparisons. No language model writes at publication time.
- `shared/documentaryReels.ts` provides the public reading notes and free source links. The same references appear in each caption and on `/social#<episode-id>`.
- ANU's biography supplies independently researched early Grollo history. Bruno's Property Council speech supplies attributed first-person recollections. Where their early dates differ, use the biography.
- Meriton Suites supplies the company's account of its 2003 launch and June 2017 rebrand. The Property Council's 2 May 2015 profile supplies the historical 1963 starting point and contemporary scale. Do not present the 2015 apartment total as current.
- The scripts distinguish recorded events from The Desk's interpretation. They do not infer profitability, motives for retaining stock, current wealth, ownership percentages or a repeatable investment return.
- Actual archive photographs show Rialto in 2009, Harry Triguboff in 2008 and a Meriton building in 2024. The files and their licences are individually documented in `shared/documentaryPhotos.ts`. The Australian-money shot is explicitly an illustration. All source notes and adaptation credits are public.
- The original video design uses the existing Playfair Display and editorial sans typography, navy/ivory/gold palette, 30 fps camera motion and measured phrase reveals. The two-role graphics explain the business relationship without invented money figures.
- Narration uses local Kokoro `bm_fable` at 1.0. The voice's existing nine-utterance process bound is retained; each of the eight scenes contains one or two measured phrases. The encoder checks that decoded pictures cover the complete narration.
- New length limits apply only to documentary stories. Existing 32-second data and 46-second housing limits remain. Captions, photograph credits and subtitles retain the shared vertical clearance contract.
- Long-Reel companion Stories use the complete opening and takeaway, capped at 35 seconds. They do not cut spoken sentences or try to upload a 90-second Story.

## Review and publication

Run one episode, or all four, into a new directory:

```sh
node --import tsx scripts/review-documentary.ts all /absolute/new-directory
```

The command exports each voiced, subtitled MP4, cover, caption and measured review record. It never calls Meta or approves itself. Inspect the encoded scene frames, opening portrait crop, reading clearance, actual duration, narration integrity, complete ending and the corresponding source notes. Retain the complete export for later comparison.

After review, record the exact input hash, video hash, duration and date in `documentaryReviews.ts`. All four initial reviews must match before any pilot episode becomes eligible. Missing reviews, changed scene copy, source metadata, visual mappings, approved photo bytes, voice or safe areas withhold eligibility. Increment the documentary renderer version when changing its visual treatment and repeat review. A matching hash establishes input identity, not independent factual truth or an audience-performance result.

Each episode has a permanent publication identity independent of its release date, voice and script revisions. Wednesday and Sunday use the same daily delivery claim and history as the data Reels. A documentary's uncertain publication receipt continues to block the programme after its slot expires. Expiring a preparation attempt never removes a publication lock.

For subsequent production, choose the story and free sources first, record the turning point and source limitations, resolve visual rights, write the hook through takeaway, render, and review. Keep a rolling buffer of four completed episodes. A backlog item or an article URL is not a completed episode.

## Assessing the pilot

Compare each format after comparable seven-day observation windows. Use the account's available Reel insights: reach, non-follower reach where available, watch time, shares, saves and profile actions. Compare rates as well as totals, and distinguish 60–90-second stories from the longer biographies. Check meaningful visits from `/social` to source notes and site reading. Do not treat four posts as proof of a winning cadence.

## Initial export record

Reviewed 14 September 2026: Grollo ownership 63.9 seconds; Grollo family 91.9 seconds; Meriton accommodation 69.6 seconds; Triguboff 97.1 seconds. Full decoded video coverage and matching script/visual hashes were verified; encoded frames from every scene were inspected. The long Grollo episode also passed the companion Story export path.

Type checking, the production build, unused-code/dependency checks and 94 focused tests passed. The full local test suite was attempted but did not complete and was stopped. CI is still required before merge. The change was rebased onto main at `35297c2`, retaining the newer automatic first-comment workflow.

An earlier automatic approval review rejected the GitHub branch push because the repository destination lacked explicit user approval at that point. The user subsequently authorised the destination, then requested creative revisions; rollout remains paused for those revisions. No Reel or Story was posted, and there is no deployment or Instagram publication receipt for this pilot.

## Cinematic revision, 14 September 2026

The new Harry preview has 41 authored visual sections within the 16 measured phrases. It opens on Harry and the reported debt crisis, develops the full business progression, and returns to the original eight-flat motif before the company-reported built total. New licensed archive images show Tianjin in 1930, World Tower in 2014 and Meriton construction in Parramatta in 2015. These are dated context images; original apartment and building diagrams remain explicitly illustrative.

`documentaryDirection.ts` defines cuts within sample-measured phrase durations. `documentarySoundtrack.ts` supplies an original deterministic stereo score and soft transition taps. Music ducks under the existing Fable narration at speed 1.0. There are no external music samples or paid services. Renderer version 7 binds the direction and sound configuration to the review hash. The public source page includes the new credits and supplying Kyoto University Library archive link.

The export is 169.7 seconds, H.264 1080 × 1920 at 30 fps with stereo AAC at 48 kHz. All 41 visual sections plus the opening and final frame were inspected from the encoded MP4. The full narration is present. Audio measured -17.54 LUFS and -4.07 dBTP; these are technical measurements, not human listening approval. Type checking, the frontend build and focused tests passed.

Input hash: `101e731ba1207265635c280825d8e5b82121377558a04e147a9f5bdeca03dd88`.
Video SHA-256: `15a53cce4a4bc1343e21e190b576df686abf382d740238fc798edec6b5c3c266`.

This is a new creative preview. Historical review records do not approve this export, and the four-film publication gate remains closed.

## Release authorisation, 17 September 2026

Ruben's instruction, “I trust them to be good lets start posting etx”, authorises
release of the four recovered exact exports after the disclosed review limitations.
This is user release authorisation, not a claim that Ruben watched or listened to
them, and not a newly performed full listening or continuous-motion review. It
applies to the four SHA-256 identities in `documentaryReviews.ts`; changed inputs
or bytes invalidate it. The original source qualifications and recovered review
packages remain attached in `documentary-editorial-queue.json`.

`documentaryReleasePlan.ts` assigns Harry to Sunday 20 September, Lowy to Wednesday
23 September, Grollo to Sunday 27 September and Walker to Wednesday 30 September,
all in the existing 18:30–20:00 Sydney window. Scheduling is deliberately separate
from the old render-input `releaseDate` and the permanent episode receipt identity.
No expired slot is reused and no receipt is reset. The scheduler's one-Reel-per-day
claim, ordinary fallback and uncertain-publication locks remain in force.

Delivery reconstructs the saved MP4 from repository binary parts, verifies its
complete hash and submits those exact bytes. It does not regenerate approved
films. All four archives must validate before a documentary can clear the launch
buffer. This adds no service, paid storage, commercial assets or new voice API.

Before a documentary becomes eligible, the server compares its authored subject,
underlying event and central takeaway against every ordinary programme recipe,
future documentary releases and all recorded Reel receipts from the previous 90
days. Founder/company/family aliases share identities. Unknown recipes, unlinked
recorded Reels, unavailable or over-limit history and repeated subjects are held;
a changed title is not a sourced distinction. Stored export hashes are compared
where historical render provenance exists. Older receipts without a render hash
are classified by their registered recipe, not misrepresented as byte-verified.
This covers the existing application's two Reel programmes, not unrecorded posts
made outside this application. Documentary bytes cannot be submitted through an
ordinary publication identity. The same check runs again immediately before
preparing a documentary for Meta delivery.

Private deployment logs report `documentary release readiness` for the future
slots using live database reads, permanent receipt states and archive integrity.
These are readiness records, not publication receipts. Only a confirmed permanent
`Published media <id>` receipt establishes publication. The production worker
continues to check at the existing five-minute cadence; no extra releases or daily
documentary cadence are introduced. Future new films still need their own review
and release authorisation under the production playbook.
