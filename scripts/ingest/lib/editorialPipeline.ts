import { randomUUID } from "node:crypto";
import { reportingExcerpt } from "../../../shared/reportingExcerpt";
import {
  assessStory,
  discoveryScore,
  EDITORIAL_VERSION,
  referenceNewsHold,
  publisherWeight,
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
import { originalPublicationDay } from "../../../shared/storyEvent";
import { publisherAccessPause } from "./articleAccess";
import { olderIndexPath } from "./indexReadingAge";
import {
  createEvidenceDuplicateIndex,
  type EvidenceStory,
} from "../../../shared/storyEvidenceDuplicate";

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
  recentStories?: EvidenceStory[];
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
  const reports = await mapLimit(sources, 6, async (source): Promise<SourceReport> => {
    // Read a useful pool before relevance, rather than the first 2–5 entries.
    const maxItems =
      source.kind === "index" ||
      source.kind === "nsw-index" ||
      source.kind === "asic-index" ||
      source.kind === "victoria-index"
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
    ...(result.recovery ? { recovery: result.recovery } : {}),
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
        publisherAccessPause(item.url) ??
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
        discoveryScore(item) + (item.discovery === "publisher-index" ? 4 : 0);
      return (
        Number(olderIndexPath(a, now)) - Number(olderIndexPath(b, now)) ||
        score(b) - score(a) ||
        Date.parse(b.isoDate ?? "1970-01-01") - Date.parse(a.isoDate ?? "1970-01-01")
      );
    });
  const perSource = new Map<string, number>();
  const shortlist = candidates.filter((item) => {
    const count = perSource.get(item.source) ?? 0;
    if (count >= 10) {
      decisions.get(articleIdentity(item))!.reason = "publisher-reading-limit";
      return false;
    }
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
  const articleRequests = new Map<string, Promise<FetchedArticle>>();
  const rateLimited = new Set<string>();
  const readCandidate = async (item: FetchedItem) => {
    const entry = decisions.get(articleIdentity(item))!;

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
      const pause = publisherAccessPause(url);
      if (pause) {
        entry.url = url;
        entry.reason = pause;
        return null;
      }
      const resolved = { ...item, url };
      if (["AU", "PROPERTY"].includes(item.channel) && publisherWeight(resolved) === 0) {
        entry.url = url;
        entry.reason = "unreviewed-publisher";
        return null;
      }
      const host = new URL(url).hostname;
      if (rateLimited.has(host)) {
        entry.url = url;
        entry.reason = "publisher-rate-limit-deferred";
        return null;
      }
      entry.readAttempted = true;
      let request = articleRequests.get(url);
      if (!request) {
        report.read++;
        request = (options.readArticle ?? fetchArticle)(url);
        articleRequests.set(url, request);
      }
      const article = await request;
      if (article.fetchFailure === "article-http-429") rateLimited.add(host);
      if (article.fetchFailure) {
        entry.reason = article.fetchFailure;
        entry.url = url;
        return null;
      }
      if (article.editorialHold) {
        entry.reason = article.editorialHold;
        entry.url = url;
        return null;
      }
      const sourceTiming: SourceTiming = {
        feedReportedAt: newsTimestamp(item.isoDate),
        ...article.publicationDate,
        retrievedAt: (options.now ?? new Date()).toISOString(),
      };
      const result = assessStory(
        {
          ...item,
          title: article.title ?? item.title,
          summary: article.title ? "" : item.summary,
          sourceUrl: url,
          articleText: article.text,
          sourceTiming,
        },
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
        title: article.title ?? item.title,
        summary: article.title ? "" : item.summary,
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
  };
  const read = await mapLimit(selectedToRead, 6, readCandidate);
  // Failed/unusable articles must not exhaust the only chance to find local
  // reporting. Read a bounded reserve in waves, stopping when each local lane
  // has enough distinct eligible events. Every ordinary evidence gate still runs.
  const attempted = new Set(selectedToRead);
  const recoveryCounts = new Map<string, number>();
  for (const item of selectedToRead)
    recoveryCounts.set(item.source, (recoveryCounts.get(item.source) ?? 0) + 1);
  const reserve = readingBudget(
    candidates.filter((item) => {
      if (!["AU", "PROPERTY"].includes(item.channel) || attempted.has(item)) return false;
      const count = recoveryCounts.get(item.source) ?? 0;
      if (count >= 20) return false;
      recoveryCounts.set(item.source, count + 1);
      return true;
    }),
    60
  );
  const hasLocalSupply = () => {
    const published = createEvidenceDuplicateIndex(options.recentStories);
    const unique = new Map<string, PreparedStory>();
    for (const row of read) {
      if (row && !published.find(row.prepared))
        unique.set(articleIdentity(row.prepared), row.prepared);
    }
    const clusters = clusterByTitle([...unique.values()]);
    return ["AU", "PROPERTY"].every((channel) => {
      const counts = new Map<string, number>();
      let count = 0;
      for (const { item } of clusters.filter((c) => c.item.channel === channel)) {
        const host = new URL(item.url!).hostname.replace(/^www\./, "");
        const used = counts.get(host) ?? 0;
        if (used < 3) {
          counts.set(host, used + 1);
          count++;
        }
      }
      return count >= CHANNEL_TARGETS[channel as "AU" | "PROPERTY"];
    });
  };
  for (let start = 0; start < reserve.length && !hasLocalSupply(); start += 20) {
    read.push(...(await mapLimit(reserve.slice(start, start + 20), 6, readCandidate)));
  }
  // Prefer significance, then original publication day. Length is evidence
  // for eligibility, not a reason to lead with a longer article.
  const eligible = read
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort(
      (a, b) =>
        b.prepared.score - a.prepared.score ||
        (originalPublicationDay(b.prepared) ?? "").localeCompare(
          originalPublicationDay(a.prepared) ?? ""
        )
    );
  const canonical = new Set<string>();
  const publishedEvidence = createEvidenceDuplicateIndex(options.recentStories);
  const unique = eligible.filter(({ prepared, entry }) => {
    if (publishedEvidence.find(prepared)) {
      entry.reason = "already-covered-evidence";
      return false;
    }
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
      if ((publisherCounts.get(publisher) ?? 0) >= 3) {
        unique.find((r) => r.prepared === item)!.entry.reason = "publisher-publication-limit";
        continue;
      }
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
  report.decisionCount = decisions.size;
  report.outcomes = {};
  for (const decision of decisions.values()) {
    report.outcomes[decision.reason] = (report.outcomes[decision.reason] ?? 0) + 1;
  }
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
  return reportingExcerpt(item.title, item.articleText);
}
