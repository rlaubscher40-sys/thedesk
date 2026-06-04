import { describe, it, expect } from "vitest";
import { cleanHeadline, isRedundantSummary } from "./headline";

describe("cleanHeadline", () => {
  it("strips the Google News ' - Publisher' suffix", () => {
    expect(cleanHeadline("Meta enters enterprise AI race with new business agent - Reuters")).toBe(
      "Meta enters enterprise AI race with new business agent"
    );
    expect(cleanHeadline("OpenAI diverges from White House on AI safety rules – Politico")).toBe(
      "OpenAI diverges from White House on AI safety rules"
    );
    expect(cleanHeadline("GDP growth slows on cautious spending and external shocks – mpamag.com")).toBe(
      "GDP growth slows on cautious spending and external shocks"
    );
  });

  it("leaves clean headlines untouched", () => {
    expect(cleanHeadline("RBA holds the cash rate at 4.35%")).toBe("RBA holds the cash rate at 4.35%");
  });

  it("does not strip hyphenated words or in-sentence dashes", () => {
    // No spaces around the hyphen → not a suffix.
    expect(cleanHeadline("Trump-Xi summit yields trade deal")).toBe("Trump-Xi summit yields trade deal");
    // Tail is a full clause (terminal punctuation / too long), not a masthead.
    expect(cleanHeadline("Rates on hold - but the RBA signals a cut is coming soon next quarter")).toBe(
      "Rates on hold - but the RBA signals a cut is coming soon next quarter"
    );
  });
});

describe("isRedundantSummary", () => {
  it("flags a summary that is the title repeated (with source appended)", () => {
    expect(
      isRedundantSummary(
        "Meta enters enterprise AI race with new business agent - Reuters",
        "Meta enters enterprise AI race with new business agent Reuters"
      )
    ).toBe(true);
  });

  it("flags an exact echo and an empty summary", () => {
    expect(isRedundantSummary("OpenAI diverges from White House", "OpenAI diverges from White House")).toBe(true);
    expect(isRedundantSummary("Anything", "")).toBe(true);
    expect(isRedundantSummary("Anything", null)).toBe(true);
  });

  it("keeps a genuine summary that adds information", () => {
    expect(
      isRedundantSummary(
        "RBA holds at 4.35%",
        "The Reserve Bank kept the cash rate steady, dropping its tightening bias as services inflation cools."
      )
    ).toBe(false);
  });
});
