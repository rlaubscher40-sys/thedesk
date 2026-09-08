import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ parseURL: vi.fn() }));
vi.mock("rss-parser", () => ({
  default: class {
    parseURL = fixture.parseURL;
  },
}));
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
  vi.clearAllMocks();
  fetchSourceReport = createSourceReader();
});
it("validates entries before applying the budget and retains headline-only releases", async () => {
  fixture.parseURL.mockResolvedValue({
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
  fixture.parseURL.mockResolvedValue({ items: [] });
  expect(await fetchSourceReport(source)).toMatchObject({
    items: [],
    error: null,
  });
  // Independent reader: cached empty success is intentionally reusable.
  fetchSourceReport = createSourceReader();
  fixture.parseURL.mockRejectedValue(new Error("timeout"));
  expect(await fetchSourceReport(source)).toMatchObject({
    items: [],
    error: "Feed request or parsing failed",
  });
});

it("shares a download across callers but applies each caller's own budget and category", async () => {
  fixture.parseURL.mockResolvedValue({
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
  expect(fixture.parseURL).toHaveBeenCalledTimes(1);
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
