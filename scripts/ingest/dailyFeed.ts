/** Daily briefing: discover, read, evaluate, deduplicate, rank, then publish. */
import { buildDailyBrief, briefingSummary } from "./lib/editorialPipeline";
import { postJSON } from "./lib/post";
import type { FetchedItem } from "./lib/rss";
import type { EvidenceStory } from "../../shared/storyEvidenceDuplicate";
import { DAILY_ITEM_MIN } from "./sources";
import { sydneySocialClock } from "../../shared/instagramSchedule";

export async function runDailyFeedIngest(rawBaseUrl: string, apiKey: string): Promise<void> {
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  let extras: FetchedItem[] = [];
  let recentUrls: string[] = [];
  let recentStories: EvidenceStory[] = [];
  let poolError: string | null = null;
  try {
    const pool = (await postJSON(`${baseUrl}/api/ingest/editorial-candidates`, {}, apiKey)) as {
      items: FetchedItem[];
      recentUrls: string[];
      recentStories?: EvidenceStory[];
    };
    extras = pool.items;
    recentUrls = pool.recentUrls;
    recentStories = pool.recentStories ?? [];
  } catch {
    poolError = "Evidence pool unavailable; direct discovery continued";
  }
  const { items, report } = await buildDailyBrief({
    extraCandidates: extras,
    recentUrls,
    recentStories,
  });
  if (poolError)
    report.sources.push({
      name: "Hourly evidence pool",
      url: `${baseUrl}/api/ingest/editorial-candidates`,
      fetched: 0,
      error: poolError,
    });
  const feedDate = sydneySocialClock(new Date()).dateISO;
  try {
    if (
      items.filter((item) => ["AU", "PROPERTY"].includes(item.channel)).length >= DAILY_ITEM_MIN
    ) {
      const result = (await postJSON(
        `${baseUrl}/api/ingest/daily-feed`,
        {
          items: items.map((item) => ({
            feedDate,
            title: item.title,
            source: item.source,
            sourceUrl: item.url,
            summary: briefingSummary(item),
            category: item.category,
            channel: item.channel,
            sourceTiming: item.sourceTiming,
            articleText: item.articleText,
            imageUrl: null,
            corroborationCount: item.corroborationCount ?? 1,
            corroboratingSources: item.corroboratingSources ?? null,
          })),
        },
        apiKey
      )) as { count?: number };
      report.inserted = result.count ?? 0;
      report.status = result.count ? "published" : "empty";
      console.log(
        `[editorial] ${JSON.stringify({ read: report.read, selected: report.selected, inserted: result.count })}`
      );
    } else {
      report.status = "empty";
      if (report.sources.every((source) => source.error) && !extras.length)
        throw new Error("All discovery sources failed");
      console.warn("[editorial] No new stories cleared publication; existing briefing retained.");
    }
  } catch (error) {
    report.status = "failed";
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    console.log(
      `[editorial-outcomes] ${JSON.stringify({ runId: report.runId, status: report.status, decisionCount: report.decisionCount, outcomes: report.outcomes, failedSources: report.sources.filter((s) => s.error).map((s) => ({ name: s.name, error: s.error })), articleFailures: report.decisions.filter((d) => /^article-(?:http-|timeout|fetch-failed|unsupported-content-type|empty-response)/.test(d.reason)).map((d) => ({ source: d.source, reason: d.reason })) })}`
    );
    await postJSON(`${baseUrl}/api/ingest/editorial-report`, report, apiKey);
  }
}

async function main(): Promise<void> {
  const baseUrl = process.env.INGEST_BASE_URL;
  const apiKey = process.env.SCHEDULED_API_KEY;
  if (!baseUrl) throw new Error("INGEST_BASE_URL is required");
  if (!apiKey) throw new Error("SCHEDULED_API_KEY is required");
  await runDailyFeedIngest(baseUrl, apiKey);
}

// CLI entrypoint only — `pnpm ingest:daily` sets INGEST_CLI=1. When the server
// imports this module for the in-process scheduler, INGEST_CLI is unset, so
// main() never runs (and never process.exit()s the server) on import.
if (process.env.INGEST_CLI === "1") {
  main()
    .then(() => {
      // Force exit so dangling keepalive sockets from RSS fetches +
      // og:image scrapes don't hold the Node process open past `done`.
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
