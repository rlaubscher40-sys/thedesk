---
name: desk-documentaries
description: Research, direct, refine and export The Desk's Australian property documentary Reels using the accepted Harry Triguboff standard. Use for The Desk documentary and Property Empires production, not ordinary data Reels or unrelated videos.
---

# The Desk documentaries

Use the user's current The Desk checkout. Read `docs/documentary-production-playbook.md` for the production method and `docs/documentary-reel-programme.md` for the existing schedule and release state. Do not infer repository, publishing or service authorisation from this skill.

The creative benchmark is the Harry Triguboff film accepted on 14 September 2026: introduce the person, explain the missing business progression, combine sourced AUD figures with purposeful imagery, and deliver a downloadable MP4. The benchmark is a standard of treatment, not a script to reskin or an automatic approval for new films.

## Begin with the subject

A named person is enough to start. Use the existing brief and evidence if present; otherwise run `node --import tsx scripts/new-documentary.ts <id> "Subject" /absolute/new-directory` from the project. Its empty facts are research tasks. Research the first credible project, later changes in selling/financing/ownership, setbacks, and the economics at scale. Read the supporting pages; record conflicts and unknowns. Prioritise free primary sources and credible free reporting.

Money is always AUD. Preserve historical periods, conversion basis and the distinction between land cost, gross sales, debt, rent, profit and wealth. Never infer a transfer from one project to the next without evidence. A company construction total does not establish current ownership. Keep all new claims traceable to checked sources.

## Direct each story

Choose visuals for the event: actual archive images for people and places; dated maps for movement; original diagrams for decisions and business relationships. Use image licences, attribution and source dates, not article availability, to establish reuse rights. Do not fabricate childhood photographs, records or project likenesses. Author the new subject's visual sequence; Harry-specific code is not a universal renderer.

Reuse typography, safe areas, Ruben's configured ElevenLabs clone at speed 1.0, sound approach and production checks. Use the shared Reel voice provider and record the actual speaker; `auto` may fall back to Fable for the complete narration. Saved documentary MP4s retain their original voice until explicitly rebuilt, checked and replaced together with their digest and voice record. Read `docs/elevenlabs-reel-voice.md` and `docs/documentary-revoice.md` when changing narration. Vary the rhythm around meaningful changes, hold complicated figures long enough to read, and make the ending answer the opening. The playbook explains the ten editorial criteria. Treat them as human judgement, never a self-awarded quality score.

## Export and finish

Register the sourced episode and its reading notes, asset records and appropriate visual treatment. Run `node --import tsx scripts/review-documentary.ts <episode-id> /absolute/new-directory`. This writes the voiced MP4, caption, cover, source dossier, timed shots, technical review and frame sheets. It never posts or grants creative approval. Inspect the encoded frames and complete ending; listen to the full MP4 when the environment supports audio review, otherwise state that limitation in review notes. Fix concrete faults and rerender changed media.

Deliver a normal downloadable MP4 link. Preserve the export identity, full source package and reusable work using the environment's supported storage mechanism. Record creative approval only for the exact version the user accepted; preserve the programme's review gate and current session authorisation. Verify required tests before merging code. Do not promise background work after ending the turn.
