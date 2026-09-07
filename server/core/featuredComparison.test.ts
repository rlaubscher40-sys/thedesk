import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("../db", () => ({ listMarketDiscoveryItems: vi.fn() }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { buildMarketDirectory } from "../markets/discovery";
import { featuredComparisonCardInput, featuredComparisonShell } from "./marketSeo";
import { featuredComparison, FEATURED_COMPARISON_PATH } from "../../shared/featuredComparison";
import { renderDeskTakeCard } from "../og/takeCard";
import { isKnownRoute } from "./spaShell";
import type { CityRents } from "../../shared/cityRents";
const shell = '<html><head><title>The Desk</title></head><body><div id="root"></div></body></html>';
function directory(rents?: CityRents) {
  const result = buildMarketDirectory([], "2026-09-07");
  return { ...result, markets: result.markets.map((file) => ({ ...file, rents })) };
}
const rents: CityRents = {
  status: "available",
  retrievedAt: "2026-09-07T00:00:00Z",
  observations: [
    { city: "Brisbane", period: "2026-07", annualPercent: 4.6, status: "" },
    { city: "Perth", period: "2026-07", annualPercent: 5.3, status: "" },
  ],
};
describe("free Brisbane–Perth read", () => {
  it("shows a real same-period distinction before any generated answer", () => {
    const read = featuredComparison(directory(rents));
    expect(read.headline).toBe("Perth's rents grew faster. The wider call stays open.");
    expect(read.gap).toBe(-0.7);
    const html = featuredComparisonShell(shell, directory(rents), "https://thedesk.au");
    expect(html).toContain("Year to July 2026");
    expect(html).toContain("No qualifying housing reporting");
    expect(html).toContain("What would change the call?");
    expect(html).toContain("overall market advantage is still unproven");
    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).toContain(`https://thedesk.au${FEATURED_COMPARISON_PATH}`);
  });
  it("withholds a gap and card for missing, mismatched, old or demo data", () => {
    const variants = [
      directory(),
      directory({ ...rents, observations: rents.observations.slice(0, 1) }),
      directory({
        ...rents,
        observations: rents.observations.map((row, i) => ({
          ...row,
          period: i ? "2026-06" : "2026-07",
        })),
      }),
      { ...directory(rents), asOf: "2027-01-01" },
      { ...directory(rents), demo: true },
    ];
    for (const variant of variants) {
      expect(featuredComparisonCardInput(variant)).toBeNull();
      expect(featuredComparison(variant).headline).toContain("evidence gap");
      expect(featuredComparisonShell(shell, variant, "https://thedesk.au")).not.toContain(
        "0.7 percentage points higher"
      );
    }
  });
  it("does not imply a winner when annual rates are equal", () => {
    const equal = directory({
      ...rents,
      observations: rents.observations.map((row) => ({ ...row, annualPercent: 4.6 })),
    });
    expect(featuredComparison(equal).headline).toContain("level");
    expect(featuredComparisonCardInput(equal)?.figure).toBe("0.0pp");
  });
  it("renders a grounded 4:5 card with both observations, the date and status labels", async () => {
    const input = featuredComparisonCardInput(
      directory({
        ...rents,
        observations: rents.observations.map((row) => ({ ...row, status: "p" })),
      })
    )!;
    expect(input.figure).toBe("0.7pp");
    expect(input.storyTitle).toContain("Brisbane 4.6% · Perth 5.3%");
    expect(input.feedDate).toBe("2026-07");
    expect(input.context).toContain("preliminary");
    expect(input.context).toContain("No overall investment winner");
    expect(await sharp(await renderDeskTakeCard(input)).metadata()).toMatchObject({
      width: 1080,
      height: 1350,
    });
  });
  it("allows only the selected pilot route", () => {
    expect(isKnownRoute(FEATURED_COMPARISON_PATH)).toBe(true);
    expect(isKnownRoute("/markets/compare/arbitrary-vs-place")).toBe(false);
  });
});
