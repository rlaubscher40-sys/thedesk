import { describe, expect, it } from "vitest";
import { clampTakeText } from "./takeCard";

describe("clampTakeText", () => {
  it("normalises whitespace without changing a short take", () => {
    expect(clampTakeText("  Supply   is doing more work than demand.  ")).toBe(
      "Supply is doing more work than demand."
    );
  });

  it("clips long copy on a word boundary", () => {
    const input = Array.from({ length: 90 }, (_, i) => `word${i}`).join(" ");
    const output = clampTakeText(input, 120);
    expect(output.length).toBeLessThanOrEqual(121);
    expect(output.endsWith("…")).toBe(true);
    expect(output).not.toContain("  ");
  });
});
