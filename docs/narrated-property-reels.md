# Narrated property Reel programme

Current production workflow: see `reel-production-playbook.md`. The registry
now has six evidence-gated topics. The early rollout history below describes
the initial two-topic programme; it is not the current topic inventory.

The scheduled Reel now reads the same verified ABS CPI rent feed as the free
Brisbane–Perth comparison. It requires matching, recent reference months and
preserves city boundaries, original-series identity, revisions and source links.
No model writes causal explanations from these figures. Rent growth is neither
rental yield nor an investment ranking. Two city observations are not plotted
as a time series.

The programme has two monthly topics: the rent comparison and an approvals
explainer using the existing ABS BA_GCCSA original dwelling-unit counts. Approvals
require twelve complete matching months for Greater Brisbane and Greater Perth.
They are never presented as starts, completions, a shortage ranking or an
investment winner. Each candidate contains a script, card, caption, exact source
trail, evidence hash and separate permanent topic/reference-month identity.

The existing server scheduler checks every five minutes, including after startup.
Automatic delivery starts between 6:30pm and 8pm Sydney time, at most once per Sydney
day across both topics. A confirmed topic makes way for the next eligible one;
uncertain outcomes pause the programme. Each topic/reference month posts once,
with no filler to meet a weekly quota. A revision changes the evidence hash and
caveat without reposting the same topic/month. Publication uses
a durable reservation immediately before Meta's non-idempotent publish call;
uncertain responses stay locked. Quota, audio or evidence failures send no post.

Admin → Instagram shows the scheduler's actual enabled state, a real local
speech check, next cover tone, sourced caption and an on-demand video preview.
The panel is at the top of Admin, with distinct ready, rendering, retrying,
paused, scheduled, daily-limit, published and uncertain/locked states. It refreshes every 30 seconds.
Previewing does not publish; no manual click or open browser is needed. Covers continue alternating from the last recorded
grid post; pinned posts keep their colours, so the pinned row is not guaranteed
to form a checkerboard. Manual/out-of-band posts can also change the grid.

## Voice and reproducible installation

`pnpm setup:voice` is included in the production build and CI. It installs
Kokoro-82M v1.0 (8-bit CPU model), with the approved **Fable** British male voice at speed 1.0
from pinned `kokoro-js` 1.2.1. Model/tokenizer downloads are revision- and
SHA-256-pinned; voice vectors and the phonemizer ship in locked npm packages.
The killable Node child process uses one ONNX CPU thread. Remote model access
and network fetch are disabled during narration. No speech API, new account,
per-request fee, GPU or change to hosting plan is required. Existing hosting
CPU/storage usage still applies. See `reel-voice-notices.txt` for licenses.

The six passages now form a story: a purchase question, the verified gap,
its direction, what the measure means, the missing purchase-price/cost inputs,
and the free comparison. Individual rates remain on screen. Narration never
supplies a cause, forecasts rents or turns rent growth into rental yield.
Equal or falling rates have separate wording. The permanent publication key
is unchanged: changing the voice cannot republish an already-used month.

The installer fails on a checksum mismatch or download failure. The server
does not download models during a publishing request and never falls back to
a paid API. Readiness synthesises a short sample and checks PCM amplitude;
each script passage is validated again, measured and mixed into AAC stereo.
Default render and publication both reject absent narration. Explicit silent
rendering is reserved for layout tests/previews and is rejected by publishing.

## Validation

Tests cover missing/stale/mismatched/future evidence, revisions, equal growth,
script duration, invalid/silent WAVs, quota failure, lost reservations and an
uncertain Meta response. CI installs and runs the actual voice and ffmpeg.

Dependency source/license references:
- https://github.com/espeak-ng/espeak-ng/blob/master/COPYING
- https://github.com/microsoft/onnxruntime/blob/main/LICENSE

## Automatic delivery safeguards

Preparation is claimed atomically in one shared slot per Sydney delivery day,
with two attempts per day and a 15-minute cooldown after failure. Rate/integrity
blocks pause further attempts for the day. After a process restart, preparation
claims older than 15 minutes can expire, but only while the publication slot is
unused; the separate Meta publication reservation is never reset. Successful
HTTP responses and skips do not count as publication: the exact evidence slot
must contain a confirmed numeric media ID. The worker passes its evidence hash
to the existing authenticated route, which rejects changed evidence before rendering.
Terminal attempt failures use the existing configured admin alert email.

A frozen browser cannot block this worker. The production scheduler and Meta
credentials must remain enabled; the panel shows when these are absent.

## Speech runtime recovery

The full script uses a 90-second synthesis budget. Identical simultaneous
requests share one process; different scripts queue behind it with at most two
pending scripts. Four exact-script results are kept in a bounded in-memory cache,
so a preview and publication can reuse the same verified speech. Changed figures
produce a different key. Failures are not cached. The short readiness check is
still a dependency probe, not proof that a complete Reel has rendered.

Process timeout, missing assets, permissions, exit code, termination signal and
invalid speech now propagate into the admin result instead of becoming a generic
“narration unavailable”. The detailed bounded native error is retained in server
logs. CI renders both complete six-passage stories using the pinned model and subtitles.

The programme uses `instagram-reel-delivery-programme-v1` for bounded daily
preparation. A confirmed publication timestamp also enforces the daily cap when
a delivery response or watermark was lost. The existing rent publication identity
is unchanged and approvals have their own identity. Neither confirmed nor
uncertain publication reservations can be reset by retry or a voice/copy change.

## Repeatable editorial standard

Every approved automatic topic needs a deterministic evidence adapter producing
one dated candidate: story, card, caption, source trail and permanent publication
identity. Approved topics are the monthly Brisbane–Perth rent comparison and
dwelling-approvals explainer. Two monthly topics are not a varied weekly calendar.

1. Start with a recognisable property decision, not the name of a data series.
2. State one verified finding. The screen carries the supporting numbers.
3. Explain the definition and its practical limit. Do not infer a cause from a
   numeric-only source, promise returns or call proposed homes completed homes.
4. Identify the evidence needed to take the decision further.
5. End with one relevant free product destination. The caption opens with the
   same question, adds the evidence/interpretation and retains dates, revision
   flags, sources and campaign attribution.
6. Use the same stock male narrator and measured speech timing. Reject missing
   audio and overlong custom scripts; never quietly replace the story with a
   literal card read. Preserve the publication lock across voice/copy revisions.

Next format candidates, each requiring its own verified adapter and tests:
- Market vs Market: matched measures, periods and geographies.
- What Changed: a verified change with a comparison baseline.
- Before You Buy: explain a property measure and the limits of a decision based on it.
Do not manufacture more monthly observations to meet a posting quota.

Audience learning is an editorial review, not an implemented automatic optimiser.
Use existing media reach/shares/saves and attributed comparison/subscription
activity. Review watch time in Instagram where available. Compare posts at the
same age; treat unavailable metrics as unknown, not zero. A handful of viewers
cannot establish a winning format. Test one change at a time (hook, topic or
explanation), keep factual safeguards fixed, and assess a series of posts before
changing the standard. Save/share prompts should name a useful reason or reader,
not demand every interaction. No system can guarantee virality or perfect copy.

## Sound-off story

The verified automatic comparison and its preview now require burned-in spoken
subtitles. The same trusted script supplies the voice and the subtitle text;
there is no transcription service or second model that could change a figure.
Each cue has at most two lines of 32 characters, set in the bundled JetBrains
Mono at 44px on a dark background. Reel frames reserve a band below the logo;
unchanged grid covers retain their existing design and alternation.

Passage boundaries use measured WAV durations and the same start times as the
audio mix. Longer passages split into readable phrases using length-weighted
timing; this is not claimed to be word-level forced alignment. Missing timing,
ambiguous keys, overlapping/unreadably short cues and words that do not fit are
rejected. ASS commands cannot be supplied through script text. The publisher
rejects an output without required subtitles before creating a Meta container.
Rendering stays local with the existing ffmpeg, font assets and CPU limits.

Both current formats use this pipeline. Other future formats need the same
layout and full-render checks. Cross-dissolve time is restored to each section
so the next voice cannot begin before the current passage and its tail finish.
The renderer also rejects measured clips over 32 seconds before publishing;
it never truncates spoken evidence to fit.
