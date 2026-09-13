import { expect, it } from "vitest";
import { editorialCategory } from "./editorialCategory";
it("keeps a routine football result out of geopolitics", () => {
  expect(
    editorialCategory("Football full-time score: Sydney wins", "Match report", "GEOPOLITICS")
  ).toBe("OTHER");
});
it("retains political reporting involving sport", () => {
  expect(
    editorialCategory(
      "Football sanctions debated by parliament",
      "Government legislation",
      "GEOPOLITICS"
    )
  ).toBe("GEOPOLITICS");
});
