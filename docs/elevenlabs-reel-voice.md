# Ruben's voice for The Desk Reels

The connected ElevenLabs workspace contains the cloned voice **Ruben**, ID
`xeSYpoWjkR3imzxB6qDk`. On 18 September 2026 Ruben requested this voice for future
Reels. ChatGPT connector access does not supply credentials to the website.

## Activate on the deployed server

1. Create a restricted API key in that ElevenLabs workspace with Text to Speech
   access and Voices read access. Store it in the host's secret environment
   settings as `ELEVENLABS_API_KEY`, never in source control or a `VITE_` variable.
2. Leave `REEL_VOICE_PROVIDER` unset for the default `auto` mode: it selects
   ElevenLabs when its key exists, local Kokoro otherwise, and substitutes Kokoro
   for one render if the clone cannot speak. Set `REEL_VOICE_PROVIDER=elevenlabs`
   instead to require the clone, which keeps a failed clone from publishing at all.
3. `ELEVENLABS_VOICE_ID` defaults to `xeSYpoWjkR3imzxB6qDk`; set it explicitly if desired.
4. Deploy the change and restart the server to load the environment settings.
5. Confirm the Admin Instagram readiness panel reports ElevenLabs voice access.
   Generate and listen to a Reel preview before its first scheduled publication.

The read-only health probe verifies access to the voice; it does not spend speech
credits or prove the account has synthesis quota. Rendering validates actual audio,
so a failed request, quota error, timeout or silence never reaches a published
video: under `auto` the local voice speaks that Reel instead, and under an
explicitly required provider nothing publishes. In `auto` mode the readiness panel
says which voice a listener would actually hear. The existing publication
reservations and deduplication rules remain in force.

## Audio and subtitles

New documentary and briefing Reels use **newsreader-v2**, extending Ruben’s
approved continuous Lowy read with protected meaning boundaries (19 September
2026). The change applies to future renders only. Do not rebuild or replace existing or
scheduled MP4 archives, their digests, review approvals or release dates.

The shared provider sends the entire verified script in **one continuous take**
to `eleven_multilingual_v2` with source-text timestamps. Settings are speed 1.0,
stability 0.5, similarity boost 0.75, style 0 and speaker boost enabled. Explicit
review speed overrides remain available. The Kokoro profile's voice name does
not override Ruben's configured clone.

The approved pace comes from continuous sentence flow and shorter pauses, not
pitch changes or time stretching. Only quiet gaps of at least 350ms at punctuation
are eligible for tightening: retain 160ms at each quiet edge, protect 200ms after
the preceding word and 120ms before the next, and fade each splice over 3ms.
The accepted preview averaged about 167 words per minute; this is a reference,
not a command to force every script to an identical rate.

The renderer chooses `newsreader-v2-briefing` for ordinary/data/briefing Reels and
`newsreader-v2-documentary` for documentary scenes. Both retain the approved
synthesis settings above. Editorial reference ranges are 165–180 and 150–170 wpm
respectively; no time stretching, pitch shift or silence insertion enforces them.
At protected boundaries, preserve at least 450ms (briefing) or 600ms (documentary)
of the existing word-to-word gap, or the entire gap if it is already shorter.
These are production heuristics to review, not scientifically proven optima.

Protection uses conservative cues: a completed statement containing digits or
spoken number words, a contrast beginning with “but”, “yet”, “however”, “instead”,
“despite” or “nevertheless”, and a punctuation boundary before the final passage.
`protectPauseAfterWords` can explicitly mark zero-based whitespace word indexes
on a directed speech line or across a documentary scene’s joined phrases. Direction must identify punctuation and is never read
aloud. Unmarked boundaries retain the approved quiet-edge protection. Scene
changes alone do not earn extra silence. Names or implied narrative turns that
lack these cues need explicit direction or listening review; this is not semantic
understanding of every script.

Each new ElevenLabs render stores optional `delivery` provenance: profile, script
and PCM hashes, cuts in source samples, protected gaps before/after editing,
measured rate and per-passage review flags. The final captions and pictures still
follow the edited sample clock. Review flags are advisory, not automatic creative
approval or a trigger for repeated paid synthesis. Rates use written whitespace
tokens; a numeric token can expand into several spoken words. Passages under ten
words do not receive fast/slow flags.

For an offline comparison of the same source performance:

```sh
pnpm narration:review /absolute/script.json /absolute/timestamp-response.json /absolute/new-output
```

The script is an array of `{key,text,protectPauseAfterWords?}` objects. The response
is an ElevenLabs PCM24k `with-timestamps` JSON with exact source alignment. The
command saves the source, briefing and documentary WAVs plus measured review JSON;
it makes no paid requests and does not post. Existing output directories are refused.

Direct a human or AI-assisted performance toward one listener, using Ruben’s
natural accent and pitch, one main emphasis per thought, clear numbers and units,
and restrained emotion. Briefings lead with the change and consequence;
documentaries allow important turns to land. Do not inject acting directions or
v3-only audio tags into the current v2 narration text. A high-quality human guide
or Voice Changer performance remains an optional reviewed input, never a new
requirement for daily automated production.

Research basis: [speech rate and information density](https://repositori.upf.edu/bitstreams/4a43adcc-3dc9-4cfd-8c17-7c78f42e30c8/download),
[context-dependent processing effects](https://link.springer.com/article/10.1007/s10919-024-00477-6),
and [ElevenLabs delivery controls](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech).
Parameter/model auditions remain separate experiments; no untested stability or
model change is promoted automatically.

Picture changes and captions follow the edited audio's sample clock and exact
source words. There is no added gap between phrases or scenes; the final picture
holds for 450ms after the narration. Caption text retains all verified words and
numbers. Reject missing or mismatched alignment rather than guessing new timing.

Requests return mono 24 kHz PCM. A full take is bounded to 180 seconds/8,000 text
characters, 16 passages and one 90-second request deadline. Individual passages
remain bounded to 30 seconds. A small exact-script cache and shared in-flight
requests avoid duplicate charges in one server process. New synthesis uses
ElevenLabs credits. Readiness checks only verify voice access, not synthesis.

If ElevenLabs fails under `auto`, the whole narration is re-spoken by Kokoro Fable
rather than losing the slot, and never half in each voice: one Reel has one
speaker. A substituted render is not silent about it — the server logs
`[reel] ElevenLabs narration failed…` and the render record stores
`engine: "local-kokoro"`, so `pnpm documentary:review` and the Reel audit show
which voice shipped. Set `REEL_VOICE_PROVIDER=elevenlabs` to refuse the
substitution and fail the render instead, or `REEL_VOICE_PROVIDER=local` to stay
on Kokoro Fable. Existing published videos are not revoiced or republished.

API contract: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
