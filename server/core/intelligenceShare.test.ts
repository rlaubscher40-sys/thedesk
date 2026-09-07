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
  sourceCount: 4,
  signal: {
    label: "Investor lending",
    value: "+8.4%",
    context: "Latest recorded move in the evidence set",
  },
};

describe("intelligence share tokens", () => {
  it("round-trips a signed brief", () => {
    const now = Date.UTC(2026, 8, 7, 10, 0, 0);
    const token = createIntelligenceShareToken(brief, now);
    expect(readIntelligenceShareToken(token, now + 60_000)).toEqual(brief);
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
