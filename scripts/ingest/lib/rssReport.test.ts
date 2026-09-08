import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ parseString: vi.fn() }));
vi.mock("rss-parser", () => ({
  default: class {
    parseString = fixture.parseString;
  },
}));
vi.mock("./publicFetch", () => ({ publicFetch: async () => new Response("<rss />") }));
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
  fixture.parseString.mockResolvedValue({
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
  fixture.parseString.mockResolvedValue({ items: [] });
  expect(await fetchSourceReport(source)).toMatchObject({ items: [], error: null });
  fixture.parseString.mockRejectedValue(new Error("timeout"));
  expect(await fetchSourceReport(source)).toMatchObject({
    items: [],
    error: "Feed request or parsing failed",
  });
});
