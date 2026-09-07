import { latestRent, rentGap, rentPeriod } from "./cityRents";
import type { MarketDirectory } from "./marketDirectory";

/** One editorial pilot, not an unbounded set of search landing pages. */
export const FEATURED_COMPARISON_PATH = "/markets/compare/brisbane-vs-perth";
export const FEATURED_COMPARISON_CARD = "/og/markets/compare/brisbane-vs-perth.png";
export function featuredComparison(directory: MarketDirectory) {
  const a = directory.markets.find((file) => file.market.slug === "brisbane");
  const b = directory.markets.find((file) => file.market.slug === "perth");
  const rentA = !directory.demo ? latestRent(a?.rents, "Brisbane") : undefined;
  const rentB = !directory.demo ? latestRent(a?.rents, "Perth") : undefined;
  const gap = rentGap(rentA, rentB, directory.asOf);
  const headline =
    gap === null
      ? "The rental comparison has an evidence gap."
      : gap === 0
        ? "Rent growth is level. The wider call stays open."
        : `${gap > 0 ? "Brisbane" : "Perth"}'s rents grew faster. The wider call stays open.`;
  const summary =
    gap === null
      ? "A current comparison needs both cities on the same reference month."
      : `Brisbane ${rentA!.annualPercent.toFixed(1)}% vs Perth ${rentB!.annualPercent.toFixed(1)}% annual rent growth. Year to ${rentPeriod(rentA!.period)}. ABS rents actually paid; this is not a rental yield or an investment ranking.`;
  return { a, b, rentA, rentB, gap, headline, summary };
}
