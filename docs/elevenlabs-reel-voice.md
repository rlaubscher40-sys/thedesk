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

Regular scripts and phrase-based documentary/housing stories use the same provider.
ElevenLabs `eleven_multilingual_v2` reads only the verified text. Adjacent text
provides continuity between passages. The existing profile controls speed;
its Kokoro voice name does not override the configured clone.

The provider requests mono 24 kHz PCM and wraps it as a canonical WAV. Existing
phrase trimming, measured subtitles, ffmpeg duration checks and mixing operate on
the returned samples. Each passage is bounded to 30 seconds and each batch to
90 seconds. A small exact-script cache and shared in-flight requests avoid
duplicate charges in one server process. New synthesis uses ElevenLabs credits.

If ElevenLabs fails under `auto`, the whole narration is re-spoken by Kokoro Fable
rather than losing the slot, and never half in each voice: one Reel has one
speaker. A substituted render is not silent about it — the server logs
`[reel] ElevenLabs narration failed…` and the render record stores
`engine: "local-kokoro"`, so `pnpm documentary:review` and the Reel audit show
which voice shipped. Set `REEL_VOICE_PROVIDER=elevenlabs` to refuse the
substitution and fail the render instead, or `REEL_VOICE_PROVIDER=local` to stay
on Kokoro Fable. Existing published videos are not revoiced or republished.

API contract: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
