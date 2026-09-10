import { audibleWave } from "./localVoice";
import { joinPhraseAudio, type PhrasePlan, type PhraseAudio } from "./phraseSpeech";

export const EDITORIAL_VOICE_DIRECTION =
  "Read the supplied words exactly, as an Australian newsreader explaining housing data. Natural Australian English pronunciation, calm and authoritative, conversational rather than theatrical. Use varied sentence emphasis and clear numerical pronunciation. A measured, brisk editorial pace. No added words, music, sound effects or exaggerated pauses.";
export const OPENAI_AUDITION_MODEL = "gpt-4o-mini-tts";
export type OpenAiAuditionVoice = "cedar" | "marin";
const LIMIT = 30 * 24000 * 2;

function wave(pcm: Buffer) {
  const b = Buffer.alloc(44);
  b.write("RIFF");
  b.writeUInt32LE(pcm.length + 36, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24);
  b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([b, pcm]);
}

/** Explicit review-only provider. No credential disclosure, local voice fallback,
 * unauthenticated HTTP endpoint or change to automatic publishing defaults. */
export async function auditionOpenAiPhrases(
  plans: PhrasePlan[],
  voice: OpenAiAuditionVoice
): Promise<PhraseAudio[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key)
    throw new Error("OpenAI voice audition needs OPENAI_API_KEY in the authorised environment.");
  if (
    !["cedar", "marin"].includes(voice) ||
    !plans.length ||
    plans.length > 9 ||
    plans.reduce((n, p) => n + p.phrases.length, 0) > 16 ||
    plans.some(
      (p) =>
        !p.phrases.length ||
        p.phrases.length > 3 ||
        p.phrases.join(" ") !== p.text ||
        p.text.length > 1200
    )
  )
    throw new Error("Invalid voice audition plan.");
  const result: PhraseAudio[] = [];
  for (const plan of plans) {
    const parts = [];
    for (const text of plan.phrases) {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OPENAI_AUDITION_MODEL,
          voice,
          input: text,
          instructions: EDITORIAL_VOICE_DIRECTION,
          response_format: "pcm",
          speed: 1,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok || !response.body)
        throw new Error(`OpenAI voice audition failed (HTTP ${response.status}).`);
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > LIMIT) {
          await reader.cancel();
          throw new Error("OpenAI voice passage exceeded the audio limit.");
        }
        chunks.push(Buffer.from(value));
      }
      const pcm = Buffer.concat(chunks);
      if (pcm.length % 2) throw new Error("Malformed OpenAI PCM audio.");
      const bytes = wave(pcm);
      if (!audibleWave(bytes))
        throw new Error("OpenAI voice audition returned invalid or silent audio.");
      parts.push({ text, bytes });
    }
    result.push({ key: plan.key, ...joinPhraseAudio(parts) });
  }
  return result;
}
