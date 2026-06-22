import { describe, it, expect } from "vitest";
import {
  cleanHeadline,
  isRedundantSummary,
  looksLikeGarbage,
  MAX_HELPER_INPUT,
  shouldShowSummary,
} from "./headline";

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

  it("flags a title echo with only a trailing source domain appended", () => {
    // Real example: a Google News description that's the headline plus the
    // masthead's bare domain. The domain padding used to push it past the
    // redundancy ratio so the card showed the headline twice.
    expect(
      isRedundantSummary(
        "Breaking: RBA holds interest rates",
        "Breaking: RBA holds interest rates realestate.com.au"
      )
    ).toBe(true);
    expect(isRedundantSummary("ASX 200 slips at the open", "ASX 200 slips at the open ig.com")).toBe(
      true
    );
  });

  it("keeps a summary that adds real prose even when it ends with a domain", () => {
    expect(
      isRedundantSummary(
        "RBA holds at 4.35%",
        "The Reserve Bank kept the cash rate steady as services inflation cools. Full statement at rba.gov.au"
      )
    ).toBe(false);
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

describe("looksLikeGarbage", () => {
  it("flags the Google News JS interstitial soup", () => {
    const junk =
      '"use strict";this.default_DotsSplashUi_desktop_ms={};(function(_){var window=this;try{ /* Copyright The Closure Library Authors.';
    expect(looksLikeGarbage(junk)).toBe(true);
  });

  it("does not flag normal prose", () => {
    expect(
      looksLikeGarbage(
        "Australian construction risk is being reshaped by defence spending, data centres and the housing push."
      )
    ).toBe(false);
  });
});

describe("pathological-input guards", () => {
  // A single malformed story row with a multi-kilobyte value must not be able
  // to hang the render (the cause behind Safari's "A problem repeatedly
  // occurred" tab crash). Past MAX_HELPER_INPUT the helpers short-circuit
  // rather than run their regexes over the whole blob.
  const huge = "a-".repeat(MAX_HELPER_INPUT); // ~2x the ceiling, alternating to stress backtracking

  it("returns oversized titles untouched and fast", () => {
    const start = performance.now();
    expect(cleanHeadline(huge)).toBe(huge);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it("treats an oversized summary as garbage and not redundant", () => {
    expect(looksLikeGarbage(huge)).toBe(true);
    expect(isRedundantSummary("Short headline", huge)).toBe(false);
    expect(shouldShowSummary("Short headline", huge)).toBe(false);
  });

  it("leaves content at the ceiling working normally", () => {
    expect(cleanHeadline("RBA holds the cash rate at 4.35%")).toBe("RBA holds the cash rate at 4.35%");
  });
});

describe("shouldShowSummary", () => {
  it("hides redundant, empty, and garbage sublines; shows real ones", () => {
    expect(shouldShowSummary("OpenAI diverges", "OpenAI diverges")).toBe(false);
    expect(shouldShowSummary("Anything", null)).toBe(false);
    expect(
      shouldShowSummary("Defence push reshapes construction", '"use strict";function(_){var window=this;}')
    ).toBe(false);
    expect(
      shouldShowSummary(
        "RBA holds at 4.35%",
        "The Reserve Bank kept the cash rate steady as services inflation cools."
      )
    ).toBe(true);
  });
});
