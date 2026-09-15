# Automatic social caption standard

Captions are editorial copy, not transcripts or internal research notes. The shared composer in `server/instagram/editorialCaption.ts` is used by daily and weekly briefings, Wider Lens, number cards, monthly reviews, introductory posts and all Reel recipes. There is no new model call, subscription or manual writing step at scheduled publication time.

## Reader order

1. Open with the actual story, number, decision or tension. Keep a complete claim, never a clipped headline. Documentary and verified data-Reel hooks have a 110-character budget; source-led daily headlines 170; other complete source headlines 200. These are editorial budgets, not a promise about Instagram's collapsed-caption display.
2. Add evidence and explain its meaning. Preserve measure, place, period, direction, attribution and uncertainty. A documentary has written copy of its own, not spoken dates pasted into a caption.
3. Give the reader one useful task or takeaway suited to the topic. Do not routinely ask them to save, share, comment and follow. The automatic first comment remains a separate discussion prompt.
4. Put detailed references and methodology in a readable footer, after the story. Keep qualifications that affect interpretation. Sources do not become optional to make room for a stronger hook.
5. Use three relevant hashtags selected from the actual format/topic. Wider Lens does not inherit Australian property tags. Loan and migration Reels do not inherit supply tags. Preserve AI narration disclosure for voiced documentary and verified Reels.

## What is automatic

Source-led news uses the selected publisher headline and usable detail, with a labelled reading lens and topic-specific takeaway. It ignores cached social hooks and generated interpretations. Source and briefing dates remain distinct. Wider Lens carries every included headline whole, with source and story links.

Stat captions use the computed value and claim, not the optional model-written card sentence. Known display vocabulary is converted to readable case without lowercasing RBA, ABS, NSW or unknown proper names. Recorded dates and history limits travel with the number. A generic number Reel points to market data, not an unrelated city-rent comparison.

Monthly captions pair each figure with its source information. The scheduler passes current provider metadata separately from the existing card's short source label. The caption explicitly identifies The Desk's recorded-history calculation; current provider metadata does not prove historical provenance. Missing provider metadata is disclosed, not invented. The destination is the existing market-data page, not a promised monthly archive that does not exist.

Verified data Reels keep their existing evidence checks, periods, revision flags, signed values and metric definitions. The common composer orders story, takeaway and source footer consistently. All eight recipes inherit the same policy without individual scheduled edits.

Documentary captions live in `documentaryCaption.ts`, keyed to the checked public reading registry. Adding a reading entry requires caption copy at type-check time, and an unregistered subject fails at runtime. Author the hook, story, labelled interpretation and relevant viewing prompt alongside the research. Full source citations, limitations and image adaptation/licence notices are retained automatically. This is repeatable publishing of researched films, not automatic research or creative approval of unseen films.

## Fail safely

The composer rejects incomplete fields, oversized hooks and captions over their budget. It never slices a fact, drops the last source or makes up a filler summary to fit. Verified data Reels retain 1,400 characters; other formats have a 2,200-character ceiling. An overlong source-led caption needs a shorter, reviewed input, not silent truncation.

The API backstop applies to supplied manual captions as well: no empty or overlong caption, em dashes, common American prose spellings, hashtag stuffing or explicit engagement bait. Missing captions on carousel children and Stories remain valid. This is a mechanical guardrail, not proof that the facts or editorial judgement are correct.

Caption edits do not change posting cadence, create catch-up posts, reset publication identities, waive evidence freshness or approve a documentary export. Introduction-post hashes continue binding the reviewed content. Existing video input hashes are unchanged by these caption-only changes.

## Verification

Run `pnpm test server/instagram/editorialCaption.test.ts server/instagram/reelCaption.test.ts server/instagram/post.test.ts`, then type checking and the full suite. Review the generated copy as a reader: can the opening stand alone, does the next paragraph add something, is the implication supported, and can every source still be found?

Do not award a performance score from passing tests. After publication, compare saves and shares relative to reach across similar posts and observation periods. A caption rewrite alone does not establish what caused a result.
