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
 *   INGEST_BASE_URL    — the deployed site URL, e.g. https://thedesk.au
 *   SCHEDULED_API_KEY  — matches the server's SCHEDULED_API_KEY env var
 */
import { DAILY_ITEM_MIN, DAILY_ITEM_TARGET, SOURCES } from "./sources";
import { fetchOgImage } from "./lib/og";
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

main()
  .then(() => {
    // Force exit so dangling keepalive sockets from RSS fetches +
    // og:image scrapes don't hold the Node process open past `done`.
    // Without this the GitHub Actions runner sits idle until the
    // step's timeout-minutes ceiling, then "Cancels" a script that
    // had already finished cleanly.
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
