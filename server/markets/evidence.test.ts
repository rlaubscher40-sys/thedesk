import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../db", () => ({ searchAllContent: vi.fn() }));
import { searchAllContent } from "../db";
import { retrieveMarketEvidence } from "./evidence";
type Bundle = Awaited<ReturnType<typeof searchAllContent>>;
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
    vi.mocked(searchAllContent).mockImplementation(async (query) => ({
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
    expect(searchAllContent).toHaveBeenCalledWith("Brisbane", { housingOnly: true });
    expect(searchAllContent).toHaveBeenCalledWith("Perth", { housingOnly: true });
    expect(sources).toHaveLength(2);
    expect(sources.map((source) => source.markets)).toEqual([["a"], ["b"]]);
  });
  it("does not count unrelated national metrics or substring matches as local coverage", async () => {
    vi.mocked(searchAllContent).mockResolvedValue({
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
    vi.mocked(searchAllContent).mockResolvedValue({ editions: [edition], feedItems: [] });
    const sources = await retrieveMarketEvidence("Brisbane", "Perth");
    expect(sources).toHaveLength(1);
    expect(sources[0]?.markets).toEqual(["a", "b"]);
    expect(sources[0]?.text).toContain("Brisbane house rents rise.");
    expect(sources[0]?.text).toContain("Perth housing supply tightens.");
  });
});

describe("housing evidence regressions", () => {
  it("does not let newer football, weather or crime mentions use the four-source budget", async () => {
    vi.mocked(searchAllContent).mockImplementation(async (city) => ({
      editions: [],
      feedItems: [
        ...Array.from({ length: 55 }, (_, i) =>
          feed(
            i + 10,
            `${city} ${["football team wins at home", "weather forecast brings rain", "police investigate property crime"][i % 3]}`,
            `https://news.test/${city}/${i}`
          )
        ),
        feed(1, `${city} rents rise as housing supply tightens`, `https://housing.test/${city}`),
      ],
    }));
    const sources = await retrieveMarketEvidence("Brisbane", "Perth");
    expect(sources).toHaveLength(2);
    expect(sources.every((source) => source.title.includes("rents rise"))).toBe(true);
  });
  it("finds later local housing coverage without borrowing another city's evidence", async () => {
    const { marketPassage } = await import("./evidence");
    expect(marketPassage("Perth won at home. Sydney rents rose 5%.", "Perth")).toBeNull();
    expect(
      marketPassage(
        "Perth won at home. Sydney rents rose 5%. Perth housing completions fell.",
        "Perth"
      )
    ).toBe("Perth housing completions fell.");
  });
});
