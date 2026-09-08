import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyFeedItem } from "../db/schema";
const m = vi.hoisted(() => ({ render: vi.fn(), rewrite: vi.fn() }));
vi.mock("../og/dailyHookCover", () => ({ renderDailyHookCoverCard: m.render }));
vi.mock("../core/env", () => ({
  env: { instagramAccessToken: "fixture", instagramBusinessAccountId: "fixture" },
}));
vi.mock("../prompts/instagramHeadline", () => ({ generateInstagramHeadline: m.rewrite }));
vi.mock("./socialPublication", () => ({
  recoverSocialPublication: async () => null,
  unpublishedSocialStories: async (stories: unknown[]) => stories,
  publishSocialOnce: vi.fn(),
}));
import { renderPropertyDailyCover } from "./dailyCover";
import { postDailyCarousel } from "./post";
const story = {
  id: 1,
  title: "Brisbane dwelling approvals",
  channel: "PROPERTY",
  category: "PROPERTY",
  source: "ABS",
  feedDate: "2026-09-08",
  summary: "Dwelling approvals",
  whyItMatters: "Approvals are not completed homes.",
  sayThis: "Permission to build is not a move-in date.",
  priority: 50,
} as DailyFeedItem;
beforeEach(() => vi.resetAllMocks());
describe("daily cover publication wiring", () => {
  it("never forwards cached factual inventions or a model rewrite to the automatic cover", async () => {
    m.rewrite.mockResolvedValue("Perth rents fell 5.3%");
    m.render.mockRejectedValue(new Error("Stop before media upload"));
    await expect(
      postDailyCarousel(
        [
          {
            ...story,
            title: "Brisbane rents rose 5.3% in July 2026",
            sayThis: "Perth rents fell 5.3%",
            whyItMatters: "This guarantees higher investment returns.",
          },
        ],
        "https://example.invalid"
      )
    ).rejects.toThrow("Stop before media upload");
    expect(m.rewrite).not.toHaveBeenCalled();
    const cover = m.render.mock.calls[0]![0];
    expect(cover.lead.title).toBe("Brisbane rents rose 5.3% in July 2026");
    expect(cover.lead.whyItMatters).not.toMatch(/guarantees|Perth|5\.3/);
  });
  it.each(["light", "navy"] as const)(
    "passes the recorded %s tone into the real cover path",
    async (variant) => {
      m.render.mockRejectedValue(new Error("Stop before media upload"));
      await expect(
        postDailyCarousel([story], "https://example.invalid", { variant })
      ).rejects.toThrow("Stop before media upload");
      expect(m.render).toHaveBeenCalledWith(
        expect.objectContaining({
          variant,
          feedDate: story.feedDate,
          lead: expect.objectContaining({ title: story.title }),
        })
      );
    }
  );
  it("shares the source-copy preview mapping without inventing or rewriting evidence", async () => {
    m.render.mockResolvedValue(Buffer.from("fixture"));
    await renderPropertyDailyCover([story], "light", [{ label: "Fixture", value: "12" }]);
    expect(m.render).toHaveBeenCalledWith({
      variant: "light",
      feedDate: story.feedDate,
      lead: {
        title: story.title,
        category: story.category,
        source: story.source,
        whyItMatters: story.whyItMatters,
      },
      supporting: [],
      metrics: [{ label: "Fixture", value: "12" }],
    });
  });
});
