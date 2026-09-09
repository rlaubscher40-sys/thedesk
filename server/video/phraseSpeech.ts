import { audibleWave, localSpeech, type SpeechProfile } from "./localVoice";

export type MeasuredPhrase = { text: string; start: number; seconds: number };
export type PhraseAudio = { key: string; bytes: Buffer; phrases: MeasuredPhrase[] };
export type PhrasePlan = { key: string; text: string; phrases: string[] };

/** Remove excess leading/trailing model silence, retaining 100ms before and
 * 160ms after detectable speech to protect quiet consonants and natural tails.
 * No samples inside the utterance are removed or time-stretched. */
function speechPcm(bytes: Buffer) {
  const pcm = bytes.subarray(44);
  const total = pcm.length / 2;
  let first = 0,
    last = total - 1;
  while (first < total && Math.abs(pcm.readInt16LE(first * 2)) <= 100) first++;
  while (last > first && Math.abs(pcm.readInt16LE(last * 2)) <= 100) last--;
  const start = Math.max(0, first - 2400);
  const end = Math.min(total, last + 1 + 3840);
  return pcm.subarray(start * 2, end * 2);
}

/** Join the pinned child's PCM24k output without re-encoding. Phrase offsets
 * come from the samples actually included, not a words-per-second estimate. */
export function joinPhraseAudio(parts: Array<{ text: string; bytes: Buffer }>) {
  if (!parts.length || parts.length > 3) throw new Error("Invalid phrase count.");
  const phrases: MeasuredPhrase[] = [];
  const chunks: Buffer[] = [];
  let samples = 0;
  for (const [i, part] of parts.entries()) {
    const b = part.bytes;
    if (
      !part.text.trim() ||
      !audibleWave(b) ||
      b.toString("ascii", 12, 16) !== "fmt " ||
      b.readUInt32LE(16) !== 16 ||
      b.readUInt16LE(22) !== 1 ||
      b.readUInt32LE(24) !== 24000 ||
      b.toString("ascii", 36, 40) !== "data" ||
      b.readUInt32LE(40) !== b.length - 44
    )
      throw new Error("Phrase audio does not match the pinned PCM format.");
    // The voice already has natural sentence tails. Only a small separation
    // is added, with no change to Fable's speed or pitch.
    if (i) {
      chunks.push(Buffer.alloc(1920 * 2));
      samples += 1920;
    }
    const pcm = speechPcm(b);
    phrases.push({ text: part.text, start: samples / 24000, seconds: pcm.length / 48000 });
    chunks.push(pcm);
    samples += pcm.length / 2;
  }
  if (samples > 30 * 24000) throw new Error("Joined speech passage is too long.");
  const header = Buffer.from(parts[0]!.bytes.subarray(0, 44));
  header.writeUInt32LE(samples * 2 + 36, 4);
  header.writeUInt32LE(samples * 2, 40);
  return { bytes: Buffer.concat([header, ...chunks]), phrases };
}

export async function synthesisePhrases(
  plans: PhrasePlan[],
  profile?: SpeechProfile
): Promise<PhraseAudio[]> {
  if (
    !plans.length ||
    plans.length > 9 ||
    new Set(plans.map((p) => p.key)).size !== plans.length ||
    plans.some(
      (p) =>
        !p.phrases.length ||
        p.phrases.length > 3 ||
        p.phrases.some((t) => !t.trim()) ||
        p.phrases.join(" ") !== p.text
    )
  )
    throw new Error("Speech phrases do not preserve the verified script.");
  const requests = plans.flatMap((p) =>
    p.phrases.map((text, i) => ({ key: `${p.key}:${i}`, text }))
  );
  if (requests.length > 16) throw new Error("Too many speech phrases.");
  const clips: Awaited<ReturnType<typeof localSpeech>> = [];
  // Retain the existing nine-utterance child bound and serial voice queue.
  for (let i = 0; i < requests.length; i += 9)
    clips.push(...(await localSpeech(requests.slice(i, i + 9), profile)));
  return plans.map((p) => ({
    key: p.key,
    ...joinPhraseAudio(
      p.phrases.map((text, i) => {
        const clip = clips.find((c) => c.key === `${p.key}:${i}`);
        if (!clip) throw new Error("A spoken phrase is missing.");
        return { text, bytes: clip.bytes };
      })
    ),
  }));
}
