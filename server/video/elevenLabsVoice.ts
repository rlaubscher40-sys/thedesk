import { createHash } from "node:crypto";
import { env } from "../core/env";
import { audibleWave } from "./localVoice";

type SpeechLine = { key: string; text: string };
type SpeechAudio = { key: string; bytes: Buffer };
const MODEL = "eleven_multilingual_v2";
const PCM_LIMIT = 30 * 24000 * 2;
const cache = new Map<string, SpeechAudio[]>();
const inFlight = new Map<string, Promise<SpeechAudio[]>>();

function voiceUrl() {
  if (!env.elevenLabsApiKey) throw new Error("Set ELEVENLABS_API_KEY on The Desk server.");
  if (!/^[a-zA-Z0-9_-]+$/.test(env.elevenLabsVoiceId))
    throw new Error("ELEVENLABS_VOICE_ID is invalid.");
  return encodeURIComponent(env.elevenLabsVoiceId);
}

/** Canonical mono PCM24k WAV, shared by ffmpeg and measured phrase subtitles. */
function wave(pcm: Buffer): Buffer {
  if (!pcm.length || pcm.length % 2 || pcm.length > PCM_LIMIT)
    throw new Error("ElevenLabs returned malformed or oversized PCM audio.");
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(pcm.length + 36, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24);
  header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  const bytes = Buffer.concat([header, pcm]);
  if (!audibleWave(bytes)) throw new Error("ElevenLabs returned invalid or silent audio.");
  return bytes;
}

/** Bounded, all-or-nothing synthesis: a partial script never reaches a render.
 *  This module never substitutes a speaker itself; reelVoice owns that choice. */
export async function elevenLabsSpeech(lines: SpeechLine[], speed = 1): Promise<SpeechAudio[]> {
  const voice = voiceUrl();
  if (!Number.isFinite(speed) || speed < 0.9 || speed > 1.1)
    throw new Error("Invalid ElevenLabs speech speed.");
  if (
    !lines.length ||
    lines.length > 9 ||
    new Set(lines.map((l) => l.key)).size !== lines.length ||
    lines.some((l) => !l.text.trim() || l.text.length > 1000)
  )
    throw new Error("Narration script is empty or too long, or has duplicate keys.");
  const input = lines.map((line) => ({ ...line }));
  const key = createHash("sha256")
    .update(
      JSON.stringify({
        input,
        voice,
        speed,
        model: MODEL,
      })
    )
    .digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inFlight.get(key);
  if (pending) return pending;
  if (inFlight.size >= 2) throw new Error("ElevenLabs narration is busy. Retry shortly.");
  const task = (async () => {
    const result: SpeechAudio[] = [];
    // One deadline covers every passage and response body in this batch.
    const signal = AbortSignal.timeout(90_000);
    for (const [i, line] of input.entries()) {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=pcm_24000`,
        {
          method: "POST",
          headers: {
            "xi-api-key": env.elevenLabsApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: line.text,
            model_id: MODEL,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0,
              use_speaker_boost: true,
              speed,
            },
            previous_text: input[i - 1]?.text,
            next_text: input[i + 1]?.text,
          }),
          signal,
        }
      );
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error(
          `ElevenLabs narration failed (HTTP ${response.status}). Check the API key, voice access and credit balance.`
        );
      }
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > PCM_LIMIT) {
            await reader.cancel();
            throw new Error("ElevenLabs passage exceeded the 30-second audio limit.");
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
      result.push({ key: line.key, bytes: wave(Buffer.concat(chunks)) });
    }
    cache.set(key, result);
    while (cache.size > 4) cache.delete(cache.keys().next().value!);
    return result;
  })();
  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}

let checked: { at: number; ok: boolean } | undefined;
/** Read-only access probe. Health checks must not spend speech credits. Actual
 * synthesis still validates audio and blocks publishing on any speech failure. */
export async function elevenLabsVoiceReady(): Promise<boolean> {
  if (checked && Date.now() - checked.at < (checked.ok ? 300_000 : 15_000)) return checked.ok;
  try {
    const voice = voiceUrl();
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voice}`, {
      headers: { "xi-api-key": env.elevenLabsApiKey },
      signal: AbortSignal.timeout(10_000),
    });
    const ok = response.ok;
    await response.body?.cancel();
    checked = { at: Date.now(), ok };
  } catch {
    checked = { at: Date.now(), ok: false };
  }
  return checked.ok;
}
