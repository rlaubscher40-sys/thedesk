import type { AskContextSource } from "../prompts/ask";
import { normaliseAskText, rankAskRecords } from "./relevance";

export const ASK_SOURCE_LIMIT = 8;
const COUNTS = ["one", "two", "three", "four", "five", "six", "seven", "eight"];

/** Explicit source-count requests only; dates and bedroom counts are not limits. */
export function requestedSourceLimit(question: string): number {
  const pattern =
    /\b(?:at most|up to|no more than|only|maximum(?: of)?|use|cite)\s+(\d+|one|two|three|four|five|six|seven|eight)\s+(?:(?:dated|cited|verified|official|reliable|distinct)\s+){0,2}(?:sources?|citations?|references?)\b/gi;
  const limits = [...question.matchAll(pattern)]
    .map((match) => {
      const value = match[1]!.toLowerCase();
      return /^\d+$/.test(value) ? Number(value) : COUNTS.indexOf(value) + 1;
    })
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  return Math.min(ASK_SOURCE_LIMIT, ...limits);
}

/** Preserve exact local observations and an explicitly named metric, then
 * fill from relevant reporting. Original refs remain stable through selection.
 * Refuse a limit that would silently drop part of a local comparison.
 */
export function packAskEvidence(question: string, sources: AskContextSource[], limit: number) {
  const local = sources.filter((source) => source.category === "LOCAL DATA");
  if (local.length > limit) return null;
  const primary = sources.find((source) => {
    const label = normaliseAskText(source.title.split(":")[0]!);
    return (
      source.kind === "metric" &&
      source.category !== "LOCAL DATA" &&
      label.length > 0 &&
      ` ${normaliseAskText(question)} `.includes(` ${label} `)
    );
  });
  const chosen = [...local];
  if (primary && chosen.length < limit) chosen.push(primary);
  const selected = new Set(chosen.map((source) => source.ref));
  // A question about a named, dated/numbered observation must not use our own
  // editorial interpretation as independent evidence of market conditions.
  const readingObservation = Boolean(primary && /\d/.test(question));
  const remaining = rankAskRecords(
    question,
    sources.filter(
      (source) => !selected.has(source.ref) && (!readingObservation || source.kind === "metric")
    ),
    {
      title: (source) => source.title,
      body: (source) => source.text,
      date: (source) => source.date,
    },
    limit - chosen.length
  );
  return [...chosen, ...remaining];
}

/** Number only after selection, keeping each citation joined to its metadata. */
export function numberAskEvidence<T extends { ref: number }>(
  sources: AskContextSource[],
  metadata: T[]
) {
  return sources.map((source, index) => {
    const original = metadata.find((item) => item.ref === source.ref);
    if (!original) throw new Error("Missing evidence metadata");
    return { source: { ...source, ref: index + 1 }, metadata: { ...original, ref: index + 1 } };
  });
}

/** Repeated references carry no extra evidence. Never discard an unknown ref
 * or trim distinct references to make an invalid answer appear valid.
 */
export function deduplicateAnswerRefs(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || !("sourceRefs" in raw)) return raw;
  if (!Array.isArray(raw.sourceRefs) || raw.sourceRefs.length > 64) return raw;
  return { ...raw, sourceRefs: [...new Set(raw.sourceRefs)] };
}

export function validateAnswerRefs(
  answer: {
    sourceRefs: number[];
    headline: string;
    answer: string;
    whyItMatters: string;
    deskTake: string;
    whatWouldChangeOurMind: string;
    signals: Array<{ label: string; value: string; context: string }>;
  },
  evidence: AskContextSource[],
  limit: number
) {
  const allowed = new Set(evidence.map((source) => source.ref));
  const declared = new Set(answer.sourceRefs);
  if (!declared.size || declared.size > limit || [...declared].some((ref) => !allowed.has(ref)))
    throw new Error("Answer references do not match the bounded evidence");
  const prose = [
    answer.headline,
    answer.answer,
    answer.whyItMatters,
    answer.deskTake,
    answer.whatWouldChangeOurMind,
    ...answer.signals.flatMap((item) => [item.label, item.value, item.context]),
  ].join("\n");
  for (const match of prose.matchAll(/(?:\bsource\s+(\d+)\b|\[(\d+)\])/gi)) {
    if (!declared.has(Number(match[1] ?? match[2])))
      throw new Error("Inline citation is absent from the declared sources");
  }
}
