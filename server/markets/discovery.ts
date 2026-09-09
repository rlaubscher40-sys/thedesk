import {
  PUBLIC_MARKETS,
  type MarketDirectory,
  type PublicMarketFile,
} from "../../shared/marketDirectory";
import { cached } from "../core/cache";
import * as db from "../db";
import { isDemoMode } from "../demo/store";
import { marketHousingPassage, normaliseText } from "./evidence";
import { hasHousingEvidence } from "../../shared/marketRelevance";
import { foreignHousingHeadline } from "../../shared/australianScope";
import { propertyNewsHold } from "../../shared/propertyNewsQuality";
import { getCityRents } from "./absRents";
import { getCityApprovals } from "./absApprovals";
import { getStateDemographics } from "./absDemographics";

export const MARKET_SAMPLE_LIMIT = 2000;
type DiscoveryItem = Pick<
  db.DailyFeedItem,
  "id" | "title" | "summary" | "source" | "sourceUrl" | "feedDate" | "channel" | "category"
> & { href?: string };
function validDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
  );
}
function daysBefore(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}
function safeSource(value: string | null): string | null {
  try {
    const url = new URL(value ?? "");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return null;
  }
}
function excerpt(text: string, market: string): string {
  const clean = normaliseText(text);
  // Keep a literal local excerpt. Ellipses mark both clipped boundaries.
  const index = clean.toLowerCase().indexOf(market.toLowerCase());
  const start = Math.max(0, index - 100);
  const end = Math.min(clean.length, start + 360);
  return `${start ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}

export function buildMarketDirectory(
  items: DiscoveryItem[],
  asOf: string,
  demo = false
): MarketDirectory {
  if (!validDate(asOf)) throw new Error("Invalid directory date");
  const since = daysBefore(asOf, 89);
  const recent = daysBefore(asOf, 29);
  const eligible = items
    .filter(
      (item) =>
        ["AU", "PROPERTY"].includes((item.channel ?? "AU").toUpperCase()) &&
        ["PROPERTY", "MACRO", "MARKETS", "POLICY", "ECONOMICS"].includes(
          item.category.toUpperCase()
        ) &&
        hasHousingEvidence(`${item.title} ${item.summary ?? ""}`) &&
        !foreignHousingHeadline(item.title, item.sourceUrl, item.source) &&
        !propertyNewsHold(item, asOf) &&
        validDate(item.feedDate) &&
        item.feedDate >= since &&
        item.feedDate <= asOf
    )
    .sort((a, b) => b.feedDate.localeCompare(a.feedDate) || b.id - a.id);
  const sample = eligible.slice(0, MARKET_SAMPLE_LIMIT);
  const markets = PUBLIC_MARKETS.map((market): PublicMarketFile => {
    const publishers = new Set<string>();
    const candidates = sample.flatMap((item) => {
      const passage = marketHousingPassage(`${item.title} ${item.summary ?? ""}`, market.name);
      if (!passage) return [];
      const sourceUrl = safeSource(item.sourceUrl);
      return [
        {
          id: item.id,
          href: item.href,
          title: item.title,
          excerpt: excerpt(passage, market.name),
          date: item.feedDate,
          publisher: item.source?.trim() || null,
          sourceUrl,
          category: item.category,
        },
      ];
    });
    // Union duplicate identities before selecting representatives: an older record
    // can connect two newer copies by sharing one's URL and the other's headline.
    const parents = candidates.map((_, index) => index);
    const root = (index: number): number => {
      let current = index;
      while (parents[current] !== current) current = parents[current]!;
      return current;
    };
    const identities = new Map<string, number>();
    candidates.forEach((reference, index) => {
      const keys = [
        `title:${normaliseText(reference.title).toLowerCase()}`,
        reference.sourceUrl ? `url:${reference.sourceUrl}` : `id:${reference.id}`,
      ];
      for (const key of keys) {
        const previous = identities.get(key);
        if (previous !== undefined) {
          const a = root(previous),
            b = root(index);
          parents[Math.max(a, b)] = Math.min(a, b);
        }
        identities.set(key, index);
      }
    });
    const references = candidates.filter((_, index) => root(index) === index);
    for (const reference of references) {
      if (reference.sourceUrl)
        publishers.add(new URL(reference.sourceUrl).hostname.toLowerCase().replace(/^www\./, ""));
    }
    const latestMention = references[0]?.date ?? null;
    const enough = references.length >= 3 && publishers.size >= 2;
    const coverage = !latestMention
      ? "none"
      : latestMention < recent
        ? "older"
        : enough
          ? "recent"
          : "limited";
    return {
      market,
      asOf,
      since,
      referenceCount: references.length,
      publisherCount: publishers.size,
      latestMention,
      coverage,
      indexable: !demo && coverage === "recent",
      references: references.slice(0, 12),
    };
  }).sort(
    (a, b) =>
      (b.latestMention ?? "").localeCompare(a.latestMention ?? "") ||
      a.market.name.localeCompare(b.market.name)
  );
  return {
    asOf,
    since,
    sampleLimit: MARKET_SAMPLE_LIMIT,
    sampleCapped: eligible.length > MARKET_SAMPLE_LIMIT,
    demo,
    markets,
  };
}

/** One bounded cached read for all public market pages; no model work or quota use. */
export async function getMarketDirectory(): Promise<MarketDirectory> {
  const asOf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return cached(`feed:market-directory:${asOf}`, 60_000, async () => {
    const demo = isDemoMode();
    const [items, rents, approvals, demographics, archive] = await Promise.all([
      db.listMarketDiscoveryItems(daysBefore(asOf, 89), asOf, 1001),
      demo ? undefined : getCityRents(),
      demo ? undefined : getCityApprovals(),
      demo ? undefined : getStateDemographics(),
      db.listPropertyMarketEvidence(),
    ]);
    const directory = buildMarketDirectory(
      [
        ...items,
        ...archive.map((row) => ({
          id: -row.id,
          href: `/evidence/${row.id}`,
          title: row.title,
          summary: row.summary,
          source: row.source,
          sourceUrl: row.sourceUrl,
          feedDate: row.publishedAt.toISOString().slice(0, 10),
          category: "PROPERTY",
          channel: "PROPERTY",
        })),
      ],
      asOf,
      demo
    );
    return {
      ...directory,
      markets: directory.markets.map((file) => ({ ...file, rents, approvals, demographics })),
    };
  });
}
