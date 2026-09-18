import { expect, it } from "vitest";
import { REVIEWED_STORY_CORRECTIONS } from "./reviewedStoryCorrections";

it("keeps each correction tied to one story and each field to one exact prior value", () => {
  expect(new Set(REVIEWED_STORY_CORRECTIONS.map((c) => c.id)).size).toBe(
    REVIEWED_STORY_CORRECTIONS.length
  );
  for (const correction of REVIEWED_STORY_CORRECTIONS) {
    expect(new URL(correction.sourceUrl).protocol).toBe("https:");
    expect(new Set(correction.fields.map((f) => f.field)).size).toBe(correction.fields.length);
    for (const field of correction.fields) expect(field.before.trim()).not.toBe("");
  }
});

it.each([3960015, 3960030])("reviews talking points and reader angles as well as the summary for %s", (id) => {
  const correction = REVIEWED_STORY_CORRECTIONS.find((c) => c.id === id)!;
  expect(correction.fields.some((f) => f.field === "summary")).toBe(true);
  expect(correction.fields.find((f) => f.field === "partnerTag")?.after).toBeNull();
  const line = correction.fields.find((f) => f.field === "sayThis")!;
  expect(line.after).toBeTruthy();
  expect(line.after).not.toBe(line.before);
  expect(correction.now).toContain("already distributed copies are not rewritten");
});
