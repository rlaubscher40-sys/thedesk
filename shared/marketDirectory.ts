import type { CityRents } from "./cityRents";
import type { CityApprovals } from "./cityApprovals";
import type { StateDemographics } from "./stateDemographics";
/** A deliberately small public directory, not a claim of suburb-wide coverage. */
export const PUBLIC_MARKETS = [
  { slug: "sydney", name: "Sydney", state: "NSW" },
  { slug: "melbourne", name: "Melbourne", state: "VIC" },
  { slug: "brisbane", name: "Brisbane", state: "QLD" },
  { slug: "perth", name: "Perth", state: "WA" },
  { slug: "adelaide", name: "Adelaide", state: "SA" },
  { slug: "hobart", name: "Hobart", state: "TAS" },
  { slug: "darwin", name: "Darwin", state: "NT" },
  { slug: "canberra", name: "Canberra", state: "ACT" },
  { slug: "townsville", name: "Townsville", state: "QLD" },
  { slug: "newcastle", name: "Newcastle", state: "NSW" },
  { slug: "gold-coast", name: "Gold Coast", state: "QLD" },
  { slug: "sunshine-coast", name: "Sunshine Coast", state: "QLD" },
] as const;

export type PublicMarket = (typeof PUBLIC_MARKETS)[number];
export function publicMarket(slug: string): PublicMarket | undefined {
  return PUBLIC_MARKETS.find((market) => market.slug === slug);
}
export function marketPath(slug: string): string {
  return `/markets/${slug}`;
}

type MarketReference = {
  href?: string;
  id: number;
  title: string;
  excerpt: string;
  date: string;
  publisher: string | null;
  sourceUrl: string | null;
  category: string;
};
export type PublicMarketFile = {
  market: PublicMarket;
  asOf: string;
  since: string;
  referenceCount: number;
  publisherCount: number;
  latestMention: string | null;
  coverage: "recent" | "limited" | "older" | "none";
  indexable: boolean;
  references: MarketReference[];
  rents?: CityRents;
  approvals?: CityApprovals;
  demographics?: StateDemographics;
};
export type MarketDirectory = {
  asOf: string;
  since: string;
  sampleLimit: number;
  sampleCapped: boolean;
  demo: boolean;
  markets: PublicMarketFile[];
};

export function marketQuestion(name: string): string {
  return `What does The Desk's evidence say about ${name}'s property outlook, what are the risks, and what would change the view?`;
}

/** Explain coverage only; never turn archive frequency into investment confidence. */
export function coverageLabel(file: PublicMarketFile): string {
  if (file.coverage === "none") return "No recent coverage";
  if (file.coverage === "older") return "Older reporting only";
  if (file.coverage === "limited") return "Limited recent coverage";
  return "Recent reporting available";
}
