import { testSourceTiming } from "./testSourceTiming";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyFeedItem, Edition } from "../db/schema";
const m = vi.hoisted(() => ({
  read: vi.fn(),
  reserve: vi.fn(),
  confirm: vi.fn(),
  feed: vi.fn(),
  image: vi.fn(),
  parent: vi.fn(),
  publish: vi.fn(),
  recent: vi.fn(),
  render: vi.fn(),
}));
vi.mock("../db/socialPublication", () => ({
  readSocialRecords: m.read,
  reserveSocialRecords: m.reserve,
  confirmSocialRecords: m.confirm,
}));
vi.mock("../db/feed", () => ({ getFeedItemsByIds: m.feed }));
vi.mock("../db/health", () => ({ recordServerError: async () => {} }));
vi.mock("../core/env", () => ({
  env: { instagramAccessToken: "fixture", instagramBusinessAccountId: "fixture" },
}));
vi.mock("../og/briefingCards", () => ({ renderBriefingSlide: m.render }));
vi.mock("./dailyCover", () => ({ renderPropertyDailyCover: m.render }));
vi.mock("../og/instagramCards", () => ({
  renderDailyStoryCard: m.render,
  renderWeeklyCoverCard: m.render,
  renderWeeklyTopicCard: m.render,
  renderWeeklyStoryVertical: async () => {
    throw new Error("No test Story");
  },
  renderDailyStoryVertical: async () => {
    throw new Error("No test Story");
  },
}));
vi.mock("./api", () => ({
  createImageContainer: m.image,
  createCarouselContainer: m.parent,
  publishContainer: m.publish,
  findRecentMedia: m.recent,
  waitForContainerReady: async () => {},
  isRateLimitError: () => true,
}));
import { postDailyCarousel, postWeeklyEdition } from "./post";
const story = {
  sourceTiming: testSourceTiming(),
  id: 1,
  feedDate: "2026-09-08",
  title: "Sydney rents rose 3.5% in July 2026",
  summary: "Rents paid changed, not advertised rent levels.",
  source: "ABS",
  sourceUrl: "https://www.abs.gov.au/rents",
  channel: "PROPERTY",
  category: "PROPERTY",
  priority: 50,
} as DailyFeedItem;
const edition = {
  editionNumber: 12,
  weekOf: "2026-09-07",
  weekRange: "7–13 September 2026",
  topics: [
    {
      title: "Perth prices will double",
      summary: "Invented implication",
      category: "PROPERTY",
      sourceItemIds: [1],
    },
  ],
} as Edition;
beforeEach(() => {
  vi.resetAllMocks();
  m.read.mockResolvedValue([]);
  m.feed.mockResolvedValue([story]);
  m.render.mockResolvedValue(Buffer.from("image"));
  m.image.mockResolvedValue("11");
  m.parent.mockResolvedValue("22");
  m.publish.mockResolvedValue("123");
});
describe("real social publishers use provenance and durable identities", () => {
  it("weekly renders and captions the actual source, not the model's changed city/claim", async () => {
    expect(await postWeeklyEdition(edition, "https://thedesk.au", "light")).toMatchObject({
      postId: "123",
      coverVariant: "light",
    });
    expect(m.parent.mock.calls[0]![0].caption).toContain("Source: ABS · Briefing 2026-09-08");
    expect(m.parent.mock.calls[0]![0].caption).toContain("https://www.abs.gov.au/rents");
    expect(m.parent.mock.calls[0]![0].caption).not.toMatch(/Perth|double/);
    expect(m.reserve).toHaveBeenCalledOnce();
    expect(m.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      m.publish.mock.invocationCallOrder[0]!
    );
    expect(m.confirm).toHaveBeenCalledOnce();
  });
  it.each([null, { ...testSourceTiming(), publisherPublishedAt: "2026-04-01T00:00:00Z" }])(
    "holds missing or stale source timing before upload: %j",
    async (sourceTiming) => {
      await expect(
        postDailyCarousel([{ ...story, sourceTiming }], "https://thedesk.au")
      ).rejects.toThrow();
      m.feed.mockResolvedValue([{ ...story, sourceTiming }]);
      await expect(postWeeklyEdition(edition, "https://thedesk.au")).rejects.toThrow(
        "source-attributed"
      );
      expect(m.image).not.toHaveBeenCalled();
      expect(m.reserve).not.toHaveBeenCalled();
      expect(m.publish).not.toHaveBeenCalled();
    }
  );
  it("daily rendering failures consume no publication reservation", async () => {
    m.render.mockRejectedValue(new Error("renderer unavailable"));
    await expect(postDailyCarousel([story], "https://thedesk.au")).rejects.toThrow(
      "renderer unavailable"
    );
    expect(m.reserve).not.toHaveBeenCalled();
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("daily and weekly never guess success from unrelated recent media after Meta errors", async () => {
    m.publish.mockRejectedValue(new Error("Meta response lost"));
    m.recent.mockResolvedValue("999");
    await expect(postDailyCarousel([story], "https://thedesk.au")).rejects.toThrow(
      "Meta response lost"
    );
    await expect(postWeeklyEdition(edition, "https://thedesk.au")).rejects.toThrow(
      "Meta response lost"
    );
    expect(m.recent).not.toHaveBeenCalled();
    expect(m.confirm).not.toHaveBeenCalled();
  });
  it("an exact completed slot recovers its original colour without rendering or publishing", async () => {
    m.read.mockResolvedValue([
      {
        status: "success",
        detail: JSON.stringify({ postId: "123", headline: "Original", coverVariant: "light" }),
      },
    ]);
    expect(
      await postDailyCarousel([story], "https://thedesk.au", { variant: "navy" })
    ).toMatchObject({ postId: "123", coverVariant: "light" });
    expect(m.render).not.toHaveBeenCalled();
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("weekly holds legacy editions with no source IDs before media upload", async () => {
    await expect(
      postWeeklyEdition(
        { ...edition, topics: edition.topics.map((t) => ({ ...t, sourceItemIds: undefined })) },
        "https://thedesk.au"
      )
    ).rejects.toThrow("source-attributed");
    expect(m.image).not.toHaveBeenCalled();
    expect(m.publish).not.toHaveBeenCalled();
  });
});
