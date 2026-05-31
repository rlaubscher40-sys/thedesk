/**
 * Zod schemas for every JSON column on `editions` and every external payload
 * the scheduled ingestion endpoints accept. The inferred TypeScript types are
 * re-exported so tRPC inputs, the database layer and the React UI all share a
 * single source of truth.
 *
 * Anything else that needs to validate or type-check edition JSON should import
 * from here, never re-declare these shapes.
 */
import { z } from "zod";
import { CATEGORIES, PARTNER_PERSONAS } from "./const";

// ─── Edition topics ─────────────────────────────────────────────────────────

/**
 * Topic categories. We accept anything (legacy editions may carry obscure
 * categories) but normalise to upper case so downstream code can group
 * reliably. The well-known categories live in shared/const.ts as `CATEGORIES`.
 */
const categorySchema = z
  .string()
  .min(1)
  .max(64)
  .transform((c) => c.toUpperCase());

/**
 * Talking points keyed by partner type. The keys are free-form (different
 * editions use different shorthands like "Brokers" vs "Mortgage Brokers"), so
 * we validate the *shape* but not the keys themselves.
 */
export const talkingPointsSchema = z.record(z.string(), z.string());
export type TalkingPoints = z.infer<typeof talkingPointsSchema>;

export const editionTopicSchema = z.object({
  title: z.string().min(1),
  /** 2-3 sentence lead. */
  summary: z.string().min(1),
  category: categorySchema,
  partnerRelevance: z.array(z.string()).optional(),
  /** 300-600 word deep-dive body. */
  body: z.string().optional(),
  /** One-sentence takeaway, the line Ruben repeats verbatim to a client. */
  keyTakeaway: z.string().optional(),
  /**
   * One explicit sentence answering "why does the partner channel care
   * about this specifically, right now". Forced by the synthesis rubric
   * so the audience focus is auditable. Rendered as its own block.
   */
  whyItMatters: z.string().optional(),
  /** 2-3 forward-looking watch items. */
  whatToWatch: z.array(z.string()).optional(),
  talkingPoints: talkingPointsSchema.optional(),
});
export type EditionTopic = z.infer<typeof editionTopicSchema>;

// ─── Edition metrics ────────────────────────────────────────────────────────

/**
 * `keyMetrics` is a free-form object so editions can ship whatever the week
 * needs (cash rate, AUD/USD, ASX200…). We allow strings and numbers but not
 * nested objects, keep things flat so the UI can render them in one strip.
 */
export const keyMetricsSchema = z.record(z.string(), z.union([z.string(), z.number()]));
export type KeyMetrics = z.infer<typeof keyMetricsSchema>;

export const signalsSchema = z.array(z.string().min(1));
export type Signals = z.infer<typeof signalsSchema>;

// ─── Partner tag (4-persona block on a daily feed item) ─────────────────────

/**
 * The partnerTag column stores a 4-line string with one line per persona,
 * formatted as "PersonaLabel: one-sentence angle". The labels stored are not
 * identical to the runtime persona names (the LLM uses Institutional / Broker
 * / Adviser / Buyers Agent), so parsing is lenient.
 */
export const PARTNER_TAG_LABELS = ["Institutional", "Broker", "Adviser", "Buyers Agent"] as const;
export type PartnerTagLabel = (typeof PARTNER_TAG_LABELS)[number];

export type PartnerTag = Record<PartnerTagLabel, string>;

/**
 * Parse a raw partnerTag string into a typed record. Returns null if the
 * required labels are not all present so callers can fall back to the legacy
 * single-persona display.
 */
export function parsePartnerTag(raw: string | null | undefined): PartnerTag | null {
  if (!raw) return null;
  const result: Partial<PartnerTag> = {};
  for (const label of PARTNER_TAG_LABELS) {
    const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im");
    const m = raw.match(re);
    if (m && m[1]) result[label] = m[1].trim();
  }
  if (PARTNER_TAG_LABELS.every((l) => result[l])) return result as PartnerTag;
  return null;
}

// ─── Daily feed ingestion ───────────────────────────────────────────────────

export const dailyFeedIngestItemSchema = z.object({
  feedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "feedDate must be YYYY-MM-DD"),
  title: z.string().min(1).max(512),
  source: z.string().min(1).max(256),
  sourceUrl: z.string().url().optional().nullable(),
  summary: z.string().min(1),
  category: z.string().min(1).max(64).transform((c) => c.toUpperCase()),
  partnerTag: z.string().optional().nullable(),
  sayThis: z.string().optional().nullable(),
  whyItMatters: z.string().optional().nullable(),
  /** Optional preset thumbnail. If absent, background enrichment generates one. */
  imageUrl: z.string().url().optional().nullable(),
});
export type DailyFeedIngestItem = z.infer<typeof dailyFeedIngestItemSchema>;

export const dailyFeedIngestBodySchema = z.object({
  items: z.array(dailyFeedIngestItemSchema).min(1),
});

// ─── Weekly edition ingestion ───────────────────────────────────────────────

export const weeklyEditionIngestSchema = z.object({
  editionNumber: z.number().int().positive(),
  weekOf: z.string().min(1).max(64),
  weekRange: z.string().min(1).max(128),
  pdfUrl: z.string().optional().nullable(),
  readingTime: z.string().max(32).optional().nullable(),
  topics: z.array(editionTopicSchema).min(1),
  signals: signalsSchema.min(1),
  fullText: z.string().optional().nullable(),
  keyMetrics: keyMetricsSchema.optional().nullable(),
});
export type WeeklyEditionIngest = z.infer<typeof weeklyEditionIngestSchema>;

// ─── LLM-generated Substack draft ───────────────────────────────────────────

export const substackDraftSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  body: z.string().min(1),
});
export type SubstackDraft = z.infer<typeof substackDraftSchema>;

// ─── Re-exports for convenience ─────────────────────────────────────────────

export { PARTNER_PERSONAS };
