import { describe, expect, it } from "vitest";
import { routeParam } from "./requestParams";

describe("routeParam", () => {
  it("returns a plain string param unchanged", () => {
    expect(routeParam("42")).toBe("42");
  });
  it("takes the first element of an array param", () => {
    expect(routeParam(["a", "b"])).toBe("a");
  });
  it("falls back to empty string for undefined or empty array", () => {
    expect(routeParam(undefined)).toBe("");
    expect(routeParam([])).toBe("");
  });
});
