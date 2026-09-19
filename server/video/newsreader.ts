import { audibleWave } from "./localVoice";

export type TimedWord = { text: string; start: number; end: number };
export type AlignedClip = { key: string; bytes: Buffer; start: number; words: TimedWord[] };
export type CharacterAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};
export const NEWSREADER_DELIVERY = "newsreader-v1";
export const NARRATION_PCM_LIMIT = 180 * 48000;

/** Canonical mono 24kHz PCM. Full takes are bounded separately from passages. */
export function narrationWave(pcm: Buffer): Buffer {
  if (!pcm.length || pcm.length % 2 || pcm.length > NARRATION_PCM_LIMIT)
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
  return Buffer.concat([header, pcm]);
}

/** Preserve a single performance. Tighten only punctuation-aligned quiet gaps,
 * keeping 160ms at either quiet edge and protecting neighbouring spoken words.
 * The approved preview used this policy, with no pitch or tempo change. */
export function newsreaderClips(
  lines: Array<{ key: string; text: string }>,
  pcm: Buffer,
  alignment: CharacterAlignment
): AlignedClip[] {
  narrationWave(pcm); // Format/size guard before sample reads.
  const text = lines.map((l) => l.text).join(" ");
  const chars = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;
  const duration = pcm.length / 48000;
  if (
    !Array.isArray(chars) ||
    chars.join("") !== text ||
    !Array.isArray(starts) ||
    !Array.isArray(ends) ||
    starts.length !== chars.length ||
    ends.length !== chars.length ||
    chars.some(
      (c, i) =>
        typeof c !== "string" ||
        !c.length ||
        !Number.isFinite(starts[i]) ||
        !Number.isFinite(ends[i]) ||
        starts[i]! < 0 ||
        ends[i]! < starts[i]! ||
        ends[i]! > duration + 1 / 24000 ||
        (i > 0 && (starts[i]! < starts[i - 1]! || ends[i]! < ends[i - 1]!))
    )
  )
    throw new Error("ElevenLabs returned incomplete or invalid source-text alignment.");
  // Expand provider character entries to JS string offsets (including surrogate pairs).
  const charTimes = chars.flatMap((c, i) =>
    c.split("").map(() => ({ start: starts[i]!, end: ends[i]! }))
  );
  const words: TimedWord[] = Array.from(text.matchAll(/\S+/gu), (match) => {
    const offset = match.index!;
    const lexical = Array.from(match[0].matchAll(/[\p{L}\p{N}]/gu));
    if (!lexical.length) throw new Error("Narration has an unaligned standalone symbol.");
    return {
      text: match[0],
      start: charTimes[offset + lexical[0]!.index!]!.start,
      end: charTimes[offset + lexical.at(-1)!.index! + lexical.at(-1)![0].length - 1]!.end,
    };
  });
  const windows = words
    .slice(0, -1)
    .flatMap((w, i) =>
      /[.,;:!?][”"')]*$/u.test(w.text)
        ? [{ from: w.end + 0.2, to: words[i + 1]!.start - 0.12 }]
        : []
    );
  const cuts: Array<{ from: number; to: number }> = [];
  const threshold = 32768 * 10 ** (-28 / 20);
  let quietStart = 0;
  for (let i = 0; i <= pcm.length / 2; i++) {
    if (i < pcm.length / 2 && Math.abs(pcm.readInt16LE(i * 2)) < threshold) continue;
    if (i - quietStart >= 0.35 * 24000) {
      for (const w of windows) {
        const from = Math.round(Math.max(quietStart / 24000 + 0.16, w.from) * 24000);
        const to = Math.round(Math.min(i / 24000 - 0.16, w.to) * 24000);
        if (to - from > 0.06 * 24000) {
          cuts.push({ from, to });
          break;
        }
      }
    }
    quietStart = i + 1;
  }
  const source = Buffer.from(pcm);
  const pieces: Buffer[] = [];
  let previous = 0;
  for (const { from, to } of cuts) {
    // Three milliseconds on each side of the splice prevents low-level clicks.
    for (let j = 0; j < 72; j++) {
      const left = from - 72 + j,
        right = to + j;
      source.writeInt16LE(Math.trunc(source.readInt16LE(left * 2) * (1 - j / 71)), left * 2);
      source.writeInt16LE(Math.trunc((source.readInt16LE(right * 2) * j) / 71), right * 2);
    }
    pieces.push(source.subarray(previous * 2, from * 2));
    previous = to;
  }
  pieces.push(source.subarray(previous * 2));
  const edited = Buffer.concat(pieces);
  const mapped = (t: number) => {
    const sample = Math.round(t * 24000);
    return (
      (sample - cuts.reduce((n, c) => n + Math.max(0, Math.min(sample, c.to) - c.from), 0)) / 24000
    );
  };
  const timed = words.map((w) => ({ ...w, start: mapped(w.start), end: mapped(w.end) }));
  let cursor = 0;
  const groups = lines.map((line) => {
    const count = line.text.trim().split(/\s+/).length;
    const group = timed.slice(cursor, cursor + count);
    cursor += count;
    return { key: line.key, words: group };
  });
  return groups.map((group, i) => {
    const start = i ? group.words[0]!.start : 0;
    const end = groups[i + 1]?.words[0]?.start ?? edited.length / 48000;
    const bytes = narrationWave(
      edited.subarray(Math.round(start * 24000) * 2, Math.round(end * 24000) * 2)
    );
    if (!audibleWave(bytes))
      throw new Error("ElevenLabs returned invalid, silent or overlong passage audio.");
    return {
      key: group.key,
      start,
      bytes,
      words: group.words.map((w) => ({ ...w, start: w.start - start, end: w.end - start })),
    };
  });
}
