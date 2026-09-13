import type { MarketDirectory } from "./marketDirectory";
import { publicMarket } from "./marketDirectory";
import { FEATURED_COMPARISON_PATH } from "./featuredComparison";

export const MARKET_BOOTSTRAP_ID = "desk-market-data";
export type MarketBootstrap = {
  version: 1;
  path: string;
  generatedAt: number;
  directory: MarketDirectory;
};

/** Inert JSON, escaped for the HTML parser even inside a script data block. */
export function marketBootstrapTag(
  path: string,
  directory: MarketDirectory,
  now = Date.now()
): string {
  const payload: MarketBootstrap = { version: 1, path, generatedAt: now, directory };
  const json = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<script id="${MARKET_BOOTSTRAP_ID}" type="application/json">${json}</script>`;
}

/** Fail open to the normal query for old, malformed or wrong-route documents. */
export function parseMarketBootstrap(
  text: string | null,
  path: string,
  now = Date.now()
): MarketBootstrap | null {
  if (!text || text.length > 2_000_000) return null;
  try {
    const data = JSON.parse(text) as MarketBootstrap;
    const slug = path.startsWith("/markets/") ? path.slice(9) : "";
    if (path !== FEATURED_COMPARISON_PATH && !publicMarket(slug)) return null;
    if (
      data.version !== 1 ||
      data.path !== path ||
      !Number.isFinite(data.generatedAt) ||
      data.generatedAt > now + 60_000 ||
      now - data.generatedAt > 60_000
    )
      return null;
    const directory = data.directory;
    if (
      !directory ||
      typeof directory.asOf !== "string" ||
      typeof directory.since !== "string" ||
      !Array.isArray(directory.markets) ||
      !directory.markets.length ||
      !directory.markets.every(
        (file) => publicMarket(file.market?.slug) && Array.isArray(file.references)
      )
    )
      return null;
    if (
      path !== FEATURED_COMPARISON_PATH &&
      !directory.markets.some((file) => file.market.slug === slug)
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
