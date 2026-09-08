import { createHash } from "node:crypto";
import { articleIdentity } from "../../scripts/ingest/lib/dedupe";
import type { FetchedItem } from "../../scripts/ingest/lib/rss";
import { evidenceRegions, evidenceTopics } from "../../shared/propertyCoverage";
import { looksLikeGarbage, looksLikeSiteBoilerplate } from "../../shared/headline";

/** Public feed excerpts only. Never infer a publication date from collection time. */
export function normaliseEvidence(item: FetchedItem, now = new Date()) {
  const text = `${item.title} ${item.summary}`;
  const topics = evidenceTopics(text);
  if (!topics.length || looksLikeGarbage(text) || looksLikeSiteBoilerplate(text)) return null;
  const publishedAt = new Date(item.isoDate ?? "");
  if (
    !Number.isFinite(publishedAt.getTime()) ||
    publishedAt > now ||
    now.getTime() - publishedAt.getTime() > 180 * 86_400_000
  )
    return null;
  let url: URL;
  try {
    url = new URL(item.url ?? "");
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  const identity = articleIdentity(item);
  return {
    identity: createHash("sha256").update(identity).digest("hex"),
    title: item.title.slice(0, 480),
    summary: item.summary.slice(0, 480),
    source: item.source.slice(0, 120),
    sourceUrl: identity.slice(4),
    publishedAt,
    regions: evidenceRegions(text),
    topics,
    lastSeenAt: now,
  };
}
