import { expect, it } from "vitest";
import { shouldShowSummary } from "./headline";
import { evidenceText } from "./evidenceQuality";
it("suppresses the live portfolio-only summary in readers and retrieval", () => {
  const title = "167 new homes fast-tracked across North West Queensland",
    summary =
      "Deputy Premier, Minister for State Development, Infrastructure and Planning and Minister for Industrial Relations The Honourable Jarrod Bleijie";
  expect(shouldShowSummary(title, summary)).toBe(false);
  expect(evidenceText({ title, summary }).summary).toBe("");
  expect(
    shouldShowSummary(
      title,
      "Deputy Premier Jarrod Bleijie announced funding for housing infrastructure."
    )
  ).toBe(true);
});
