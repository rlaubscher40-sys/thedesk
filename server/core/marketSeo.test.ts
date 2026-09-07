import { describe, expect, it, vi } from "vitest";
vi.mock("../db", () => ({ listMarketDiscoveryItems: vi.fn() }));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
import { buildMarketDirectory } from "../markets/discovery";
import { marketCardInput, marketShell } from "./marketSeo";
import { isKnownRoute } from "./spaShell";
import { renderDeskTakeCard } from "../og/takeCard";
import sharp from "sharp";

const shell =
  '<html><head><title>The Desk</title><meta property="og:type" content="website"/><link rel="canonical" href="https://thedesk.au" /></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
const directory = buildMarketDirectory(
  [1, 2, 3].map((id) => ({
    id,
    title: `Perth report ${id} <script>alert("x")</script>`,
    summary: "Perth housing evidence.",
    source: `Publisher ${id}`,
    sourceUrl: `https://source-${id}.test/report`,
    feedDate: "2026-09-07",
    category: "PROPERTY",
    channel: "AU",
  })),
  "2026-09-07"
);
const file = directory.markets.find((item) => item.market.slug === "perth")!;

describe("public market HTML and cards", () => {
  it("serves actual visible evidence and actionable links before JavaScript", () => {
    const html = marketShell(shell, file, directory, "https://thedesk.au");
    expect(html).toContain("The source trail");
    expect(html).toContain('href="/story/3"');
    expect(html).toContain('href="/ask?q=');
    expect(html).toContain('href="/markets?q=Perth&amp;vs="');
    expect(html).toContain('src="/app.js"');
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).not.toContain('name="robots"');
  });
  it("escapes text in body, metadata and JSON-LD and keeps one canonical", () => {
    const html = marketShell(shell, file, directory, "https://thedesk.au");
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("\\u003cscript>");
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain('href="https://thedesk.au/markets/perth"');
    expect(html).toContain("https://thedesk.au/og/markets/perth.png");
    expect(html).toContain('property="og:image:width" content="1080"');
    expect(html).toContain('property="og:image:height" content="1350"');
  });
  it("keeps thin/empty files crawlable but noindex without made-up dates", () => {
    const empty = buildMarketDirectory([], "2026-09-07");
    const emptyFile = empty.markets.find((item) => item.market.slug === "perth")!;
    const html = marketShell(shell, emptyFile, empty, "https://thedesk.au");
    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).not.toContain('"dateModified"');
    expect(html).toContain("No recent reporting selected for Perth");
  });
  it("accepts only directory routes, not arbitrary SEO doorway paths", () => {
    expect(isKnownRoute("/markets/perth")).toBe(true);
    expect(isKnownRoute("/markets/not-a-market")).toBe(false);
    expect(isKnownRoute("/markets/perth/anything")).toBe(false);
  });
  it("renders a 4:5 card from server-selected reporting without a fake score", async () => {
    const input = marketCardInput(file);
    expect(input.format).toBe("market");
    expect(input.context).toContain("Coverage is not an investment ranking");
    expect(await sharp(await renderDeskTakeCard(input)).metadata()).toMatchObject({
      width: 1080,
      height: 1350,
      format: "png",
    });
  });
  it("renders dated official rent evidence in visible HTML and the server-generated card", async () => {
    const withRents = {
      ...file,
      rents: {
        status: "available" as const,
        retrievedAt: "2026-09-07T12:00:00Z",
        observations: [
          { city: "Perth", period: "2026-07", annualPercent: 5.3, status: "p" as const },
        ],
      },
    };
    const html = marketShell(shell, withRents, directory, "https://thedesk.au");
    expect(html).toContain("The pace of rent growth");
    expect(html).toContain("Year to July 2026");
    expect(html).toContain("Preliminary");
    expect(html).toContain("Source observations (CSV)");
    const input = marketCardInput(withRents);
    expect(input.take).toBe("Perth. Annual rent growth.");
    expect(input.figure).toBe("5.3%");
    expect(input.feedDate).toBe("2026-07");
    expect(input.context).toContain("Preliminary");
    expect(await sharp(await renderDeskTakeCard(input)).metadata()).toMatchObject({
      width: 1080,
      height: 1350,
    });
  });
});
