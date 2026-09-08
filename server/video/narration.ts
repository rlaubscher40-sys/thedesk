/** Deterministic, evidence-backed scripts spoken locally. No paid speech API. */
import { localSpeech } from "./localVoice";
import type { ReelScriptLines } from "../prompts/reelScript";

/** Acronyms that must survive de-shouting as acronyms: spoken as letters, not
 *  read as words. "ABS" said as "abs" is the tell of a machine reading a card. */
const ACRONYMS = new Set([
  "ABS",
  "RBA",
  "APRA",
  "ATO",
  "CPI",
  "GDP",
  "WPI",
  "CoreLogic".toUpperCase(),
  "NSW",
  "VIC",
  "QLD",
  "WA",
  "SA",
  "TAS",
  "NT",
  "ACT",
  "AU",
  "USA",
  "GST",
  "LVR",
  "YOY",
]);

/**
 * Undo the card's uppercase so a speech model reads prose rather than shouting.
 *
 * The claim line is set in uppercase mono because that is what makes it read as
 * evidence on the card. Spoken, uppercase is a different instruction entirely,
 * so it comes back down to sentence case — except for the acronyms, which were
 * uppercase before the card touched them.
 *
 * The middle dot the card uses as a separator becomes a full stop, which is the
 * pause a reader would take there anyway.
 */
export function deshout(text: string): string {
  const withStops = text.replace(/\s*[·|]\s*/g, ". ");
  const shouting = withStops === withStops.toUpperCase() && /[A-Z]{3}/.test(withStops);
  if (!shouting) return withStops;
  let first = true;
  return withStops.replace(/[A-Za-z][A-Za-z']*/g, (word) => {
    if (ACRONYMS.has(word.toUpperCase())) {
      first = false;
      return word.toUpperCase();
    }
    const lower = word.toLowerCase();
    const out = first ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    first = false;
    return out;
  });
}

/**
 * Turn a displayed figure into the words someone would say.
 *
 * Speech models mostly handle "4.3%" and "$815,439", but they are inconsistent
 * about scale suffixes and about where the currency lands in the sentence —
 * "dollar eight hundred fifteen thousand" happens. Spelling it out removes the
 * inconsistency, which matters more here than elsewhere: the figure is the one
 * thing in the clip that cannot be got wrong.
 */
export function speakValue(value: string): string {
  let out = value.trim();
  const isDollars = out.startsWith("$");
  if (isDollars) out = out.slice(1);

  out = out
    .replace(/(\d)\s*bps\b/gi, "$1 basis points")
    .replace(/(\d)\s*pp\b/gi, "$1 percentage points")
    .replace(/(\d)\s*%/g, "$1 per cent")
    .replace(/(\d)\s*bn\b/gi, "$1 billion")
    .replace(/(\d)\s*m\b/g, "$1 million")
    .replace(/(\d)\s*k\b/gi, "$1 thousand");

  // A leading minus is a word, not a dash the model may skip over.
  out = out.replace(/^[-−]\s*/, "minus ");

  if (isDollars) {
    // "815,439 dollars", not "dollars 815,439". The suffix goes after the
    // magnitude word when there is one: "1.2 million dollars".
    out = `${out} dollars`;
  }
  return out.replace(/\s+/g, " ").trim();
}

export type ReelStatText = {
  label: string;
  value: string;
  line: string;
  subtext: string;
  source?: string | null;
};

/** One spoken passage, and the moment in the clip it belongs to. */
export type ScriptLine = { key: string; text: string };

/**
 * The closing line. The point of the Reel is not the number; it is that there
 * is another one. This is the only sentence in the clip that is not derived
 * from the data, and it makes no claim about it — not even about how often,
 * because the posting schedule is not a promise anybody has made.
 *
 * Short on purpose. Every word is a word of dead air over a frame that has
 * stopped changing: the first version ran five words longer and held a static
 * card for nearly six seconds at the end of the clip.
 */
export const REEL_SIGN_OFF = "The Desk. Follow for the next number.";

/**
 * The deterministic read: the card's own strings, only respelled for the ear.
 *
 * This is the fallback now rather than the main path. It is never wrong and
 * never interesting, which is the right thing to be when the alternative is a
 * script nobody verified — but a voice that recites what is already on screen
 * adds nothing, so `generateReelScript` writes the real one and this covers the
 * cases where it cannot: no key, a bad response, a fabricated figure.
 *
 * It has no passage for the supporting figures. Reading a list of numbers aloud
 * without explaining them is worse than letting them land in silence, and
 * explaining them is exactly the job that needs a model.
 */
export function buildScript(stat: ReelStatText): ScriptLine[] {
  const lines: ScriptLine[] = [
    { key: "label", text: `${deshout(stat.label).replace(/\.?$/, ".")}` },
    { key: "value", text: `${speakValue(stat.value)}.` },
  ];
  if (stat.line.trim()) lines.push({ key: "line", text: stat.line.trim() });
  if (stat.subtext.trim()) lines.push({ key: "claim", text: deshout(stat.subtext.trim()) });
  lines.push({ key: "signOff", text: REEL_SIGN_OFF });
  return lines;
}

/**
 * Lay a generated script onto the beats.
 *
 * The keys have to match the section keys in `composeSections`, because that is
 * what anchors each passage to the moment its pictures arrive. A passage whose
 * section will not exist — the claim on a metric with no computed claim, the
 * detail on a card with no supporting figures — is dropped here rather than
 * synthesised and thrown away, which would be a wasted API call per Reel.
 */
export function scriptFromLines(
  lines: ReelScriptLines,
  present: { line: boolean; claim: boolean; facts: boolean }
): ScriptLine[] {
  const script: ScriptLine[] = [
    { key: "label", text: lines.open },
    { key: "value", text: lines.number },
  ];
  if (present.line) script.push({ key: "line", text: lines.meaning });
  if (present.claim) script.push({ key: "claim", text: lines.context });
  if (present.facts) script.push({ key: "facts", text: lines.detail });
  script.push({ key: "signOff", text: REEL_SIGN_OFF });
  return script;
}

/**
 * How long a passage takes to say, when we cannot ask.
 *
 * Used only as a fallback: normally each clip is measured after synthesis, so
 * the pictures are cut to the actual voice. But the beats have to be laid out
 * even when there is no API key — the clip still has to render, silently — and
 * a layout paced like speech is much closer to right than the old fixed table.
 *
 * 2.6 words a second is a news-read pace; the constant is the breath at the end.
 */
export function estimateSpeechSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return words / 2.6 + 0.35;
}

/** Local WAV audio. Failure is explicit; publishing never falls back to silence. */
export async function synthesise(text: string): Promise<Buffer | null> {
  try {
    return (await localSpeech([{ key: "line", text }]))[0]!.bytes;
  } catch {
    return null;
  }
}

export async function synthesiseScript(
  lines: ScriptLine[]
): Promise<Array<{ key: string; bytes: Buffer }> | null> {
  try {
    return await localSpeech(lines);
  } catch {
    return null;
  }
}
