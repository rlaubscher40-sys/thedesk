import { afterEach, describe, expect, it, vi } from "vitest";
import { assertCaptionStyle } from "./captionStyle";
import { createReelContainer } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("Australian caption style", () => {
  it("preserves Australian prose, official names, signed figures and source URLs", () => {
    const caption =
      "Analyse neighbourhood demand. Centre prices fell -1.2%. Labor and the Center for Housing. Source: https://example.com/center/color #HousingSupply";
    expect(assertCaptionStyle(caption)).toBe(caption);
  });
  it("rejects em dashes and common American prose spellings without rewriting facts", () => {
    expect(() => assertCaptionStyle("Approved\u2014but not built.")).toThrow("em dash");
    for (const word of ["neighborhood", "analyze", "optimization", "color", "behavior", "center"])
      expect(() => assertCaptionStyle(`Check ${word} in this caption.`)).toThrow(
        "Australian English"
      );
  });
  it("blocks a non-compliant manual Reel caption before contacting Meta", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      createReelContainer({
        igUserId: "fixture",
        accessToken: "fixture",
        videoUrl: "https://example.com/reel.mp4",
        caption: "Supply\u2014and demand.",
      })
    ).rejects.toThrow("em dash");
    expect(fetch).not.toHaveBeenCalled();
  });
});
