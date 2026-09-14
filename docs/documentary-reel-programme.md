# The Desk documentary Reel programme

## Current rollout status, 14 September 2026

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
