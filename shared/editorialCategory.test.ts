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

it("does not turn a broad live blog or a nuclear facility into property reporting", () => {
  expect(
    editorialCategory(
      "Australia news LIVE: Joyce backs inquiry; UN watchdog warns Iran",
      "Sites housing nuclear activities were inspected.",
      "PROPERTY"
    )
  ).toBe("OTHER");
  expect(
    editorialCategory(
      "UN watchdog warns Iran",
      "A facility housing nuclear equipment was inspected.",
      "PROPERTY"
    )
  ).toBe("OTHER");
  expect(
    editorialCategory("Housing news live: NSW planning reforms", "More homes approved", "PROPERTY")
  ).toBe("PROPERTY");
  expect(
    editorialCategory(
      "New land release in western Sydney",
      "The next stage opens tomorrow",
      "PROPERTY"
    )
  ).toBe("PROPERTY");
});
