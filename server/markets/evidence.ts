import type { ComparisonSource, MarketSide } from "../../shared/marketComparison";
import * as db from "../db";
import { hasHousingEvidence } from "../../shared/marketRelevance";

export type MarketEvidence = ComparisonSource & { text: string };
export function normaliseText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
export function mentionsMarket(text: string, market: string): boolean {
  const escaped = normaliseText(market).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(
    normaliseText(text)
  );
}

/** Keep the local passage, not an unrelated opening paragraph of a long edition. */
export function marketPassage(text: string, market: string): string | null {
  const clean = normaliseText(text);
  if (!mentionsMarket(clean, market)) return null;
  const index = clean.toLowerCase().indexOf(market.toLowerCase());
  const start = Math.max(0, index - 350);
  return clean.slice(start, index + market.length + 1500);
}

/** Search every literal mention: an edition can mention football first and
 * housing later. Only a nearby housing passage can consume a source slot. */
export function marketHousingPassage(text: string, market: string): string | null {
  const clean = normaliseText(text);
  const escaped = normaliseText(market).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return null;
  const matches = clean.matchAll(
    new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu")
  );
  for (const match of matches) {
    const index = match.index;
    const start = Math.max(0, index - 200);
    const nearby = clean.slice(start, index + market.length + 300);
    if (hasHousingEvidence(nearby)) return clean.slice(start, index + market.length + 1200);
  }
  return null;
}

export async function retrieveMarketEvidence(
  marketA: string,
  marketB: string
): Promise<MarketEvidence[]> {
  // Exact full-name queries keep "Port Macquarie" separate from national Macquarie lending.
  const bundles = await Promise.all([
    db.searchMarketContent(marketA),
    db.searchMarketContent(marketB),
  ]);
  const evidence = new Map<string, MarketEvidence>();
  for (const [index, bundle] of bundles.entries()) {
    const side: MarketSide = index === 0 ? "a" : "b";
    const market = index === 0 ? marketA : marketB;
    const candidates = [
      ...bundle.feedItems.map((item) => ({
        title: item.title,
        text: `${item.title}\n${item.summary ?? ""}`,
        date: item.feedDate,
        publisher: item.source ?? null,
        href: `/story/${item.id}`,
        identity: item.sourceUrl || `/story/${item.id}`,
      })),
      ...bundle.editions.map((item) => ({
        title: `Edition ${item.editionNumber}: ${item.weekRange}`,
        text: item.fullText ?? "",
        date: item.weekOf,
        publisher: "The Desk",
        href: `/editions/${item.editionNumber}`,
        identity: `/editions/${item.editionNumber}`,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    for (const item of candidates) {
      const passage = marketHousingPassage(item.text, market);
      if (!passage) continue;
      const existing = evidence.get(item.identity);
      if (existing?.markets.includes(side)) continue;
      if (existing) {
        existing.markets.push(side);
        if (!existing.text.includes(passage)) existing.text += `\n${passage}`;
      } else {
        evidence.set(item.identity, {
          ref: evidence.size + 1,
          title: item.title.slice(0, 240),
          date: item.date.slice(0, 32),
          publisher: item.publisher?.slice(0, 120) ?? null,
          href: item.href,
          text: passage,
          markets: [side],
        });
      }
      // Equal budgets; repeated syndication of one source never creates extra weight.
      if (++count >= 4) break;
    }
  }
  return [...evidence.values()];
}
