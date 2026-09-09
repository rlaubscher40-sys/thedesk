import { expect, it } from "vitest";
import { feedClaimIdentity } from "./feedClaims";
const item = {
  title: "Market update",
  source: "Publisher",
  sourceUrl: "https://news.test/Story?id=1",
  channel: "AU",
  feedDate: "2026-09-09",
};
it("shares URL identity across workers, channels and dates but preserves content IDs", () => {
  expect(feedClaimIdentity(item)).toBe(
    feedClaimIdentity({
      ...item,
      channel: "PROPERTY",
      feedDate: "2026-09-10",
      sourceUrl: item.sourceUrl + "&utm_source=ig",
    })
  );
  expect(feedClaimIdentity(item)).not.toBe(
    feedClaimIdentity({ ...item, sourceUrl: "https://news.test/Story?id=2" })
  );
});
it("keeps URL-less generic headlines scoped to the publisher and publication day", () => {
  const row = { ...item, sourceUrl: null };
  expect(feedClaimIdentity(row)).not.toBe(
    feedClaimIdentity({ ...row, source: "Another publisher" })
  );
  expect(feedClaimIdentity(row)).not.toBe(feedClaimIdentity({ ...row, feedDate: "2026-09-10" }));
});
