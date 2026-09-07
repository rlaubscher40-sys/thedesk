import { createHash } from "node:crypto";
import type { Request } from "express";

const ANONYMOUS_ASK_LIMIT = 3;
const ANONYMOUS_CARD_LIMIT = 8;

type Bucket = { day: string; count: number };
const buckets = new Map<string, Bucket>();

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * We need a stable per-client key for anonymous LLM cost control, but there is
 * no reason to retain a raw IP address. Express already trusts Railway's first
 * proxy hop, so req.ip is the canonical client address. Hash it with the day
 * and namespace; yesterday's key cannot be linked to today's from this map.
 */
function anonymousKey(req: Request, namespace: string, day: string): string {
  return createHash("sha256")
    .update(`${namespace}:${day}:${req.ip || "unknown"}`)
    .digest("hex");
}

function cleanup(currentDay: string): void {
  // Normally only a handful of buckets exist. Bound memory if the public page
  // gets crawled aggressively, and discard all stale-day entries while here.
  if (buckets.size < 2_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.day !== currentDay) buckets.delete(key);
  }
  if (buckets.size <= 5_000) return;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (buckets.size <= 4_000) break;
  }
}

export type QuotaResult = { allowed: boolean; remaining: number; limit: number };

function consume(req: Request, namespace: string, limit: number): QuotaResult {
  const day = utcDay();
  cleanup(day);
  const key = anonymousKey(req, namespace, day);
  const current = buckets.get(key);
  const count = current?.day === day ? current.count : 0;

  if (count >= limit) return { allowed: false, remaining: 0, limit };
  const next = count + 1;
  buckets.set(key, { day, count: next });
  return { allowed: true, remaining: Math.max(0, limit - next), limit };
}

export function consumeAnonymousAsk(req: Request): QuotaResult {
  return consume(req, "ask", ANONYMOUS_ASK_LIMIT);
}

export function consumeAnonymousCard(req: Request): QuotaResult {
  return consume(req, "ask-card", ANONYMOUS_CARD_LIMIT);
}

/** Test-only reset. Kept explicit rather than exporting the backing map. */
export function resetAskQuotaForTests(): void {
  buckets.clear();
}
