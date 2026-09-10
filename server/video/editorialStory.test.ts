import { describe, expect, it } from "vitest";
import { HOUSING_BALANCE_SNAPSHOT } from "../../shared/housingBalance";
import {
  housingBalanceStoryboard,
  validateHousingBalanceStoryboard,
} from "./housingBalanceStoryboard";
import { assertEditorialStory } from "./editorialStory";

describe("story before graphics", () => {
  it.each(["finding", "explanation", "consequence", "takeaway"] as const)(
    "rejects a missing %s or a beat that exists only in production notes",
    (name) => {
      const story = housingBalanceStoryboard(HOUSING_BALANCE_SNAPSHOT);
      const keys = story.scenes.map((s) => s.key);
      const missing = structuredClone(story.editorial);
      missing[name].statement = " ";
      expect(() => assertEditorialStory(missing, keys)).toThrow();
      const detached = structuredClone(story.editorial);
      detached[name].sceneKeys = ["not-in-the-reel"];
      expect(() => assertEditorialStory(detached, keys)).toThrow();
    }
  );
  it("rejects a changed editorial claim even when the old speech still matches", () => {
    const story = housingBalanceStoryboard(HOUSING_BALANCE_SNAPSHOT);
    const script = story.scenes.map(({ key, text }) => ({ key, text }));
    story.editorial.takeaway.statement = "Prices will always rise.";
    expect(() => validateHousingBalanceStoryboard(story, script)).toThrow("evidence");
  });
});
