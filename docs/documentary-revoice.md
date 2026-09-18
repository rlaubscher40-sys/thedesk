# Documentary narration and saved exports

`REEL_VOICE_PROVIDER=auto` prefers the configured ElevenLabs clone and re-speaks
the entire script locally if that provider fails. An already saved documentary
keeps its original audio until its MP4 is explicitly replaced. Its review entry
therefore records the exact voice alongside the MP4 digest; the publication
record must never infer an archived voice from current environment variables.

To review a documentary using speech generated in the connected ElevenLabs
workspace, retain each exact phrase and its generation ID, convert it to mono
16-bit PCM WAV at 24 kHz, and prepare `narration.json` beside the WAVs:

```json
{
  "version": 1,
  "episodeId": "lowy-westfield",
  "voice": { "engine": "elevenlabs", "voice": "xeSYpoWjkR3imzxB6qDk", "speed": 1 },
  "model": "eleven_multilingual_v2",
  "clips": [
    {
      "key": "label:0",
      "text": "Frank Lowy built Westfield with John Saunders.",
      "file": "label-0.wav",
      "sha256": "<actual WAV SHA-256>",
      "generationId": "<returned ElevenLabs generation ID>"
    }
  ]
}
```

Include every phrase exactly once. The loader verifies the episode and audio
digests. The renderer rejects missing, duplicated, changed, silent or malformed
phrase audio and rebuilds subtitle and visual timings from the actual samples.
The manifest records generation provenance; its metadata is not independently
authenticated, so prepare it only from the provider's returned generation records.

Run `node --import tsx scripts/review-documentary.ts <id> /absolute/new-output /absolute/audio-directory`.
For `all`, the audio directory must contain one subdirectory per episode ID.
Omit the last argument to use the application's configured live speech provider.
Neither route posts or creates release approval. Inspect the encoded video and
retain the review package. Update saved export bytes, their SHA-256, duration and
voice identity together only under the user's release authorisation. Preserve
publication keys, dates and duplicate locks. Never label a technical check as a
full listening or continuous-motion review.
