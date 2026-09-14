import { expect, it, vi } from "vitest";
const fetcher = vi.hoisted(() => vi.fn());
vi.mock("./publicFetch", () => ({ publicFetch: fetcher }));
import { fetchArticle } from "./article";
import { sourceRightsHold } from "../../../shared/sourceRights";
import { buildDailyBrief } from "./editorialPipeline";
it("holds restricted publishers including subdomains without reading their articles", async () => {
  for (const url of [
    "https://www.theguardian.com/a",
    "https://abc.net.au/news/a",
    "https://www.abc.net.au./news/a",
  ]) {
    expect(sourceRightsHold(url)).toMatch(/^source-rights-review:/);
    expect((await fetchArticle(url)).fetchFailure).toMatch(/^source-rights-review:/);
  }
  expect(fetcher).not.toHaveBeenCalled();
  expect(sourceRightsHold("https://abc.net.au.example.com/a")).toBeNull();
  expect(sourceRightsHold("https://www.abs.gov.au/a")).toBeNull();
});
it("applies the rights check to redirect destinations as well", async () => {
  fetcher.mockImplementationOnce(async (_url, options) => {
    options.beforeRequest(new URL("https://www.theguardian.com/article"));
  });
  expect(await fetchArticle("https://www.abs.gov.au/link")).toMatchObject({
    text: null,
    fetchFailure: "source-rights-review:guardian",
  });
});
it("records the rights hold before an injected article reader or AI processing", async () => {
  const readArticle = vi.fn();
  const result = await buildDailyBrief({
    now: new Date("2026-09-14T04:00:00Z"),
    sources: [
      {
        name: "Synthetic",
        url: "https://www.abc.net.au/feed",
        category: "PROPERTY",
        channel: "PROPERTY",
      },
    ],
    readSource: async () => ({
      fetched: 1,
      error: null,
      items: [
        {
          title: "Australian housing approvals fall",
          summary: "Australian housing supply tightens",
          source: "ABC",
          url: "https://www.abc.net.au/news/housing",
          category: "PROPERTY",
          channel: "PROPERTY",
          isoDate: "2026-09-14T01:00:00Z",
          imageUrl: null,
        },
      ],
    }),
    resolve: async (u) => u,
    readArticle,
  });
  expect(readArticle).not.toHaveBeenCalled();
  expect(result.items).toEqual([]);
  expect(result.report.decisions[0]?.reason).toBe("source-rights-review:abc");
});
