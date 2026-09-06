import { describe, expect, it } from "vitest";
import type { StatPick } from "../../instagram/statPick";
import { fallbackStatLine, inventsFigures } from "../statCard";

const pick: StatPick = {
  metricKey: "auction_clearance",
  label: "Auction clearance",
  value: "58.4%",
  angle: "streak",
  subtext: "SIX STRAIGHT FALLS IN AUCTION CLEARANCE",
  delta: -0.7,
  direction: "down",
  context: "BELOW 60% SINCE JULY",
  source: "CoreLogic",
  sourceUrl: null,
  asOf: new Date("2026-09-05T00:00:00Z"),
  score: 0.82,
  sampleSize: 12,
};

const facts = [pick.value, pick.subtext, pick.context ?? "", pick.label];

describe("inventsFigures", () => {
  it("passes a line that states no figures at all", () => {
    expect(inventsFigures("Clearance rates have been sliding for six weeks straight.", facts)).toBe(
      false
    );
  });

  it("passes a line reusing a figure from the source facts", () => {
    expect(inventsFigures("Clearance has stayed under 60% since July.", facts)).toBe(false);
  });

  it("catches a figure the source facts never mentioned", () => {
    expect(inventsFigures("Sydney led the fall at 47.2%.", facts)).toBe(true);
  });

  it("catches an invented year", () => {
    expect(inventsFigures("The weakest run since 2019.", facts)).toBe(true);
  });

  it("treats thousands separators as the same figure", () => {
    expect(inventsFigures("Values slipped to $815,439.", ["$815439 median"])).toBe(false);
  });

  it("treats a trailing decimal zero as the same figure", () => {
    expect(inventsFigures("Down 6 percent across the board.", ["MEDIAN -6.0%"])).toBe(false);
  });

  it("does not object to numbers spelled as words", () => {
    expect(inventsFigures("Six straight weeks of falls now.", facts)).toBe(false);
  });
});

describe("fallbackStatLine", () => {
  it("states the metric and value and nothing else", () => {
    expect(fallbackStatLine(pick)).toBe("Auction clearance is now 58.4%.");
  });

  it("never introduces a figure of its own", () => {
    expect(inventsFigures(fallbackStatLine(pick), facts)).toBe(false);
  });
});
