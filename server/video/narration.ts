/**
 * The voice track.
 *
 * The first Reel was silent, on the argument that feed video is watched muted.
 * That argument loses to the evidence: the competitor's Reels are narrated and
 * they hold attention that ours does not. A silent card with a slow push is a
 * poster; a narrated one is a broadcast. So this builds a script and speaks it.
 *
 * ## The script is not written by a model
 *
 * Everything spoken here already exists, already computed and already checked:
 * the metric's name, the figure from the series, the sentence `generateStatLine`
 * produced and verified against the source facts, and the claim
 * `pickStatOfTheDay` derived from the history. This module rearranges that into
 * speech and changes nothing else. No new sentence is generated for audio,
 * because a voice saying a number is exactly as falsifiable as a card showing
 * one, and the whole position of the publication is that the numbers are real.
 *
 * What *is* generated is the audio, and only the audio.
 *
 * ## Written for the ear, not the eye
 *
 * Two transformations stand between the card's text and something worth
 * hearing. `speakValue` turns "$815,439" and "4.3%" into words a reader would
 * actually say, and `deshout` undoes the card's typographic uppercase, which a
 * speech model otherwise reads as either shouting or a string of letters — but
 * leaves ABS and RBA alone, because those genuinely are letters.
 */
import { env } from "../core/env";

/** OpenAI's speech model. `gpt-4o-mini-tts` is the one that takes a delivery
 *  instruction, which is what keeps this from sounding like a lift announcement. */
const TTS_MODEL = "gpt-4o-mini-tts";

/** A measured male read. Overridable without a deploy, because the right voice
 *  for a publication is a judgement nobody should have to edit code to change. */
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "onyx";

/** How the line should be delivered. The model follows this closely, and
 *  without it the default read is too bright for a numbers publication. */
const TTS_INSTRUCTIONS =
  "Read as a calm, measured Australian financial news presenter. " +
  "Unhurried and level, with the authority of someone reading a figure they " +
  "have checked. Land the numbers clearly. No excitement, no upward inflection " +
  "at the end of sentences.";

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
 * The whole script, in order, each passage keyed to the beat it plays over.
 *
 * Nothing is invented and nothing is paraphrased: `label`, `value`, `line` and
 * `subtext` are the card's own strings, only respelled for the ear.
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

/**
 * Speak one passage, returning MP3 bytes.
 *
 * Returns null rather than throwing on every failure path — no key, a bad
 * response, a network fault. A Reel that goes out silent is a worse Reel; a
 * scheduled post that throws is no post at all, and the pictures are the part
 * that carries the facts.
 */
export async function synthesise(text: string): Promise<Buffer | null> {
  if (!env.openAiApiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: text,
        instructions: TTS_INSTRUCTIONS,
        response_format: "mp3",
        speed: 0.98,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[reel] tts failed ${res.status}: ${detail.slice(0, 300)}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn("[reel] tts error:", (err as Error).message);
    return null;
  }
}

/**
 * Speak the whole script.
 *
 * All or nothing: if any passage fails to synthesise, the clip goes out silent
 * rather than half-narrated. A voice that stops in the middle of a sentence
 * reads as broken software, which is worse than a poster.
 */
export async function synthesiseScript(
  lines: ScriptLine[]
): Promise<Array<{ key: string; bytes: Buffer }> | null> {
  const out: Array<{ key: string; bytes: Buffer }> = [];
  for (const line of lines) {
    const bytes = await synthesise(line.text);
    if (!bytes) return null;
    out.push({ key: line.key, bytes });
  }
  return out;
}
