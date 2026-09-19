import { createHash } from "node:crypto";
import { env } from "../core/env";
import { newsreaderClips, NARRATION_PCM_LIMIT, type AlignedClip } from "./newsreader";

import {
  deliveryProfile,
  deliveryBoundaries,
  type DeliveryMode,
  type DirectedSpeechLine,
} from "./narrationDelivery";
type SpeechLine = DirectedSpeechLine;
type SpeechAudio = AlignedClip;
const MODEL = "eleven_multilingual_v2";
const RESPONSE_LIMIT = NARRATION_PCM_LIMIT * 2;
const cache = new Map<string, SpeechAudio[]>();
const inFlight = new Map<string, Promise<SpeechAudio[]>>();

function voiceUrl() {
  if (!env.elevenLabsApiKey) throw new Error("Set ELEVENLABS_API_KEY on The Desk server.");
  if (!/^[a-zA-Z0-9_-]+$/.test(env.elevenLabsVoiceId))
    throw new Error("ELEVENLABS_VOICE_ID is invalid.");
  return encodeURIComponent(env.elevenLabsVoiceId);
}

/** Bounded, all-or-nothing synthesis: a partial script never reaches a render.
 *  This module never substitutes a speaker itself; reelVoice owns that choice. */
export async function elevenLabsSpeech(
  lines: SpeechLine[],
  speed = 1,
  mode: DeliveryMode = "briefing"
): Promise<SpeechAudio[]> {
  const delivery = deliveryProfile(mode);
  deliveryBoundaries(lines);
  const voice = voiceUrl();
  if (!Number.isFinite(speed) || speed < 0.9 || speed > 1.1)
    throw new Error("Invalid ElevenLabs speech speed.");
  if (
    !lines.length ||
    lines.length > 16 ||
    lines.reduce((n, l) => n + l.text.length + 1, 0) > 8000 ||
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
        delivery: delivery.id,
      })
    )
    .digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inFlight.get(key);
  if (pending) return pending;
  if (inFlight.size >= 2) throw new Error("ElevenLabs narration is busy. Retry shortly.");
  const task = (async () => {
    // One deadline covers every passage and response body in this batch.
    const signal = AbortSignal.timeout(90_000);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=pcm_24000`,
      {
        method: "POST",
        headers: {
          "xi-api-key": env.elevenLabsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: input.map((line) => line.text).join(" "),
          model_id: MODEL,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
            speed,
          },
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
        if (size > RESPONSE_LIMIT) {
          await reader.cancel();
          throw new Error("ElevenLabs narration exceeded the response limit.");
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    let data;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new Error("ElevenLabs returned invalid timestamp audio.");
    }
    if (
      typeof data?.audio_base64 !== "string" ||
      Buffer.from(data.audio_base64, "base64").toString("base64") !== data.audio_base64
    )
      throw new Error("ElevenLabs returned invalid base64 audio.");
    const result = newsreaderClips(
      input,
      Buffer.from(data.audio_base64, "base64"),
      data.alignment,
      mode
    );
    result[0]!.delivery!.synthesis = {
      model: MODEL,
      voice: env.elevenLabsVoiceId,
      speed,
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: true,
    };
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
