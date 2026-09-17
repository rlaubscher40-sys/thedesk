import { beforeEach, expect, it, vi } from "vitest";
const reads = vi.hoisted(() => ({ carousels: vi.fn(), reels: vi.fn() }));
vi.mock("../db/socialPublication", () => ({ recentSocialReceipts: reads.carousels }));
vi.mock("../db/reelHistory", () => ({ readReelPublicationHistory: reads.reels }));
vi.mock("../core/env", () => ({ env: { instagramAccessToken: "" } }));
import { publicMediaFields, publicPostGallery, reelEvidenceLink } from "./publicPostGallery";
import { REEL_PUBLICATION_FAMILIES } from "./reelCandidates";
import { RETIRED_DOCUMENTARY_PUBLICATIONS } from "./documentaryEpisodes";

beforeEach(() => {
  reads.carousels.mockReset().mockResolvedValue([]);
  reads.reels.mockReset().mockResolvedValue([]);
});

it("provides evidence destinations for every active publishing format", () => {
  const retired = new Set<string>(RETIRED_DOCUMENTARY_PUBLICATIONS.map((r) => r.publication.key));
  for (const key of Object.keys(REEL_PUBLICATION_FAMILIES).filter((key) => !retired.has(key))) {
    expect(reelEvidenceLink(key), key).toMatchObject({
      title: expect.any(String),
      path: expect.stringMatching(/^\/(?:markets|social)/),
    });
  }
  expect(reelEvidenceLink("instagram-reel-abs-melbourne-before-buy-v1")?.path).toBe(
    "/markets/melbourne#housing-approvals"
  );
  expect(reelEvidenceLink("instagram-reel-documentary-triguboff-apartments-v1")?.path).toBe(
    "/social#triguboff-apartments"
  );
  expect(reelEvidenceLink("toString")).toBeUndefined();
  expect(reelEvidenceLink("unregistered-draft")).toBeUndefined();
});

it("includes the latest confirmed capital Reel even when its thumbnail is unavailable", async () => {
  reads.reels.mockResolvedValue([
    {
      key: "instagram-reel-abs-melbourne-before-buy-v1",
      date: "2026-07-01",
      postId: "17908474461521259",
      publishedAt: new Date("2026-09-16T08:36:19Z"),
    },
    {
      key: "instagram-reel-abs-sydney-before-buy-v1",
      date: "2026-07-01",
      postId: "2",
      publishedAt: new Date("2026-09-13T08:36:19Z"),
    },
  ]);
  const posts = await publicPostGallery(new Date("2026-09-17T00:00:00Z"));
  expect(posts.map((post) => post.id)).toEqual(["17908474461521259", "2"]);
  expect(posts[0]).toMatchObject({
    thumbnail: null,
    permalink: null,
    reference: "2026-07-01",
    links: [{ title: "Read the evidence", path: "/markets/melbourne#housing-approvals" }],
  });
});

it("does not manufacture publication from unknown, future or old receipts", async () => {
  reads.reels.mockResolvedValue([
    {
      key: "unregistered-draft",
      date: "2026-07-01",
      postId: "1",
      publishedAt: new Date("2026-09-16T08:00:00Z"),
    },
    {
      key: "instagram-reel-abs-brisbane-before-buy-v1",
      date: "2026-07-01",
      postId: "2",
      publishedAt: new Date("2026-09-18T08:00:00Z"),
    },
    {
      key: "instagram-reel-abs-perth-before-buy-v1",
      date: "2026-06-01",
      postId: "3",
      publishedAt: new Date("2026-08-01T08:00:00Z"),
    },
  ]);
  expect(await publicPostGallery(new Date("2026-09-17T00:00:00Z"))).toEqual([]);
});
it("uses the published video thumbnail and projects only safe public fields", () => {
  expect(
    publicMediaFields({
      media_type: "VIDEO",
      thumbnail_url: "https://scontent.cdninstagram.com/cover.jpg",
      media_url: "https://scontent.cdninstagram.com/reel.mp4",
      caption: "The actual published hook\nExtra text",
      permalink: "https://www.instagram.com/reel/ABC/",
      access_token: "private",
    })
  ).toEqual({
    thumbnail: "https://scontent.cdninstagram.com/cover.jpg",
    captionTitle: "The actual published hook",
    permalink: "https://www.instagram.com/reel/ABC/",
  });
});
it("does not expose arbitrary image destinations or guessed post links", () => {
  expect(
    publicMediaFields({
      media_url: "https://cdninstagram.com.evil.test/image",
      permalink: "javascript:alert(1)",
    })
  ).toMatchObject({ thumbnail: null, permalink: null });
});
