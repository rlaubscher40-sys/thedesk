import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { signingSecret } from "./env";

export type SharedIntelligenceBrief = {
  question: string;
  headline: string;
  answer: string;
  deskTake: string;
  confidence: "high" | "medium" | "low";
  sourceCount: number;
  signal: { label: string; value: string; context: string } | null;
};

type Envelope = SharedIntelligenceBrief & {
  version: 1;
  createdAt: number;
  expiresAt: number;
};

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TOKEN_CHARS = 12_000;
const MAX_INFLATED_BYTES = 12_000;

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

/**
 * Create a compact, tamper-evident public-share token without introducing a
 * persistence table. The payload is compressed before HMAC signing so normal
 * Ask answers stay within shareable URL lengths. Tokens expire after 30 days.
 */
export function createIntelligenceShareToken(
  brief: SharedIntelligenceBrief,
  now = Date.now()
): string {
  const envelope: Envelope = {
    ...brief,
    version: 1,
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  };
  const compressed = deflateRawSync(Buffer.from(JSON.stringify(envelope), "utf8"), {
    level: 9,
  }).toString("base64url");
  return `${compressed}.${sign(compressed)}`;
}

/** Verify signature, expiry and basic envelope shape before returning a brief. */
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
      parsed.version !== 1 ||
      typeof parsed.createdAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt < now ||
      typeof parsed.question !== "string" ||
      typeof parsed.headline !== "string" ||
      typeof parsed.answer !== "string" ||
      typeof parsed.deskTake !== "string" ||
      (parsed.confidence !== "high" && parsed.confidence !== "medium" && parsed.confidence !== "low") ||
      typeof parsed.sourceCount !== "number"
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

    return {
      question: parsed.question,
      headline: parsed.headline,
      answer: parsed.answer,
      deskTake: parsed.deskTake,
      confidence: parsed.confidence,
      sourceCount: Math.max(1, Math.min(20, Math.trunc(parsed.sourceCount))),
      signal: signal ?? null,
    };
  } catch {
    return null;
  }
}
