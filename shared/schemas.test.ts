import { describe, expect, it } from "vitest";
import {
  dailyFeedIngestItemSchema,
  parsePartnerTag,
  weeklyEditionIngestSchema,
} from "./schemas";

describe("dailyFeedIngestItemSchema", () => {
  it("accepts a minimal valid item and upper-cases the category", () => {
    const result = dailyFeedIngestItemSchema.parse({
      feedDate: "2026-05-13",
      title: "RBA holds cash rate at 4.35%",
      source: "AFR",
      summary: "Decision delivered after May meeting...",
      category: "macro",
    });
    expect(result.category).toBe("MACRO");
  });

  it("rejects an item missing required fields", () => {
    const parsed = dailyFeedIngestItemSchema.safeParse({ title: "x" });
    expect(parsed.success).toBe(false);
  });

  it("rejects malformed feedDate", () => {
    const parsed = dailyFeedIngestItemSchema.safeParse({
      feedDate: "13/05/2026",
      title: "x",
      source: "y",
      summary: "z",
      category: "MACRO",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("weeklyEditionIngestSchema", () => {
  it("requires at least one topic and one signal", () => {
    const parsed = weeklyEditionIngestSchema.safeParse({
      editionNumber: 1,
      weekOf: "2026-05-06",
      weekRange: "May 6 – May 12, 2026",
      topics: [],
      signals: [],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("parsePartnerTag", () => {
  it("parses a well-formed 4-persona block", () => {
    const raw = [
      "Institutional: corporate ang...",
      "Broker: broker angle...",
      "Adviser: adviser angle...",
      "Buyers Agent: BA angle...",
    ].join("\n");
    const parsed = parsePartnerTag(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.Broker).toMatch(/broker/);
  });

  it("returns null when any persona is missing", () => {
    const raw = "Institutional: only one persona";
    expect(parsePartnerTag(raw)).toBeNull();
  });
});
