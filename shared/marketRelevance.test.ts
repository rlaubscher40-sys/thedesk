import { describe, expect, it } from "vitest";
import { hasHousingEvidence } from "./marketRelevance";
describe("housing topic selection", () => {
  it.each([
    "Brisbane Broncos season plunges further with 15th loss",
    "Spring sunshine to deliver hot weather for south-east Queensland",
    "Young dad turns to music to deal with son's NICU journey in Brisbane",
    "Perth city campus wins major construction award",
    "Construction begins on Mandurah hospital south of Perth",
    "Brisbane man identified after alleged dating app attack",
    "Construction begins on Perth's first electric ferry fleet",
    "Perthshire parents win award",
  ])("rejects city news: %s", (title) => expect(hasHousingEvidence(title)).toBe(false));
  it.each([
    "Brisbane house prices fall",
    "Perth rental vacancy hits a low",
    "Thousands more Perth properties to be subdivided",
    "Brisbane housing supply tightens",
    "Negative gearing shift traps Perth investors in a supply squeeze",
    "Perth building approvals rise",
    "Brisbane residential construction pipeline expands",
    "Perth mortgage arrears rise",
    "Home loans in Brisbane",
    "Perth rents increase",
  ])("retains housing evidence: %s", (title) => expect(hasHousingEvidence(title)).toBe(true));
});
