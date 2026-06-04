/**
 * Daily feed ingest. Runs once a day on GitHub Actions.
 *
 * Flow: pull every configured RSS source in parallel → dedupe by URL →
 * cluster same-story coverage → cap per channel (CHANNEL_TARGETS) → fetch
 * og:image + body text per item (in parallel, with timeouts) → POST one batch
 * to /api/ingest/daily-feed, each item carrying its Discover channel.
 *
 * The server runs partnerTag + sayThis + image enrichment in the background
 * after this POST returns. No LLM calls happen here.
 *
 * Required env:
 *   INGEST_BASE_URL    — the deployed site URL, e.g. https://thedesk.au
 *   SCHEDULED_API_KEY  — matches the server's SCHEDULED_API_KEY env var
 */
import { FEED_CHANNELS } from "../../shared/const";
import { isRedundantSummary, looksLikeGarbage } from "../../shared/headline";
import { CHANNEL_TARGETS, DAILY_ITEM_MIN, SOURCES } from "./sources";
import { fetchArticle } from "./lib/article";
import { clusterByTitle } from "./lib/cluster";
import { fetchSource, type FetchedItem } from "./lib/rss";
import { postJSON } from "./lib/post";

/**
 * Sport / entertainment / lifestyle / hyper-local headlines that slip
 * through even our topic-targeted Google News queries (a "broker
 * channel" search can pull a story about an NRL team's media broker;
 * the ABC News Business feed occasionally bundles celebrity / lifestyle
 * filler; etc.). Filtering at ingest time is cheaper than asking the
 * LLM to re-categorise everything.
 *
 * Each pattern is matched against title + summary. One match = drop.
 * Keep patterns strict — false negatives are far less costly than false
 * positives (an irrelevant story showing up beats a legitimate one going
 * missing).
 */
const IRRELEVANT_PATTERNS: RegExp[] = [
  // League acronyms
  /\bnrl\b/i,
  /\bafl\b/i,
  /\ba-?league\b/i,
  /\bsuper rugby\b/i,
  /\bbbl\b/i,
  /\bipl\b/i,
  /\bnbl\b/i,
  /\bwnba\b/i,
  /\bw[ -]?league\b/i,

  // Sport-only phrases
  /\bgrand final\b/i,
  /\bstate of origin\b/i,
  /\bmagic round\b/i,
  /\btest (cricket|match)\b/i,
  /\b(the )?ashes\b/i,
  /\bt20\b/i,
  /\bodi\b/i,
  /\bone[- ]day international\b/i,
  /\bworld cup\b/i,
  /\bolympics?\b/i,
  /\bcommonwealth games\b/i,
  /\bsuper bowl\b/i,

  // Combat sport (the Rousey/Carano leak was here)
  /\bmma\b/i,
  /\bufc\b/i,
  /\bboxing match\b/i,
  /\bheavyweight (champion|title|fight)\b/i,
  /\b(knockout|tko|kayos?|kayoed)\b/i,
  /\bcage fight/i,
  /\boctagon\b/i,
  /\b(stops|defeats|beats|knocks out) [A-Z][a-z]+ in (round|the [a-z]+ round)/i,

  // Entertainment / reality
  /\beurovision\b/i,
  /\bbachelor(?:ette)?\b/i,
  /\bmasterchef\b/i,
  /\blogies?\b/i,
  /\bmafs\b/i,
  /\bmarried at first sight\b/i,
  /\bbig brother\b/i,

  // Lifestyle / wellness / personal-essay filler (caught "How studying
  // friendship changed my loneliness" — a real example from a tester
  // pass). These are first-person essays that ABC / Guardian / The
  // Conversation lifestyle desks bundle into business feeds.
  /\bmy (loneliness|anxiety|depression|grief|burnout|cancer|divorce)\b/i,
  /\bhow (i|studying|reading|writing|moving|leaving) (changed|saved|fixed|cured)\b/i,
  /\bpersonal essay\b/i,
  /\bhoroscope|astrology|tarot|zodiac\b/i,
  /\brecipe\b/i,
  /\b(travel|holiday) (guide|destination|tips)\b/i,

  // Hyper-local "best of <small town>" / "how to choose a <X> in
  // <town>" content (caught "How to choose a mortgage broker in Lake
  // Macquarie"). Listicles with a place name in the title are
  // typically affiliate-driven local content, not industry signal.
  /\bbest .{1,40} in (lake macquarie|wollongong|geelong|townsville|cairns|toowoomba|ballarat|bendigo|hobart|launceston|darwin|alice springs|mackay|rockhampton|bunbury|albury|wagga|tamworth|orange|dubbo)\b/i,
  /\bhow to (choose|find|pick) .{1,40} in (lake macquarie|wollongong|geelong|townsville|cairns|toowoomba|ballarat|bendigo|hobart|launceston|darwin|alice springs|mackay|rockhampton|bunbury|albury|wagga|tamworth|orange|dubbo)\b/i,

  // Generic clickbait headers
  /^\d+ (things|reasons|ways) (you|to)\b/i,
  /\byou (won'?t believe|need to know) what\b/i,
];

function isIrrelevant(item: FetchedItem): boolean {
  const haystack = `${item.title}\n${item.summary}`;
  return IRRELEVANT_PATTERNS.some((re) => re.test(haystack));
}

/**
 * First sentence(s) of an article body, capped — used as a real dek for
 * coverage-lane items whose RSS "summary" is just the headline repeated
 * (Google News descriptions are). Returns null when there's no usable body.
 */
function deriveDek(articleText: string | null | undefined, max = 260): string | null {
  if (!articleText) return null;
  const clean = articleText.replace(/\s+/gu, " ").trim();
  if (clean.length < 40) return null;
  let out = "";
  for (const part of clean.split(/(?<=[.!?])\s+/u)) {
    if (!out) out = part;
    else if ((out + " " + part).length <= max) out += " " + part;
    else break;
  }
  if (out.length > max) out = out.slice(0, max - 1).trimEnd() + "…";
  // Google News article links resolve to a JS interstitial, not the real
  // page, so the "body" can be script soup — never let that become a dek.
  if (looksLikeGarbage(out)) return null;
  return out.length >= 40 ? out : null;
}

/**
 * Pick the best subline for a story. Keeps the RSS summary when it adds
 * something over the headline; otherwise falls back to a dek pulled from the
 * article body, and finally to the original summary (the cards suppress a
 * still-redundant subline rather than render a double-up).
 */
function bestSummary(
  title: string,
  rssSummary: string,
  articleText: string | null | undefined
): string {
  if (!isRedundantSummary(title, rssSummary)) return rssSummary;
  const dek = deriveDek(articleText);
  if (dek && !isRedundantSummary(title, dek)) return dek;
  return rssSummary;
}

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

/**
 * Run the daily-feed ingest against `rawBaseUrl` (the deployed site for the
 * GitHub Action, or http://127.0.0.1:<port> when the in-process scheduler
 * calls it). Pure: no env reads, no process.exit, so the server can import it.
 */
export async function runDailyFeedIngest(rawBaseUrl: string, apiKey: string): Promise<void> {
  const baseUrl = rawBaseUrl.replace(/\/+$/u, "");

  console.log(`[ingest] pulling ${SOURCES.length} sources...`);
  const fetched = (await Promise.all(SOURCES.map(fetchSource))).flat();
  console.log(`[ingest] fetched ${fetched.length} raw items`);

  // Filter out obvious sport / entertainment / lifestyle / hyper-local
  // headlines. Catches the kind of filler that bundled feeds (ABC News
  // Business, Guardian Business) occasionally leak — MMA bouts under
  // MARKETS, lifestyle essays under ECONOMICS, etc.
  const relevant = fetched.filter((item) => {
    if (isIrrelevant(item)) {
      console.log(`[ingest] dropped (off-beat): ${item.title.slice(0, 80)}`);
      return false;
    }
    return true;
  });
  console.log(`[ingest] ${relevant.length} after relevance filter`);

  const deduped = dedupe(relevant);
  console.log(`[ingest] ${deduped.length} after dedup`);

  // Cluster same-story coverage across outlets so each representative carries
  // a corroboration count ("5 outlets reporting"). URL dedup above only
  // catches the exact same link; this catches the same event reported
  // separately by ABC, the Guardian, the AFR, etc.
  const clusters = clusterByTitle(deduped);
  const representatives: FetchedItem[] = clusters.map((c) => ({
    ...c.item,
    corroborationCount: c.corroborationCount,
    corroboratingSources:
      c.corroborationCount > 1 ? c.corroboratingSources : null,
  }));
  const corroborated = representatives.filter(
    (r) => (r.corroborationCount ?? 1) > 1
  ).length;
  console.log(
    `[ingest] ${representatives.length} stories after clustering (${corroborated} corroborated by 2+ outlets)`
  );

  // Cap per channel, not globally: each Discover lane (Australia, Property,
  // Business, Tech, Global) gets its own quota so a busy world-news day can't
  // crowd the flagship out, and a quiet flagship day can't be padded with
  // coverage filler. rankAndCap interleaves by source within each lane.
  const byChannel = new Map<string, FetchedItem[]>();
  for (const r of representatives) {
    const ch = r.channel || "AU";
    const list = byChannel.get(ch) ?? [];
    list.push(r);
    byChannel.set(ch, list);
  }
  const picked: FetchedItem[] = [];
  for (const ch of FEED_CHANNELS) {
    const laneItems = byChannel.get(ch) ?? [];
    const capped = rankAndCap(laneItems, CHANNEL_TARGETS[ch]);
    picked.push(...capped);
    console.log(`[ingest]   ${ch}: ${capped.length}/${laneItems.length}`);
  }
  console.log(`[ingest] selected ${picked.length} items across ${FEED_CHANNELS.length} channels`);

  // The flagship is the product — abort if it comes up thin rather than ship a
  // hollow Today page. Coverage lanes are allowed to be light on a quiet day.
  const auCount = picked.filter((p) => (p.channel || "AU") === "AU").length;
  if (auCount < DAILY_ITEM_MIN) {
    throw new Error(
      `[ingest] only ${auCount} AU-flagship items — below DAILY_ITEM_MIN (${DAILY_ITEM_MIN}). Refusing to ship a thin day.`
    );
  }

  // Fetch each article once for BOTH its og:image and its body text, in
  // parallel with a per-item budget. The body text rides along in the
  // payload so the server can enrich each story from the actual reporting
  // rather than the 480-char RSS snippet.
  console.log(`[ingest] fetching articles (image + body text)...`);
  const enriched = await Promise.all(
    picked.map(async (item) => {
      const article = item.url
        ? await fetchArticle(item.url)
        : { imageUrl: null, text: null };
      return { item, imageUrl: article.imageUrl, articleText: article.text };
    })
  );
  const imagesFound = enriched.filter((x) => x.imageUrl).length;
  const textFound = enriched.filter((x) => x.articleText).length;
  console.log(
    `[ingest] ${imagesFound}/${picked.length} items have og:image, ${textFound}/${picked.length} have body text`
  );

  const feedDate = todayInSydney();
  const payload = {
    items: enriched.map(({ item, imageUrl, articleText }) => ({
      feedDate,
      title: item.title,
      source: item.source,
      sourceUrl: item.url,
      summary: bestSummary(item.title, item.summary, articleText),
      category: item.category,
      channel: item.channel || "AU",
      imageUrl: imageUrl ?? null,
      // Don't ground the LLM enrichment on extraction garbage (Google News'
      // JS interstitial). When the body is junk, send null so the prompts work
      // from the (clean) title + summary instead of a page full of script soup.
      articleText:
        articleText && !looksLikeGarbage(articleText) ? articleText : null,
      corroborationCount: item.corroborationCount ?? 1,
      corroboratingSources: item.corroboratingSources ?? null,
    })),
  };

  console.log(`[ingest] POST ${baseUrl}/api/ingest/daily-feed (${payload.items.length} items)`);
  const result = await postJSON(`${baseUrl}/api/ingest/daily-feed`, payload, apiKey);
  console.log(`[ingest] server response:`, result);
  console.log(`[ingest] done.`);
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
