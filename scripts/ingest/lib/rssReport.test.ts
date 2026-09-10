import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ parseString: vi.fn(), publicFetch: vi.fn() }));
vi.mock("rss-parser", () => ({
  default: class {
    parseString = fixture.parseString;
  },
}));
vi.mock("./publicFetch", () => ({ publicFetch: fixture.publicFetch }));
import { createSourceReader } from "./rss";
let fetchSourceReport = createSourceReader();
const source = {
  name: "Fixture",
  url: "https://example.org/feed",
  category: "PROPERTY" as const,
  channel: "PROPERTY" as const,
  maxItems: 1,
};
beforeEach(() => {
  vi.resetAllMocks();
  fixture.publicFetch.mockImplementation(async () => new Response("<rss />"));
  fetchSourceReport = createSourceReader();
});
it("validates entries before applying the budget and retains headline-only releases", async () => {
  fixture.parseString.mockResolvedValue({
    items: [
      { title: "" },
      {
        title: "Hobart housing approvals rise",
        link: "https://example.org/housing",
      },
    ],
  });
  expect(await fetchSourceReport(source)).toMatchObject({
    fetched: 2,
    error: null,
    items: [{ title: "Hobart housing approvals rise", summary: "" }],
  });
});
it("separates an empty feed from a failed request", async () => {
  fixture.parseString.mockResolvedValue({ items: [] });
  expect(await fetchSourceReport(source)).toMatchObject({
    items: [],
    error: "Feed returned no items",
  });
  // Independent reader: cached empty success is intentionally reusable.
  fetchSourceReport = createSourceReader();
  fixture.parseString.mockRejectedValue(new Error("timeout"));
  expect(await fetchSourceReport(source)).toMatchObject({
    items: [],
    error: "Feed request or parsing failed",
  });
});

it("shares a download across callers but applies each caller's own budget and category", async () => {
  fixture.parseString.mockResolvedValue({
    items: [
      { title: "Hobart housing approvals rise", link: "https://example.org/1" },
      { title: "Perth rental supply rises", link: "https://example.org/2" },
    ],
  });
  const [brief, archive] = await Promise.all([
    fetchSourceReport(source),
    fetchSourceReport({
      ...source,
      name: "Archive",
      maxItems: 100,
      category: "ECONOMICS",
    }),
  ]);
  expect(fixture.parseString).toHaveBeenCalledTimes(2);
  expect(fixture.publicFetch).toHaveBeenCalledTimes(1);
  expect(fixture.publicFetch).toHaveBeenCalledWith(source.url, expect.objectContaining({
    maxBytes: 2 * 1024 * 1024,
    signal: expect.any(AbortSignal),
  }));
  expect(brief.items).toHaveLength(1);
  expect(archive.items).toHaveLength(2);
  expect(archive.items[0]).toMatchObject({
    source: "Archive",
    category: "ECONOMICS",
  });
  expect(archive.checkedAt).toEqual(brief.checkedAt);
  brief.items[0]!.title = "Caller mutation";
  expect((await fetchSourceReport(source)).items[0]!.title).toBe(
    "Hobart housing approvals rise",
  );
});

it("does not cache a rejected destination or bypass the guarded transport on retry", async () => {
  fixture.publicFetch.mockRejectedValueOnce(new Error("Blocked destination"));
  fixture.parseString.mockResolvedValue({ items: [] });
  expect(await fetchSourceReport(source)).toMatchObject({ error: "Feed request or parsing failed" });
  expect(fixture.parseString).not.toHaveBeenCalled();
  expect(await fetchSourceReport(source)).toMatchObject({ error: "Feed returned no items" });
  expect(fixture.publicFetch).toHaveBeenCalledTimes(2);
  expect(fixture.parseString).toHaveBeenCalledTimes(1);
});
