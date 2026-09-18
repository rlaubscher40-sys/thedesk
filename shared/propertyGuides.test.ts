import { expect, it } from "vitest";
import { guideForStory, PROPERTY_GUIDES, guideArchiveHref } from "./propertyGuides";
it("selects the headline subject and preserves housing tenure distinctions", () => {
  expect(guideForStory("Public housing rents change", "PROPERTY")?.slug).toBe("housing-tenure");
  expect(guideForStory("180 new social homes in Hurstville", "AU")?.slug).toBe("housing-tenure");
  expect(guideForStory("Home loan rates rise", "AU")?.slug).toBe("interest-rates");
  expect(guideForStory("CPI rents growth slows", "AU")?.slug).toBe("rents");
  expect(guideForStory("Home prices rise", "INTERNATIONAL")).toBeUndefined();
  expect(guideForStory("Rental rights reform", "AU")).toBeUndefined();
  expect(guideForStory("Rent reforms announced", "AU")).toBeUndefined();
  expect(guideForStory("Bridge construction begins", "AU")).toBeUndefined();
  expect(guideForStory("Parents welcome the school", "AU")).toBeUndefined();
});
it("gives each guide a distinct destination and an Australian archive query", () => {
  expect(new Set(PROPERTY_GUIDES.map((g) => g.slug)).size).toBe(PROPERTY_GUIDES.length);
  for (const guide of PROPERTY_GUIDES) {
    const url = new URL(guideArchiveHref(guide), "https://thedesk.au");
    expect(url.searchParams.get("region")).toBe("AU");
    expect(url.searchParams.get("q")).toBe(guide.search);
    expect(guide.source.url).toMatch(/^https:/);
  }
});
