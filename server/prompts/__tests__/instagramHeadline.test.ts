import { describe, expect, it } from "vitest";
import { instagramHeadlineNumbersAreGrounded } from "../instagramHeadline";

const base = {
  title: "NSW lost 21,465 residents interstate in the latest year",
  summary: "Queensland gained 25,300 people while Victoria gained 2,100.",
  category: "PROPERTY",
};

describe("instagramHeadlineNumbersAreGrounded", () => {
  it("accepts exact source numbers in a hook", () => {
    expect(instagramHeadlineNumbersAreGrounded("21,465 people left NSW", base)).toBe(true);
    expect(instagramHeadlineNumbersAreGrounded("Queensland gained 25,300 people", base)).toBe(true);
  });

  it("rejects a fabricated or recalculated number", () => {
    expect(instagramHeadlineNumbersAreGrounded("22,000 people left NSW", base)).toBe(false);
    expect(instagramHeadlineNumbersAreGrounded("NSW lost 46,765 people to Queensland", base)).toBe(false);
  });

  it("accepts non-numeric rewrites without weakening factual validation elsewhere", () => {
    expect(instagramHeadlineNumbersAreGrounded("NSW is losing the interstate migration fight", base)).toBe(true);
  });

  it("normalises commas while preserving percentages", () => {
    const input = {
      title: "Auction clearance reaches 74% across 1,200 scheduled homes",
      summary: null,
      category: "PROPERTY",
    };
    expect(instagramHeadlineNumbersAreGrounded("74% clearance across 1,200 homes", input)).toBe(true);
    expect(instagramHeadlineNumbersAreGrounded("75% clearance across 1,200 homes", input)).toBe(false);
  });
});
