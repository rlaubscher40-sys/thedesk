import type { ScriptLine } from "./narration";

export type SubtitleCue = { start: number; end: number; lines: string[] };
const LINE_CHARS = 32;

/** Preserve every word/number, with no model rewriting or transcription. */
export function captionChunks(text: string): string[][] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.some((w) => w.length > LINE_CHARS))
    throw new Error("Subtitle text cannot fit the readable layout.");
  function split(group: string[]): string[][] {
    const wrapped: string[] = [];
    for (const word of group) {
      const last = wrapped.at(-1);
      if (last && last.length + word.length + 1 <= LINE_CHARS)
        wrapped[wrapped.length - 1] += ` ${word}`;
      else wrapped.push(word);
    }
    if (wrapped.length <= 2) return [wrapped];
    // Balance phrases rather than leaving a tiny third-line orphan that
    // flashes for half a second (e.g. a lone "returns.").
    // A count such as "two hundred and thirty-two thousand" must stay in
    // one cue. Line wrapping inside the cue is fine; a timed cue boundary
    // halfway through the number forces viewers to reconstruct the amount.
    const numeric = (word: string | undefined) =>
      !!word &&
      /^(?:\d+(?:[.,]\d+)*|(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?|hundred|thousand|million|billion)$/i.test(
        word.replace(/[.,:;!?]$/, "")
      );
    const joinsNumber = (at: number) => {
      const left = group[at - 1],
        right = group[at];
      if (/[.!?;:]$/.test(left ?? "")) return false;
      return (
        (numeric(left) && numeric(right)) ||
        (numeric(left) && right?.toLowerCase() === "and" && numeric(group[at + 1])) ||
        (left?.toLowerCase() === "and" && numeric(group[at - 2]) && numeric(right))
      );
    };
    const preferred = Math.ceil(group.length / 2);
    const boundaries = Array.from({ length: group.length - 1 }, (_, i) => i + 1)
      .filter((at) => !joinsNumber(at))
      .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
    // Very long numbers that cannot fit one cue still preserve every word.
    const mid = boundaries[0] ?? preferred;
    return [...split(group.slice(0, mid)), ...split(group.slice(mid))];
  }
  return split(words);
}

/** Passages start with their measured audio. Phrase timing within a passage
 * is length-weighted, not claimed to be word-level forced alignment. */
export function subtitleCues(
  script: ScriptLine[],
  passages: Array<{ key: string; start: number; seconds: number }>
): SubtitleCue[] {
  if (!script.length || new Set(script.map((l) => l.key)).size !== script.length)
    throw new Error("Subtitle script keys are missing or duplicated.");
  const cues: SubtitleCue[] = [];
  for (const line of script) {
    const matches = passages.filter((p) => p.key === line.key);
    const p = matches[0];
    if (
      matches.length !== 1 ||
      !p ||
      !Number.isFinite(p.start) ||
      !Number.isFinite(p.seconds) ||
      p.start < 0 ||
      p.seconds <= 0
    )
      throw new Error("Subtitle passage has no verified audio timing.");
    const chunks = captionChunks(line.text);
    const weights = chunks.map((c) => c.join(" ").length);
    const total = weights.reduce((a, b) => a + b, 0);
    let used = 0;
    for (const [i, lines] of chunks.entries()) {
      const start = p.start + (p.seconds * used) / total;
      used += weights[i]!;
      cues.push({ start, end: p.start + (p.seconds * used) / total, lines });
    }
  }
  if (cues.length > 48) throw new Error("Too many subtitle cues.");
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]!,
      next = cues[i + 1];
    if (next && cue.end > next.start) {
      // Independent audio/frame rounding can overlap by one 30fps frame.
      // Trim that boundary instead of displaying two subtitle boxes together.
      if (cue.end - next.start > 1 / 30 + 0.001) throw new Error("Subtitle passages overlap.");
      cue.end = next.start;
    }
    if (cue.end - cue.start < 0.6) throw new Error("Subtitles cannot be read at this pace.");
  }
  return cues;
}

function timestamp(seconds: number): string {
  const ticks = Math.round(seconds * 100);
  return `${Math.floor(ticks / 360000)}:${String(Math.floor(ticks / 6000) % 60).padStart(2, "0")}:${String(Math.floor(ticks / 100) % 60).padStart(2, "0")}.${String(ticks % 100).padStart(2, "0")}`;
}

// ASS uses braces/backslashes as commands. Show them as punctuation, never as
// formatting instructions. All text comes from the same trusted spoken script.
function literal(text: string) {
  return text
    .replace(/\\/g, "＼")
    .replace(/\{/g, "｛")
    .replace(/\}/g, "｝")
    .replace(/[\r\n]/g, " ");
}
export function subtitleAss(
  cues: SubtitleCue[],
  layout: "card" | "story" | "documentary" = "card"
): string {
  return (
    `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Desk,${layout === "documentary" ? "Desk Editorial Sans" : "JetBrains Mono"},${layout === "documentary" ? "44" : layout === "story" ? "40" : "44"},&H00F6F3EB,&H00F6F3EB,&H00170F0B,&H00170F0B,0,0,0,0,100,100,0,0,${layout === "documentary" ? "1,2,0" : layout === "story" ? "1,3,1" : "3,14,0"},5,84,${layout !== "card" ? "156" : "84"},0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
` +
    cues
      .map(
        (c) =>
          `Dialogue: 0,${timestamp(c.start)},${timestamp(c.end)},Desk,,0,0,0,,{\\pos(${layout !== "card" ? "504,1490" : "540,210"})}${c.lines.map(literal).join("\\N")}`
      )
      .join("\n") +
    "\n"
  );
}
