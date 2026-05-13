import { describe, expect, it } from "vitest";
import { stripBannedChars } from "./voice";

describe("stripBannedChars", () => {
  it("replaces em and en dashes with commas", () => {
    expect(stripBannedChars("calm — direct — sharp")).toBe("calm , direct , sharp");
    expect(stripBannedChars("calm – direct")).toBe("calm , direct");
  });

  it("normalises smart quotes and ellipsis", () => {
    expect(stripBannedChars("It’s “fine”…")).toBe('It\'s "fine"...');
  });

  it("leaves clean text untouched", () => {
    expect(stripBannedChars("Short sentences. One longer thought.")).toBe(
      "Short sentences. One longer thought."
    );
  });
});
