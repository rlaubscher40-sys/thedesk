import { titleTokens, titlesMatch } from "./textSimilarity";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  conflictingEvents,
  numericClaims,
  originalPublicationDay,
  type EventStory,
} from "./storyEvent";

export const evidenceFingerprintSchema = z.object({
  version: z.literal(1),
  day: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),
  sourceTitle: z.string().max(512),
  hashes: z
    .array(z.string().regex(/^[a-f0-9]{16}$/))
    .min(80)
    .max(1000),
  numbers: z.array(z.string().max(32)).max(1000),
});
export type EvidenceFingerprint = z.infer<typeof evidenceFingerprintSchema>;
export type EvidenceStory = EventStory & {
  id?: number;
  articleText?: string | null;
  evidenceFingerprint?: EvidenceFingerprint | null;
};
export function fingerprintStory(story: EvidenceStory): EvidenceFingerprint | null {
  const day = originalPublicationDay(story);
  const body = story.articleText?.slice(0, 6000) ?? "";
  if (!day || body.length < 650) return null;
  const words = body
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 1007);
  const hashes = [
    ...new Set(
      words.slice(0, -7).map((_, i) =>
        createHash("sha256")
          .update(words.slice(i, i + 8).join(" "))
          .digest("hex")
          .slice(0, 16)
      )
    ),
  ];
  const parsed = evidenceFingerprintSchema.safeParse({
    version: 1,
    day,
    sourceTitle: story.title,
    hashes,
    numbers: [...numericClaims(body)],
  });
  return parsed.success ? parsed.data : null;
}
function prepare(story: EvidenceStory) {
  const day = originalPublicationDay(story);
  const parsed = evidenceFingerprintSchema.safeParse(
    story.evidenceFingerprint ?? fingerprintStory(story)
  );
  if (!parsed.success || parsed.data.day !== day || parsed.data.sourceTitle !== story.title)
    return null;
  return {
    story,
    day,
    shingles: new Set(parsed.data.hashes),
    tokens: titleTokens(story.title),
    numbers: new Set(parsed.data.numbers),
  };
}
/** Unchanged normalised evidence only, with original dates and numeric
 * claims. Do not suppress rewritten reporting, a new release day, added data,
 * or a short common quote. No generated summary/angle enters this comparison. */
export function createEvidenceDuplicateIndex(initial: EvidenceStory[] = []) {
  const entries: NonNullable<ReturnType<typeof prepare>>[] = [];
  const add = (story: EvidenceStory) => {
    if (entries.length >= 500) return;
    const entry = prepare(story);
    if (entry) entries.push(entry);
  };
  initial.slice(0, 500).forEach(add);
  return {
    add,
    find(story: EvidenceStory): EvidenceStory | null {
      const next = prepare(story);
      if (!next) return null;
      for (const prior of entries) {
        if (
          prior.story.channel !== story.channel &&
          ![prior.story.channel, story.channel].every((channel) =>
            ["AU", "PROPERTY"].includes(channel ?? "")
          )
        )
          continue;
        if (prior.day !== next.day || conflictingEvents(prior.story, story)) continue;
        if (!titlesMatch(prior.tokens, next.tokens, 4, 0.4)) continue;
        if (
          prior.numbers.size !== next.numbers.size ||
          [...next.numbers].some((n) => !prior.numbers.has(n))
        )
          continue;
        let shared = 0;
        for (const shingle of next.shingles) if (prior.shingles.has(shingle)) shared++;
        if (shared >= 80 && shared === prior.shingles.size && shared === next.shingles.size)
          return prior.story;
      }
      return null;
    },
  };
}
