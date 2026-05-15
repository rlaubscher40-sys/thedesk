/**
 * Daily feed ingest. Runs once a day on GitHub Actions.
 *
 * Flow: pull every configured RSS source in parallel → dedupe by URL → cap
 * at DAILY_ITEM_TARGET → fetch og:image per item (in parallel, with
 * timeouts) → POST one batch to /api/ingest/daily-feed.
 *
 * The server runs partnerTag + sayThis + image enrichment in the background
 * after this POST returns. No LLM calls happen here.
 *
 * Required env:
 *   INGEST_BASE_URL    — e.g. https://thedeskglobal.manus.space
 *   SCHEDULED_API_KEY  — matches the server's SCHEDULED_API_KEY env var
 */
import { DAILY_ITEM_MIN, DAILY_ITEM_TARGET, SOURCES } from "./sources";
import { fetchOgImage } from "./lib/og";
import { fetchSource, type FetchedItem } from "./lib/rss";
import { postJSON } from "./lib/post";

function todayInSydney(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function dedupe(items: FetchedItem[]): FetchedItem[] {
  const seen = new Set<string>();
  const out: FetchedItem[] = [];
  for (const item of items) {
    const key = (item.url ?? item.title).toLowerCase().replace(/[?#].*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function rankAndCap(items: FetchedItem[], target: number): FetchedItem[] {
  // Sort by recency desc, then interleave by source so the mix stays varied
  // even when one feed dominates the top-N by time.
  const recent = [...items].sort((a, b) => {
    const ta = a.isoDate ? Date.parse(a.isoDate) : 0;
    const tb = b.isoDate ? Date.parse(b.isoDate) : 0;
    return tb - ta;
  });

  const bySource = new Map<string, FetchedItem[]>();
  for (const item of recent) {
    const list = bySource.get(item.source) ?? [];
    list.push(item);
    bySource.set(item.source, list);
  }
  const queues = Array.from(bySource.values());
  const picked: FetchedItem[] = [];
  while (picked.length < target) {
    let added = false;
    for (const q of queues) {
      if (picked.length >= target) break;
      const next = q.shift();
      if (next) {
        picked.push(next);
        added = true;
      }
    }
    if (!added) break;
  }
  return picked;
}

async function main(): Promise<void> {
  const baseUrl = process.env.INGEST_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.SCHEDULED_API_KEY;
  if (!baseUrl) throw new Error("INGEST_BASE_URL is required");
  if (!apiKey) throw new Error("SCHEDULED_API_KEY is required");

  console.log(`[ingest] pulling ${SOURCES.length} sources...`);
  const fetched = (await Promise.all(SOURCES.map(fetchSource))).flat();
  console.log(`[ingest] fetched ${fetched.length} raw items`);

  const deduped = dedupe(fetched);
  console.log(`[ingest] ${deduped.length} after dedup`);

  const picked = rankAndCap(deduped, DAILY_ITEM_TARGET);
  console.log(`[ingest] selected ${picked.length} items for ingest`);

  if (picked.length < DAILY_ITEM_MIN) {
    throw new Error(
      `[ingest] only ${picked.length} items — below DAILY_ITEM_MIN (${DAILY_ITEM_MIN}). Refusing to ship a thin day.`
    );
  }

  // Fetch og:images in parallel, with a per-item budget.
  console.log(`[ingest] fetching og:images...`);
  const withImages = await Promise.all(
    picked.map(async (item) => {
      const imageUrl = item.url ? await fetchOgImage(item.url) : null;
      return { item, imageUrl };
    })
  );
  const imagesFound = withImages.filter((x) => x.imageUrl).length;
  console.log(`[ingest] ${imagesFound}/${picked.length} items have og:image`);

  const feedDate = todayInSydney();
  const payload = {
    items: withImages.map(({ item, imageUrl }) => ({
      feedDate,
      title: item.title,
      source: item.source,
      sourceUrl: item.url,
      summary: item.summary,
      category: item.category,
      imageUrl: imageUrl ?? null,
    })),
  };

  console.log(`[ingest] POST ${baseUrl}/api/ingest/daily-feed (${payload.items.length} items)`);
  const result = await postJSON(`${baseUrl}/api/ingest/daily-feed`, payload, apiKey);
  console.log(`[ingest] server response:`, result);
  console.log(`[ingest] done.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
