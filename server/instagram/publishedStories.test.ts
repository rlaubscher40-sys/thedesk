import { describe, expect, it, vi } from "vitest";
import type { DailyFeedItem } from "../db/schema";
import { testSourceTiming } from "./testSourceTiming";
import { publishedSocialStories } from "./publishedStories";

const now = new Date("2026-09-09T10:00:00Z");
const story = (id: number) =>
  ({
    id,
    title: `Sydney rents rise ${id}%`,
    source: "ABS",
    sourceUrl: "https://abs.gov.au/rents",
    feedDate: "2026-09-08",
    sourceTiming: testSourceTiming(),
    channel: "PROPERTY",
    category: "PROPERTY",
    summary: null,
    priority: 50,
    rubensNote: "Private fields are never projected",
    sayThis: "Unvalidated angle",
  }) as DailyFeedItem;
const receipt = (storyIds: number[], finishedAt = new Date("2026-09-09T09:00:00Z")) => ({
  detail: JSON.stringify({
    postId: "123",
    headline: "Old cover",
    storyIds,
    token: "must not leak",
  }),
  finishedAt,
});

describe("confirmed carousel reading links", () => {
  it("uses recorded IDs and order, not today's selection, and exposes only public link fields", async () => {
    const read = vi.fn().mockResolvedValue([story(1), story(2), story(99)]);
    const result = await publishedSocialStories(async () => [receipt([2, 1])], read, now);
    expect(read).toHaveBeenCalledWith([2, 1]);
    expect(result.map((x) => x.id)).toEqual([2, 1]);
    expect(Object.keys(result[0]!).sort()).toEqual([
      "id",
      "path",
      "publishedAt",
      "source",
      "title",
    ]);
    expect(result[0]!.path).toContain("https://thedesk.au/story/2?utm_source=instagram");
    expect(JSON.stringify(result)).not.toMatch(
      /must not leak|Private fields|Unvalidated angle|postId/
    );
  });
  it("never guesses missing references in legacy, malformed or oversized receipts", async () => {
    const read = vi.fn();
    const invalid = [
      "broken",
      JSON.stringify({ postId: "123", headline: story(1).title }),
      JSON.stringify({ postId: "unknown", storyIds: [1] }),
      JSON.stringify({ postId: "123", storyIds: [-1] }),
      "x".repeat(4097),
    ];
    expect(
      await publishedSocialStories(
        async () => invalid.map((detail) => ({ detail, finishedAt: now })),
        read,
        now
      )
    ).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });
  it("omits missing, off-topic and undated sources without substituting another story", async () => {
    const rows = [
      story(1),
      { ...story(2), sourceTiming: null },
      { ...story(3), title: "The US cities where home prices fall", source: "Fox Business" },
    ];
    const result = await publishedSocialStories(
      async () => [receipt([4, 2, 3, 1])],
      async () => rows,
      now
    );
    expect(result.map((x) => x.id)).toEqual([1]);
  });
  it("rejects future, invalid and expired timestamps; deduplicates by latest confirmed publication", async () => {
    const result = await publishedSocialStories(
      async () => [
        receipt([1], new Date("2026-09-08T10:00:00Z")),
        receipt([1, 2]),
        receipt([3], new Date("2026-09-10")),
        receipt([4], new Date("2026-07-01")),
        receipt([5], new Date("bad")),
      ],
      async () => [1, 2, 3, 4, 5].map(story),
      now
    );
    expect(result.map((x) => x.id)).toEqual([1, 2]);
    expect(result[0]!.publishedAt.toISOString()).toBe("2026-09-09T09:00:00.000Z");
  });
  it("propagates a storage failure so the UI can show a fallback, not false publication history", async () => {
    await expect(
      publishedSocialStories(
        async () => {
          throw new Error("DB unavailable");
        },
        vi.fn(),
        now
      )
    ).rejects.toThrow("DB unavailable");
  });
});
