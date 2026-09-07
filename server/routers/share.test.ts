import { describe, expect, it } from "vitest";
import { buildStoryShareCaption } from "./share";

describe("buildStoryShareCaption", () => {
  it("prefers the conversation-ready line without inventing extra copy", () => {
    const caption = buildStoryShareCaption({
      title: "Investor lending accelerates again",
      whyItMatters: "Credit growth is strengthening.",
      sayThis: "The lending pulse is turning before the narrative does.",
      source: "ABS",
    });

    expect(caption).toContain("Investor lending accelerates again");
    expect(caption).toContain("The lending pulse is turning before the narrative does.");
    expect(caption).not.toContain("Credit growth is strengthening.");
    expect(caption).toContain("Source: ABS");
  });

  it("falls back to why-it-matters when no say-this line exists", () => {
    const caption = buildStoryShareCaption({
      title: "Housing approvals lift",
      whyItMatters: "Supply is responding, but only slowly.",
      sayThis: null,
      source: null,
    });

    expect(caption).toContain("Supply is responding, but only slowly.");
    expect(caption).not.toContain("Source:");
  });
});
