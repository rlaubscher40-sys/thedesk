import { describe, it, expect } from "vitest";
import { socialCampaign } from "./socialCampaign";
import { socialStoryPath, SOCIAL_DESTINATIONS } from "./socialDestinations";
import { foreignHousingHeadline } from "./australianScope";
describe("social destination and attribution boundaries", () => {
  it("retains fixed format labels, never raw identifiers or query content", () => {
    expect(socialCampaign({ source: "instagram", campaign: "property_story_3810011" })).toBe(
      "daily"
    );
    expect(socialCampaign({ source: "instagram", campaign: "sydney_rent_change" })).toBe(
      "rent_change"
    );
    expect(socialCampaign({ source: "instagram", campaign: "person@example.com" })).toBe("other");
    expect(socialCampaign({ source: "google", campaign: "bio" })).toBeUndefined();
    expect(socialCampaign({ source: "instagram", campaign: "__proto__" })).toBe("other");
  });
  it("only opens valid positive story identities on owned routes", () => {
    expect(socialStoryPath("3810011")).toBe("/story/3810011");
    for (const value of ["-1", "0", "//evil.test", "1?token=secret", "1.1", "1234567890123"])
      expect(socialStoryPath(value)).toBeNull();
    expect(
      SOCIAL_DESTINATIONS.every((d) => d.path.startsWith("/markets/") && !d.path.includes("?"))
    ).toBe(true);
  });
  it("excludes known foreign homonyms without matching the pronoun us", () => {
    expect(foreignHousingHeadline("Perth housing approvals", "https://cbc.ca/news/a")).toBe(true);
    expect(foreignHousingHeadline("Sydney rents show us a change")).toBe(false);
    expect(foreignHousingHeadline("NZ rental housing", "https://example.com")).toBe(true);
  });
});
