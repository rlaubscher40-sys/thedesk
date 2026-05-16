/**
 * Smoke test for the headline optimiser. Mocks invokeLLM and checks
 * that:
 *   - The five required fields parse + survive the schema gate.
 *   - Banned characters (em dashes) get stripped on each output field.
 *   - A malformed response throws so the caller can fall back rather
 *     than persisting garbage to the editions row.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../core/llm";
import { optimiseHeadlines } from "../headlineOptimiser";

const input = {
  weekRange: "May 6 – May 12, 2026",
  rubensTake: "The hold is a green light to talk about serviceability.",
  topics: [
    {
      title: "RBA holds at 4.35%",
      summary: "Third hold in a row.",
      category: "MACRO",
    },
  ],
  fullText: "Editor's letter prose.",
};

afterEach(() => vi.clearAllMocks());

describe("optimiseHeadlines", () => {
  it("returns five well-formed fields on a valid response", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      JSON.stringify({
        metaTitle: "Cash rate holds again, brokers get a runway",
        metaDescription:
          "The third RBA hold in a row lets the broker channel reset client conversations on serviceability and timing.",
        socialTitle: "Three holds and counting",
        socialDescription:
          "What three RBA holds mean for the broker channel this week. Plus the auction-clearance trend that's no longer noise.",
        headlineVariants: [
          "Cash rate holds at 4.35% for the third meeting",
          "The hold gives brokers a runway, not a victory lap",
          "What does steady rates change for the partner channel",
        ],
      })
    );

    const out = await optimiseHeadlines(input);

    expect(out.metaTitle).toContain("brokers");
    expect(out.metaDescription).toContain("broker channel");
    expect(out.headlineVariants).toHaveLength(3);
  });

  it("strips em dashes from each field", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      JSON.stringify({
        metaTitle: "Cash rate holds — third meeting",
        metaDescription:
          "The third RBA hold — broker channel gets stability for serviceability conversations heading into next quarter.",
        socialTitle: "Three holds — counting",
        socialDescription:
          "Three holds — what it means for the broker channel this week. Plus the auction-clearance trend that's no longer noise here.",
        headlineVariants: [
          "Cash rate holds for the third meeting — brokers get a runway",
          "The hold gives brokers a runway",
          "What does steady rates change",
        ],
      })
    );

    const out = await optimiseHeadlines(input);

    expect(out.metaTitle).not.toContain("—");
    expect(out.metaDescription).not.toContain("—");
    expect(out.socialTitle).not.toContain("—");
    expect(out.socialDescription).not.toContain("—");
    for (const variant of out.headlineVariants) {
      expect(variant).not.toContain("—");
    }
  });

  it("throws on malformed JSON", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce("not json");
    await expect(optimiseHeadlines(input)).rejects.toThrow(/invalid JSON/);
  });
});
