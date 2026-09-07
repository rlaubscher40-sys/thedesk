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
    expect(searchAllContent).toHaveBeenCalledWith("Brisbane");
    expect(searchAllContent).toHaveBeenCalledWith("Perth");
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
