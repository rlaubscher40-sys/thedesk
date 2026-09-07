import { describe, expect, it } from "vitest";
import {
  createIntelligenceShareToken,
  readIntelligenceShareToken,
  type SharedIntelligenceBrief,
} from "./intelligenceShare";

const brief: SharedIntelligenceBrief = {
  question: "What is changing in investor lending?",
  headline: "Investor credit is accelerating faster than the consensus narrative",
  answer: "The archive points to a clear shift in the direction of investor lending.",
  deskTake: "The important signal is the change in momentum, not one isolated monthly print.",
  confidence: "high",
  sourceCount: 2,
  sources: [
    {
      title: "Investor lending reaches a new cycle high",
      date: "2026-09-05",
      publisher: "ABS",
      href: "/story/42",
    },
    {
      title: "Investor finance · 8.4%",
      date: "2026-09-07",
      publisher: "The Desk metrics",
      href: "/trends",
    },
  ],
  signal: {
    label: "Investor lending",
    value: "+8.4%",
    context: "Latest recorded move in the evidence set",
  },
};

describe("intelligence share tokens", () => {
  it("round-trips a signed brief with its frozen evidence list", () => {
    const now = Date.UTC(2026, 8, 7, 10, 0, 0);
    const token = createIntelligenceShareToken(brief, now);
    expect(readIntelligenceShareToken(token, now + 60_000)).toEqual(brief);
  });

  it("derives sourceCount from the signed source list", () => {
    const token = createIntelligenceShareToken({ ...brief, sourceCount: 99 });
    expect(readIntelligenceShareToken(token)?.sourceCount).toBe(2);
  });

  it("rejects a tampered payload", () => {
    const token = createIntelligenceShareToken(brief);
    const [payload, signature] = token.split(".");
    expect(payload).toBeTruthy();
    expect(signature).toBeTruthy();
    const replacement = payload!.endsWith("A") ? "B" : "A";
    const tampered = `${payload!.slice(0, -1)}${replacement}.${signature}`;
    expect(readIntelligenceShareToken(tampered)).toBeNull();
  });

  it("expires after 30 days", () => {
    const now = Date.UTC(2026, 8, 7, 10, 0, 0);
    const token = createIntelligenceShareToken(brief, now);
    const thirtyOneDays = 31 * 24 * 60 * 60 * 1000;
    expect(readIntelligenceShareToken(token, now + thirtyOneDays)).toBeNull();
  });
});
