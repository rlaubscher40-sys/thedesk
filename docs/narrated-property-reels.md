# Narrated property Reel pilot

The scheduled Reel now reads the same verified ABS CPI rent feed as the free
Brisbane–Perth comparison. It requires matching, recent reference months and
preserves city boundaries, original-series identity, revisions and source links.
No model writes causal explanations from these figures. Rent growth is neither
rental yield nor an investment ranking. Two city observations are not plotted
as a time series.

The existing server scheduler checks for an unpublished verified comparison
every five minutes, including 15 seconds after startup. The old Tuesday/Thursday
window and daily success/skip watermark no longer gate Reels. The pilot publishes
each ABS reference month once; it does not promise two new topics every week.
More editorial topics can extend this later. A revision updates the
evidence read without automatically reposting the same month. Publication uses
a durable reservation immediately before Meta's non-idempotent publish call;
uncertain responses stay locked. Quota, audio or evidence failures send no post.

Admin → Instagram shows the scheduler's actual enabled state, a real local
speech check, next cover tone, sourced caption and an on-demand video preview.
The panel is at the top of Admin, with distinct ready, rendering, retrying,
paused, published and uncertain/locked states. It refreshes every 30 seconds.
Previewing does not publish; no manual click or open browser is needed. Covers continue alternating from the last recorded
grid post; pinned posts keep their colours, so the pinned row is not guaranteed
to form a checkerboard. Manual/out-of-band posts can also change the grid.

## Voice and reproducible installation

`pnpm setup:voice` is included in the production build and CI. It installs the
standalone Linux x64 Piper release **2023.11.14-2** and **Cori high**, a UK English
female synthetic voice. Downloads use pinned URLs/revisions and SHA-256 checks.
The model is loaded locally on CPU. There is no speech API, new account or
per-request speech fee. Existing hosting CPU/storage usage still applies.
Other host architectures report narration unavailable and cannot publish Reels.

- Engine: https://github.com/rhasspy/piper/releases/tag/2023.11.14-2
- Source/license: https://github.com/rhasspy/piper/tree/2023.11.14-2
- Model revision: `1162a9173d0ce503555aed757976b7a9912eae4c`
- Model card: https://huggingface.co/rhasspy/piper-voices/blob/1162a9173d0ce503555aed757976b7a9912eae4c/en/en_GB/cori/high/MODEL_CARD
- The Cori card identifies its LibriVox training dataset as public domain.
  Model repository metadata is MIT. The release uses eSpeak NG and
  ONNX Runtime; their source and license notices are linked below. This is an existing model, not a clone of a competitor's voice.

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

Preparation is claimed atomically per evidence month and Sydney delivery day,
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
logs. CI renders a complete six-passage spoken comparison using the pinned model.

The corrected speech runtime uses the `speech2` preparation namespace (two
attempts per Sydney day) so failed attempts from the old runtime do not strand
an unpublished comparison. The ABS reference-month publication reservation is
unchanged: neither a confirmed nor an uncertain Meta publication can be retried.
