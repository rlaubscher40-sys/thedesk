import { describe, expect, it } from "vitest";
import { analyticsPath } from "./analyticsPath";

describe("content-free market analytics", () => {
  it("redacts public place paths and drops query/fragment content", () => {
    expect(analyticsPath("/markets/perth?q=private#value")).toBe("/markets/:market");
    expect(analyticsPath("/markets/sydney")).toBe("/markets/:market");
    expect(analyticsPath("/markets?q=secret&vs=private")).toBe("/markets");
    expect(analyticsPath("/ask?q=private")).toBe("/ask");
  });
  it("preserves non-market routes and bounds malformed inputs", () => {
    expect(analyticsPath("/story/123")).toBe("/story/123");
    expect(analyticsPath("")).toBe("/");
    expect(analyticsPath("/".repeat(500)).length).toBe(256);
  });
});
