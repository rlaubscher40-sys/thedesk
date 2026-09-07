import { describe, expect, it } from "vitest";
import { formatLike, parseFigure } from "./figureFormat";

describe("parseFigure", () => {
  it("reads the dressing off a figure the card already chose", () => {
    expect(parseFigure("$815,439")).toMatchObject({
      prefix: "$",
      suffix: "",
      decimals: 0,
      grouped: true,
      value: 815439,
    });
    expect(parseFigure("4.3%")).toMatchObject({ suffix: "%", decimals: 1, value: 4.3 });
  });

  it("returns null rather than a guess when there is no number", () => {
    expect(parseFigure("n/a")).toBeNull();
  });
});

describe("formatLike", () => {
  it("writes a new number the way the old one was written", () => {
    const shape = parseFigure("$815,439")!;
    expect(formatLike(shape, 1234567)).toBe("$1,234,567");
    expect(formatLike(parseFigure("4.3%")!, 4)).toBe("4.0%");
  });

  it("keeps a negative readable rather than losing the sign inside the prefix", () => {
    expect(formatLike(parseFigure("$100")!, -50)).toBe("$-50");
  });

  it("does not group a figure the card did not group", () => {
    expect(formatLike(parseFigure("1500")!, 22000)).toBe("22000");
  });
});
