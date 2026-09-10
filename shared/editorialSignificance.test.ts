import { describe, expect, it } from "vitest";
import { editorialPriority, discoveryScore } from "./editorial";
import { storySignificance } from "./editorialSignificance";

const rank = (title: string, sourceUrl = "https://www.abc.net.au/news/example") =>
  editorialPriority({ title, sourceUrl });

describe("editorial significance", () => {
  // Audited headlines; preference labels are editorial regression choices,
  // not a human-reviewed recall or accuracy benchmark.
  it.each([
    [
      "Value of dwellings falls 0.3%",
      "https://www.abs.gov.au/media-centre/media-releases/value-dwellings-falls-03",
    ],
    [
      "226 new social homes for Western Sydney families",
      "https://www.nsw.gov.au/ministerial-releases/226-new-social-homes-for-western-sydney-families",
    ],
    [
      "Perfect storm: How banks allegedly defrauded of up to $600m",
      "https://www.abc.net.au/news/example",
    ],
  ])("ranks a concrete development above a specialist product partnership: %s", (title, url) => {
    expect(rank(title, url)).toBeGreaterThan(
      rank(
        "Mortgage Choice partners with Skip on new low-deposit loan",
        "https://www.mpamag.com/au/news/example"
      )
    );
    expect(rank(title, url)).toBeGreaterThan(
      rank(
        "What do mortgage brokers think about diversity, equity and inclusion?",
        "https://www.mpamag.com/au/news/example"
      )
    );
  });

  it.each([
    "RBA could cut the cash rate this month",
    "Will the RBA cut interest rates?",
    "Banks expect the RBA to hold rates",
    "Housing groups call for 226 new social homes",
    "NSW could deliver 226 new social homes",
    "RBA governor discusses interest rate cuts",
    "RBA rules out interest rate cuts",
    "RBA holds press conference on housing",
  ])("does not rank a proposal or prediction as a confirmed development: %s", (title) => {
    expect(rank(title)).toBeLessThan(rank("RBA holds cash rate unchanged"));
    expect(rank(title)).toBeLessThan(rank("226 new social homes for Western Sydney families"));
  });

  it("does not let a primary publisher's generic interview outrank a housing development", () => {
    expect(
      rank("Interview with ABC Radio", "https://www.rba.gov.au/speeches/example")
    ).toBeLessThan(
      rank("226 new social homes for Western Sydney families", "https://www.nsw.gov.au/example")
    );
  });

  it("does not use background, summaries, arbitrary numbers or source labels as impact evidence", () => {
    const input = {
      title: "Australian mortgage brokers discuss their work",
      sourceUrl: "https://www.mpamag.com/au/news/example",
    };
    expect(
      editorialPriority({
        ...input,
        summary: "RBA cuts cash rate",
        articleText: "RBA cuts cash rate 25 times. ".repeat(300),
        source: "ABS Treasury",
      })
    ).toBe(editorialPriority(input));
    expect(rank(`${input.title} in 2026`)).toBe(rank(input.title));
  });

  it("prefers substantive discovery candidates without depending on story length", () => {
    expect(
      discoveryScore({
        title: "Australian dwelling values fall",
        sourceUrl: "https://www.abc.net.au/news/example",
        channel: "PROPERTY",
      })
    ).toBeGreaterThan(
      discoveryScore({
        title: "Mortgage Choice partners with Skip on new low-deposit loan",
        sourceUrl: "https://www.mpamag.com/au/news/example",
        channel: "PROPERTY",
      }) + 4
    );
  });

  it("keeps ranking separate from suitability", () => {
    expect(storySignificance("US housing prices fall").baseline).toBe(88);
    // Geography and publication checks must still reject it in assessStory.
    expect(rank("RBA raises cash rate")).toBeGreaterThan(rank("RBA interview"));
  });

  it("does not mistake a reporting month for speculation", () => {
    expect(rank("Australian dwelling prices fall in May")).toBe(
      rank("Australian dwelling prices fall in June")
    );
  });
});
