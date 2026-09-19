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

New documentary and briefing Reels use the approved **newsreader-v1** delivery
(19 September 2026). Ruben approved the continuous Lowy pacing preview and asked
for this delivery on future videos only. Do not rebuild or replace existing or
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
