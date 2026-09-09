# Visual approvals Reel

The Brisbane–Perth approvals recipe now produces a dated storyboard alongside
its verified figures. Its eight spoken passages control the opening illustration,
two bars on a shared zero-based scale, the comparison period, and separate
approval/construction/completion scenes. The final frame explains what else a
viewer needs to understand supply. A scene starts at its measured WAV passage
boundary. Sub-phrase caption timing remains length-weighted; this is not word
alignment.

The renderer rejects a storyboard whose narration, order or values differ from
the generated evidence recipe. It retains the source period and rejects measured
videos above 32 seconds. The comparison is not a time series, a shortage ranking
or a claim that every approval becomes a completed home.

The scheduled renderer and the authenticated preview both receive the storyboard
through the existing candidate. No scheduler, monthly publication key, daily
quota, evidence hash definition or uncertain-publication lock is reset. Revising
the visual treatment cannot repost a month already published. Other recipes keep
the existing statistic-card renderer for now.

The approvals caption now follows a short narrative: hook, exact dated figures,
meaning, practical limit and a bio destination. It names ABS and retains original
series/seasonal-adjustment context and material provisional/revised observations.
It no longer prints API or tracking URLs, engine names or empty revision flags.
AI narration is still disclosed. Detailed methodology and source links remain on
the comparison page. The four other recipe captions are unchanged.

## Voice review

The production voice remains the existing local George profile until a listening
review selects a replacement. The render API now accepts bounded local George,
Fable and Daniel audition profiles, with speed between 0.9 and 1.1. The child
process validates the profile too. Cache keys include both voice and speed, so
one audition cannot accidentally play another voice's cached audio. No remote
speech service, fee, credential or hosting-plan change is introduced.

The new script spells out exact counts and gives each sentence a clear purpose.
The three building stages each have their own utterance. There is less inserted
silence between scenes. Neither tests nor PCM amplitude establish that a synthetic
voice sounds human: the produced audio needs a listening review. Fable in a review
file is an audition, not an approved production voice change.

## Reproduce the posted story

Install the locked dependencies and pinned voice assets, then run:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm setup:voice
node --import tsx scripts/review-supply-reel.ts --out /tmp/desk-reel-review --voice bm_fable
```

The script uses the checked-in ABS snapshot that reproduces the user's posted
year-to-July-2026 totals: 27,628 in Greater Brisbane and 22,229 in Greater Perth.
This is a historical review, not a fresh release lookup. It writes a narrated,
subtitled MP4, the revised caption, scene JPEGs, a voice audition WAV and metadata.
It never publishes. Use `--frames-only` for layout inspection. Omit `--voice` for
a George audition at speed 1.0; the existing production default is George 1.02.

Tests cover figure spelling, edited or reordered narration, speech/scene timing,
caption integrity, voice-cache isolation and passing the storyboard through the
publishing wrapper. Review rendered frames at phone size and listen to the full
clip before choosing a voice or publishing a remake.
