import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./lib/post", () => ({ postJSON: vi.fn() }));
vi.mock("./lib/editorialPipeline", () => ({ buildDailyBrief: vi.fn(), briefingSummary: vi.fn(() => "Verified article opening") }));
import { postJSON } from "./lib/post";
import { buildDailyBrief } from "./lib/editorialPipeline";
import { runDailyFeedIngest } from "./dailyFeed";
import { SOURCES } from "./sources";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
it("scopes recovery discovery without disabling duplicate checks or the final publication gate", async () => {
  const sources = SOURCES.filter((source) => source.name === "ABC Mortgages");
  const recentUrls = ["https://www.abc.net.au/news/already-published"];
  const recentStories = [{ title: "Prior reporting", articleText: "Evidence" }];
  vi.mocked(postJSON).mockImplementation(async (url) => url.endsWith("editorial-candidates")
    ? { items: [{ title: "Unrelated evidence candidate" }], recentUrls, recentStories }
    : { count: 1 });
  vi.mocked(buildDailyBrief).mockResolvedValue({ items: [{ title: "Mortgage competition", channel: "PROPERTY", url: "https://www.abc.net.au/news/mortgages", articleText: "Verified evidence", sourceTiming: { publisherPublishedAt: "2026-09-13T18:38:15Z" } }], report: { sources: [], decisions: [], selected: 1, read: 1 } } as never);
  await runDailyFeedIngest("https://thedesk.au/", "test-key", { sources });
  expect(buildDailyBrief).toHaveBeenCalledWith({ sources, extraCandidates: [], recentUrls, recentStories });
  const publication = vi.mocked(postJSON).mock.calls.find(([url]) => url.endsWith("/api/ingest/daily-feed"));
  expect(publication).toBeDefined();
  expect(publication?.[1]).toMatchObject({ items: [{ sourceTiming: { publisherPublishedAt: "2026-09-13T18:38:15Z" }, articleText: "Verified evidence" }] });
});
it("rejects an empty recovery source set", async () => {
  await expect(runDailyFeedIngest("https://thedesk.au", "test-key", { sources: [] })).rejects.toThrow("configured source");
  expect(postJSON).not.toHaveBeenCalled();
});
it("does not submit a story that fails selection", async () => {
  vi.mocked(postJSON).mockResolvedValue({ items: [], recentUrls: [], recentStories: [] });
  vi.mocked(buildDailyBrief).mockResolvedValue({ items: [], report: { sources: [{ error: null }], decisions: [], selected: 0, read: 1 } } as never);
  await runDailyFeedIngest("https://thedesk.au", "test-key", { sources: SOURCES.filter((source) => source.name === "ABC Mortgages") });
  expect(vi.mocked(postJSON).mock.calls.some(([url]) => url.endsWith("/api/ingest/daily-feed"))).toBe(false);
});
