import { describe, expect, it } from "vitest";
import { buildStoryShareCaption, storyDeskTake } from "./share";

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

describe("storyDeskTake", () => {
  it("prefers an authored Ruben note over generated editorial layers", () => {
    expect(
      storyDeskTake({
        rubensNote: "This changes the setup.",
        sayThis: "Conversation line.",
        counterpoint: "Second side.",
      })
    ).toBe("This changes the setup.");
  });

  it("falls through to Say This then counterpoint", () => {
    expect(storyDeskTake({ rubensNote: null, sayThis: "Say this.", counterpoint: "Bear case." })).toBe(
      "Say this."
    );
    expect(storyDeskTake({ rubensNote: null, sayThis: "  ", counterpoint: "Bear case." })).toBe(
      "Bear case."
    );
  });

  it("fails closed when the story has no editorial layer", () => {
    expect(storyDeskTake({ rubensNote: null, sayThis: null, counterpoint: null })).toBeNull();
  });
});
