import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../ask/localFacts", () => ({retrieveLocalFacts: vi.fn(async () => [])}));
vi.mock("../db", () => ({
  searchPropertyEvidence: vi.fn(async () => []),
  searchMarketContent: vi.fn(),
}));
import { searchMarketContent } from "../db";
import { retrieveMarketEvidence, marketHousingPassage } from "./evidence";
type Bundle = Awaited<ReturnType<typeof searchMarketContent>>;
const feed = (id: number, title: string, sourceUrl: string) =>
  ({
    id,
    title,
    summary: title,
    sourceUrl,
    source: "Fixture",
    feedDate: "2026-09-01",
  }) as Bundle["feedItems"][number];
beforeEach(() => vi.clearAllMocks());
describe("balanced local market retrieval", () => {
  it("queries full market names separately and deduplicates syndicated sources", async () => {
    vi.mocked(searchMarketContent).mockImplementation(async (query) => ({
      editions: [],
      feedItems:
        query === "Brisbane"
          ? [
              feed(1, "Brisbane rents firm", "https://source.test/brisbane"),
              feed(2, "Brisbane rents firm again", "https://source.test/brisbane"),
            ]
          : [feed(3, "Perth rents firm", "https://source.test/perth")],
    }));
    const sources = await retrieveMarketEvidence("Brisbane", "Perth");
    expect(searchMarketContent).toHaveBeenCalledWith("Brisbane");
    expect(searchMarketContent).toHaveBeenCalledWith("Perth");
    expect(sources).toHaveLength(2);
    expect(sources.map((source) => source.markets)).toEqual([["a"], ["b"]]);
  });
  it("does not count unrelated national metrics or substring matches as local coverage", async () => {
    vi.mocked(searchMarketContent).mockResolvedValue({
      editions: [],
      feedItems: [feed(1, "Perthshire prices rise", "https://source.test/article")],
    });
    expect(await retrieveMarketEvidence("Perth", "Port Macquarie")).toEqual([]);
  });
  it("retains both market passages in a shared long edition without duplicate refs", async () => {
    const edition = {
      id: 1,
      editionNumber: 1,
      weekRange: "Fixture week",
      weekOf: "2026-09-01",
      fullText:
        "Brisbane house rents rise. " +
        "Other news. ".repeat(500) +
        "Perth housing supply tightens.",
    } as Bundle["editions"][number];
    vi.mocked(searchMarketContent).mockResolvedValue({ editions: [edition], feedItems: [] });
    const sources = await retrieveMarketEvidence("Brisbane", "Perth");
    expect(sources).toHaveLength(1);
    expect(sources[0]?.markets).toEqual(["a", "b"]);
    expect(sources[0]?.text).toContain("Brisbane house rents rise.");
    expect(sources[0]?.text).toContain("Perth housing supply tightens.");
  });
  it("does not let newer city news consume housing source slots", async () => {
    vi.mocked(searchMarketContent).mockResolvedValue({
      editions: [],
      feedItems: [
        feed(1, "Brisbane Broncos suffer their 15th loss", "https://source.test/1"),
        feed(2, "Brisbane sunshine delivers hot weather", "https://source.test/2"),
        feed(3, "Brisbane man killed after dating app set-up", "https://source.test/3"),
        feed(4, "Perth campus wins construction award", "https://source.test/4"),
        feed(5, "Perth hospital construction begins", "https://source.test/5"),
        feed(6, "Brisbane housing supply tightens", "https://source.test/6"),
        feed(7, "Perth house prices fall", "https://source.test/7"),
      ],
    });
    const result = await retrieveMarketEvidence("Brisbane", "Perth");
    expect(result.map((row) => row.href)).toEqual(["/story/6", "/story/7"]);
  });
  it("finds a later housing mention in an edition rather than its opening sports story", () => {
    const text =
      "Brisbane Broncos lose. " + "Other news. ".repeat(70) + "Brisbane rents rose in July.";
    expect(marketHousingPassage(text, "Brisbane")).toContain("Brisbane rents rose");
    expect(marketHousingPassage(text, "Brisbane")).not.toContain("Broncos");
    expect(
      marketHousingPassage(
        "Brisbane Broncos lose. " + "Other news. ".repeat(70) + "Sydney rents rise.",
        "Brisbane"
      )
    ).toBeNull();
  });
});
