import { describe, expect, it } from "vitest";
import { dailyFeedIngestItemSchema, parseReaderAngles, weeklyEditionIngestSchema } from "./schemas";

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

describe("parseReaderAngles", () => {
  it("parses a well-formed 3-position block", () => {
    const raw = [
      "Buying: what it changes if you are bidding...",
      "Holding: what it changes if you already own...",
      "Watching: what signal this is...",
    ].join("\n");
    const parsed = parseReaderAngles(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.Buying).toMatch(/bidding/);
    expect(parsed?.Holding).toMatch(/already own/);
    expect(parsed?.Watching).toMatch(/signal/);
  });

  it("returns null when any position is missing", () => {
    expect(parseReaderAngles("Buying: only one position")).toBeNull();
  });

  it("returns null for rows written against the old partner roles", () => {
    // Rows predating the switch to reader positions carry Broker / Adviser /
    // Buyers Agent. They must not parse: the block then simply does not render
    // on those stories, which is the intended outcome. There is no honest
    // mapping from "Broker" to a reader position, so silently relabelling one
    // would put words in the reader's mouth that were written for someone else.
    const legacy = [
      "Broker: broker angle...",
      "Adviser: adviser angle...",
      "Buyers Agent: BA angle...",
    ].join("\n");
    expect(parseReaderAngles(legacy)).toBeNull();
  });

  it("ignores an unrecognised extra line as long as all three positions are present", () => {
    const raw = [
      "Institutional: a stray line from somewhere else",
      "Buying: what it changes if you are bidding...",
      "Holding: what it changes if you already own...",
      "Watching: what signal this is...",
    ].join("\n");
    expect(parseReaderAngles(raw)).not.toBeNull();
  });
});

it("retains source timing through the ingestion contract and rejects contradictory provenance", () => {
  const input = {
    feedDate: "2026-09-09",
    title: "Sydney housing update",
    source: "ABC",
    summary: "Housing reporting.",
    category: "PROPERTY",
    sourceTiming: {
      feedReportedAt: "2026-09-09T00:00:00Z",
      publisherPublishedAt: "2026-09-08T00:00:00Z",
      publisherDateStatus: "available",
      retrievedAt: "2026-09-09T00:10:00Z",
    },
  };
  expect(dailyFeedIngestItemSchema.parse(input).sourceTiming).toEqual(input.sourceTiming);
  expect(
    dailyFeedIngestItemSchema.safeParse({
      ...input,
      sourceTiming: { ...input.sourceTiming, publisherDateStatus: "missing" },
    }).success
  ).toBe(false);
});
