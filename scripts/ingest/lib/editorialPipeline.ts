import { randomUUID } from "node:crypto";
import {
  assessStory,
  discoveryScore,
  EDITORIAL_VERSION,
  referenceNewsHold,
  type EditorialReport,
} from "../../../shared/editorial";
import { newsTimestamp, recentNewsTimestamp } from "../../../shared/propertyNewsQuality";
import type { SourceTiming } from "../../../shared/sourceTiming";
import { FEED_CHANNELS } from "../../../shared/const";
import { SOURCES, CHANNEL_TARGETS, type Source } from "../sources";
import { STATE_PROPERTY_SOURCES } from "../propertySources";
import { fetchSourceReport, type FetchedItem, type SourceReport } from "./rss";
import { fetchArticle, type FetchedArticle } from "./article";
import { resolveArticleUrl } from "./gnews";
import { articleIdentity } from "./dedupe";
import { clusterByTitle } from "./cluster";

async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) break;
        results[i] = await fn(items[i]!);
      }
    })
  );
  return results;
}
export type PreparedStory = FetchedItem & {
  articleText: string;
  sourceTiming: SourceTiming;
  score: number;
  beat: string | null;
};
export type PipelineOptions = {
  sources?: Source[];
  extraCandidates?: FetchedItem[];
  recentUrls?: string[];
  now?: Date;
  readSource?: (source: Source) => Promise<SourceReport>;
  readArticle?: (url: string) => Promise<FetchedArticle>;
  resolve?: (url: string | null) => Promise<string | null>;
};

/** Give each discovered publisher a small reading opportunity before taking
 * extra articles from the highest-scoring feeds. Index bonuses must not let
 * a few publishers exhaust the budget before specialist reporting is read. */
export function readingBudget(items: FetchedItem[], limit: number): FetchedItem[] {
  const selected = new Set<FetchedItem>();
  const counts = new Map<string, number>();
  for (const item of items) {
    if (selected.size >= limit) break;
    const count = counts.get(item.source) ?? 0;
    if (count >= 2) continue;
    selected.add(item);
    counts.set(item.source, count + 1);
  }
  for (const item of items) {
    if (selected.size >= limit) break;
    selected.add(item);
  }
  return [...selected];
}

/** No writes/model calls: the same selection runs in preview, tests and production. */
export async function buildDailyBrief(options: PipelineOptions = {}) {
  const now = options.now ?? new Date();
  const report: EditorialReport = {
    version: EDITORIAL_VERSION,
    runId: randomUUID(),
    startedAt: now.toISOString(),
    finishedAt: now.toISOString(),
    status: "preview",
    discovered: 0,
    evidencePool: options.extraCandidates?.length ?? 0,
    read: 0,
    selected: 0,
    inserted: 0,
    sources: [],
    decisions: [],
  };
  const sources = options.sources ?? [...SOURCES, ...STATE_PROPERTY_SOURCES];
  const reports = await mapLimit(sources, 6, async (source) => {
    // Read a useful pool before relevance, rather than the first 2–5 entries.
    const maxItems =
      source.kind === "index"
        ? source.maxItems
        : ["AU", "PROPERTY"].includes(source.channel)
          ? 20
          : 8;
    try {
      return await (options.readSource ?? fetchSourceReport)({ ...source, maxItems });
    } catch {
      return { items: [], fetched: 0, error: "Discovery request failed" };
    }
  });
  report.sources = reports.map((result, i) => ({
    name: sources[i]!.name,
    url: sources[i]!.url,
    fetched: result.fetched,
    error: result.error,
  }));
  const raw = [...reports.flatMap((r) => r.items), ...(options.extraCandidates ?? [])];
  report.discovered = raw.length;
  const decisions = new Map<string, EditorialReport["decisions"][number]>();
  const record = (
    item: FetchedItem,
    reason: string,
    score = 0,
    textChars = 0,
    beat: string | null = null
  ) => {
    const entry = {
      title: item.title.slice(0, 512),
      url: item.url?.slice(0, 2048) ?? null,
      source: item.source.slice(0, 256),
      reason,
      score,
      selected: false,
      readAttempted: false,
      beat,
      textChars,
    };
    decisions.set(articleIdentity(item), entry);
    return entry;
  };
  const seen = new Set<string>();
  const recent = new Set(
    (options.recentUrls ?? []).map((url) => articleIdentity({ url, title: "" }))
  );
  const candidates = raw
    .filter((item) => {
      const id = articleIdentity(item);
      if (seen.has(id)) return false;
      seen.add(id);
      const hold =
        referenceNewsHold(item) ??
        (discoveryScore(item) < 0 ? "off-topic" : null) ??
        (item.isoDate && !recentNewsTimestamp(item.isoDate, now)
          ? "old-or-invalid-feed-date"
          : null) ??
        (!item.isoDate && item.discovery !== "publisher-index" ? "missing-feed-date" : null) ??
        (recent.has(id) ? "already-published" : null);
      record(item, hold ?? "outside-reading-budget");
      return !hold;
    })
    .sort((a, b) => {
      const score = (item: FetchedItem) =>
        discoveryScore(item) + (item.discovery === "publisher-index" ? 40 : 0);
      return (
        score(b) - score(a) ||
        Date.parse(b.isoDate ?? "1970-01-01") - Date.parse(a.isoDate ?? "1970-01-01")
      );
    });
  const perSource = new Map<string, number>();
  const shortlist = candidates.filter((item) => {
    const count = perSource.get(item.source) ?? 0;
    if (count >= 10) return false;
    perSource.set(item.source, count + 1);
    return true;
  });
  // Separate reading budgets ensure broad world coverage cannot starve property.
  const selectedToRead = [
    ...readingBudget(
      shortlist.filter((i) => ["AU", "PROPERTY"].includes(i.channel)),
      100
    ),
    ...readingBudget(
      shortlist.filter((i) => !["AU", "PROPERTY"].includes(i.channel)),
      32
    ),
  ];
  const read = await mapLimit(selectedToRead, 6, async (item) => {
    const entry = decisions.get(articleIdentity(item))!;
    report.read++;
    entry.readAttempted = true;
    try {
      const url = await (options.resolve ?? resolveArticleUrl)(item.url);
      if (!url || new URL(url).hostname === "news.google.com") {
        entry.reason = "unresolved-publisher";
        return null;
      }
      if (recent.has(articleIdentity({ url, title: item.title }))) {
        entry.reason = "already-published";
        return null;
      }
      const article = await (options.readArticle ?? fetchArticle)(url);
      const sourceTiming: SourceTiming = {
        feedReportedAt: newsTimestamp(item.isoDate),
        ...article.publicationDate,
        retrievedAt: (options.now ?? new Date()).toISOString(),
      };
      const result = assessStory(
        { ...item, sourceUrl: url, articleText: article.text, sourceTiming },
        options.now ?? new Date()
      );
      Object.assign(entry, {
        reason: result.reason,
        score: result.score,
        beat: result.beat,
        textChars: article.text?.length ?? 0,
        url,
      });
      if (!result.eligible) return null;
      const prepared: PreparedStory = {
        ...item,
        url,
        articleText: article.text!,
        sourceTiming,
        category: result.category,
        channel: result.channel,
        score: result.score,
        beat: result.beat,
      };
      return { prepared, entry };
    } catch {
      entry.reason = "article-fetch-failed";
      return null;
    }
  });
  // Prefer the strongest readable original before canonical dedup and event clustering.
  const eligible = read
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort(
      (a, b) =>
        b.prepared.score - a.prepared.score ||
        b.prepared.articleText.length - a.prepared.articleText.length
    );
  const canonical = new Set<string>();
  const unique = eligible.filter(({ prepared, entry }) => {
    const id = articleIdentity(prepared);
    if (canonical.has(id)) {
      entry.reason = "canonical-duplicate";
      return false;
    }
    canonical.add(id);
    return true;
  });
  const clusters = clusterByTitle(unique.map((r) => r.prepared));
  const representatives = new Set(clusters.map((c) => c.item));
  for (const { prepared, entry } of unique)
    entry.reason = representatives.has(prepared) ? "below-lane-limit" : "same-event";
  const picked: PreparedStory[] = [];
  for (const channel of FEED_CHANNELS) {
    const publisherCounts = new Map<string, number>();
    for (const cluster of clusters.filter((c) => c.item.channel === channel)) {
      if (picked.filter((p) => p.channel === channel).length >= CHANNEL_TARGETS[channel]) break;
      const item = cluster.item as PreparedStory;
      const publisher = new URL(item.url!).hostname.replace(/^www\./, "");
      if ((publisherCounts.get(publisher) ?? 0) >= 3) continue;
      publisherCounts.set(publisher, (publisherCounts.get(publisher) ?? 0) + 1);
      const entry = unique.find((r) => r.prepared === item)!.entry;
      entry.selected = true;
      entry.reason = "selected";
      picked.push({
        ...item,
        corroborationCount: cluster.corroborationCount,
        corroboratingSources: cluster.corroboratingSources,
      });
    }
  }
  report.selected = picked.length;
  report.finishedAt = (options.now ?? new Date()).toISOString();
  // Keep all read decisions plus a bounded sample of pre-reading holds.
  report.decisions = [...decisions.values()]
    .sort(
      (a, b) =>
        Number(b.selected) - Number(a.selected) ||
        Number(b.readAttempted) - Number(a.readAttempted) ||
        b.textChars - a.textChars
    )
    .slice(0, 300);
  return { items: picked, report };
}

/** Use extracted reporting, never a Google roundup masquerading as a summary. */
export function briefingSummary(item: PreparedStory): string {
  const opening = item.articleText.split(/\n\n/).find((p) => p.length >= 80) ?? item.articleText;
  return opening.length > 380 ? opening.slice(0, 377).trimEnd() + "…" : opening;
}
