import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ parseURL: vi.fn() }));
vi.mock("rss-parser", () => ({
  default: class {
    parseURL = fixture.parseURL;
  },
}));
import { fetchSourceReport } from "./rss";
const source = {
  name: "Fixture",
  url: "https://example.org/feed",
  category: "PROPERTY" as const,
  channel: "PROPERTY" as const,
  maxItems: 1,
};
beforeEach(() => vi.clearAllMocks());
it("validates entries before applying the budget and retains headline-only releases", async () => {
  fixture.parseURL.mockResolvedValue({
    items: [
      { title: "" },
      { title: "Hobart housing approvals rise", link: "https://example.org/housing" },
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
  expect(await fetchSourceReport(source)).toMatchObject({ items: [], error: null });
  fixture.parseURL.mockRejectedValue(new Error("timeout"));
  expect(await fetchSourceReport(source)).toMatchObject({
    items: [],
    error: "Feed request or parsing failed",
  });
});
