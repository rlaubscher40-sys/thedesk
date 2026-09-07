import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { comparisonSnapshotSchema, type MarketComparison } from "../../shared/marketComparison";
import { signingSecret } from "./env";

export type SharedIntelligenceSource = {
  title: string;
  date: string;
  publisher: string | null;
  href: string;
};

export type SharedIntelligenceBrief = {
  comparison?: MarketComparison;
  question: string;
  headline: string;
  answer: string;
  deskTake: string;
  confidence: "high" | "medium" | "low";
  sourceCount: number;
  sources: SharedIntelligenceSource[];
  signal: { label: string; value: string; context: string } | null;
};

type Envelope = SharedIntelligenceBrief & {
  version: 2;
  createdAt: number;
  expiresAt: number;
};

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TOKEN_CHARS = 16_000;
const MAX_INFLATED_BYTES = 48_000;

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

function safeSignatureEqual(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, "base64url");
    const b = Buffer.from(right, "base64url");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function validSource(value: unknown): value is SharedIntelligenceSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<SharedIntelligenceSource>;
  return (
    typeof source.title === "string" &&
    typeof source.date === "string" &&
    (typeof source.publisher === "string" || source.publisher === null) &&
    typeof source.href === "string" &&
    source.href.startsWith("/")
  );
}

/**
 * Create a compact, tamper-evident public-share token from a brief that has
 * already passed Ask The Desk's retrieval + source-validation path. Callers
 * should never build this from arbitrary browser-provided prose.
 */
export function createIntelligenceShareToken(
  brief: SharedIntelligenceBrief,
  now = Date.now()
): string {
  const envelope: Envelope = {
    ...brief,
    sourceCount: brief.sources.length,
    sources: brief.sources.slice(0, 8),
    version: 2,
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  };
  const compressed = deflateRawSync(Buffer.from(JSON.stringify(envelope), "utf8"), {
    level: 9,
  }).toString("base64url");
  return `${compressed}.${sign(compressed)}`;
}

/** Verify signature, expiry and the complete frozen evidence snapshot. */
export function readIntelligenceShareToken(
  token: string,
  now = Date.now()
): SharedIntelligenceBrief | null {
  if (!token || token.length > MAX_TOKEN_CHARS) return null;
  const split = token.lastIndexOf(".");
  if (split <= 0 || split === token.length - 1) return null;
  const payload = token.slice(0, split);
  const signature = token.slice(split + 1);
  if (!safeSignatureEqual(signature, sign(payload))) return null;

  try {
    const inflated = inflateRawSync(Buffer.from(payload, "base64url"), {
      maxOutputLength: MAX_INFLATED_BYTES,
    });
    const parsed = JSON.parse(inflated.toString("utf8")) as Partial<Envelope>;
    if (
      parsed.version !== 2 ||
      typeof parsed.createdAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt < now ||
      typeof parsed.question !== "string" ||
      typeof parsed.headline !== "string" ||
      typeof parsed.answer !== "string" ||
      typeof parsed.deskTake !== "string" ||
      (parsed.confidence !== "high" &&
        parsed.confidence !== "medium" &&
        parsed.confidence !== "low") ||
      !Array.isArray(parsed.sources) ||
      parsed.sources.length < 1 ||
      parsed.sources.length > 8 ||
      !parsed.sources.every(validSource)
    ) {
      return null;
    }

    const signal = parsed.signal;
    if (
      signal != null &&
      (typeof signal !== "object" ||
        typeof signal.label !== "string" ||
        typeof signal.value !== "string" ||
        typeof signal.context !== "string")
    ) {
      return null;
    }

    const comparison =
      parsed.comparison == null ? null : comparisonSnapshotSchema.safeParse(parsed.comparison);
    if (comparison && !comparison.success) return null;
    const sources = parsed.sources.slice(0, 8);
    return {
      question: parsed.question,
      headline: parsed.headline,
      answer: parsed.answer,
      deskTake: parsed.deskTake,
      confidence: parsed.confidence,
      sourceCount: sources.length,
      sources,
      signal: signal ?? null,
      ...(comparison?.success ? { comparison: comparison.data } : {}),
    };
  } catch {
    return null;
  }
}
