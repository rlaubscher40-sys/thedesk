import { expect, it } from "vitest";
import { narrativeRecentlyPublished, reelNarrativeAngle } from "./reelVariety";
it("treats another city and a comparison as the same approvals narrative", () => {
  const history = [
    {
      key: "instagram-reel-abs-sydney-before-buy-v1",
      publishedAt: new Date("2026-09-15T09:00:00Z"),
    },
  ];
  const now = new Date("2026-09-18T09:00:00Z");
  expect(narrativeRecentlyPublished("instagram-reel-abs-perth-before-buy-v1", history, now)).toBe(
    true
  );
  expect(
    narrativeRecentlyPublished("instagram-reel-abs-approvals-brisbane-perth-v1", history, now)
  ).toBe(true);
  expect(narrativeRecentlyPublished("instagram-reel-nhsac-housing-balance-v1", history, now)).toBe(
    false
  );
  expect(
    narrativeRecentlyPublished(
      "instagram-reel-abs-perth-before-buy-v1",
      history,
      new Date("2026-09-22T09:00:00Z")
    )
  ).toBe(false);
});
it("leaves documentary slots to their existing approval and schedule guards", () => {
  expect(reelNarrativeAngle("instagram-reel-documentary-triguboff-apartments-v1")).toBeNull();
});
