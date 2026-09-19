import { z } from "zod";

export type DeliveryMode = "briefing" | "documentary";
export type DirectedSpeechLine = {
  key: string;
  text: string;
  /** Zero-based whitespace-token indexes. Direction is never sent to TTS. */
  protectPauseAfterWords?: number[];
};

/** Editorial audition ranges, not hard duration targets. Never time-stretch a read. */
const DELIVERY_PROFILES = {
  briefing: { id: "newsreader-v2-briefing", targetWpm: [165, 180], protectedGap: 0.45 },
  documentary: { id: "newsreader-v2-documentary", targetWpm: [150, 170], protectedGap: 0.6 },
} as const;

export function deliveryProfile(mode: DeliveryMode) {
  if (!Object.hasOwn(DELIVERY_PROFILES, mode)) throw new Error("Invalid narration delivery mode.");
  return DELIVERY_PROFILES[mode];
}

const sentenceEnd = /[.!?][”"')]*$/u;
const punctuation = /[.,;:!?][”"')]*$/u;
const figure =
  /\d|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|percent|percentage|dollars)\b/i;
const contrast = /^(?:but|yet|however|instead|despite|nevertheless)\b/i;

/** Conservative editorial heuristics, not an assertion that a model understood the story.
 * Protect complete numerical thoughts, explicit direction, contrasts and the final passage.
 * Ordinary scene changes do not automatically earn another pause. */
export function deliveryBoundaries(lines: DirectedSpeechLine[]) {
  const tokens = lines.flatMap((line) => line.text.trim().split(/\s+/));
  const reasons = new Map<number, string>();
  let offset = 0;
  for (const line of lines) {
    const words = line.text.trim().split(/\s+/);
    const marked = line.protectPauseAfterWords;
    if (
      marked !== undefined &&
      (!Array.isArray(marked) ||
        marked.some(
          (i) => !Number.isInteger(i) || i < 0 || i >= words.length || !punctuation.test(words[i]!)
        ))
    )
      throw new Error("Invalid protected narration boundary.");
    for (const i of marked ?? []) reasons.set(offset + i, "directed");
    offset += words.length;
  }
  const finalStart = tokens.length - (lines.at(-1)?.text.trim().split(/\s+/).length ?? 0);
  let thought: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const word = tokens[i]!;
    thought.push(word);
    if (!punctuation.test(word)) continue;
    if (!reasons.has(i)) {
      if (contrast.test(tokens[i + 1]!)) reasons.set(i, "contrast");
      else if (sentenceEnd.test(word) && figure.test(thought.join(" "))) reasons.set(i, "figure");
      else if (i + 1 === finalStart) reasons.set(i, "takeaway");
    }
    if (sentenceEnd.test(word)) thought = [];
  }
  return { tokens, reasons };
}

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const deliveryReviewSchema = z.object({
  profile: z.enum(["newsreader-v2-briefing", "newsreader-v2-documentary"]),
  /** Present only when the provider actually made the request, not inferred for offline PCM. */
  synthesis: z
    .object({
      model: z.literal("eleven_multilingual_v2"),
      voice: z.string().min(1),
      speed: z.number().finite().min(0.9).max(1.1),
      stability: z.literal(0.5),
      similarity_boost: z.literal(0.75),
      style: z.literal(0),
      use_speaker_boost: z.literal(true),
    })
    .optional(),
  scriptSha256: hash,
  sourcePcmSha256: hash,
  editedPcmSha256: hash,
  seconds: z.number().finite().positive().max(180),
  scriptWordsPerMinute: z.number().finite().nonnegative(),
  wordCountBasis: z.literal("whitespace-script-tokens; numerals may expand when spoken"),
  targetWpm: z.tuple([z.number(), z.number()]),
  removedSeconds: z.number().finite().nonnegative(),
  boundaries: z
    .array(
      z.object({
        afterWord: z.number().int().nonnegative(),
        reason: z.enum(["directed", "contrast", "figure", "takeaway"]),
        beforeSeconds: z.number().finite().nonnegative(),
        afterSeconds: z.number().finite().nonnegative(),
      })
    )
    .max(8000),
  cuts: z
    .array(
      z.object({
        fromSample: z.number().int().nonnegative(),
        toSample: z.number().int().positive(),
      })
    )
    .max(8000),
  passages: z
    .array(
      z.object({
        key: z.string(),
        words: z.number().int().positive(),
        seconds: z.number().finite().positive(),
        scriptWordsPerMinute: z.number().finite().nonnegative(),
        flags: z.array(z.enum(["fast", "slow", "long-gap", "numeric-token-count"])),
      })
    )
    .max(16),
});
export type DeliveryReview = z.infer<typeof deliveryReviewSchema>;
