/**
 * Smoke tests for news-driven metric extraction. Mocks invokeLLM and
 * verifies:
 *   - A well-formed response yields the right shape including sourceUrl.
 *   - sourceIndex maps to the actual article URL, we don't trust the
 *     model to emit URLs verbatim.
 *   - found:false returns null (no fabricated metrics).
 *   - Malformed JSON returns null rather than throwing (best-effort).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../core/llm";
import { extractMetricFromNews } from "../metricExtraction";

const articles = [
  {
    title: "CoreLogic: Sydney clearance holds at 67% in May",
    summary: "Sydney auction clearance was 67% over the past week.",
    source: "AFR",
    url: "https://example.com/afr-sydney",
    date: "2026-05-13",
  },
  {
    title: "Domain: Melbourne mixed",
    summary: "Melbourne clearance bounced to 65%.",
    source: "Domain",
    url: "https://example.com/domain-mel",
    date: "2026-05-12",
  },
];

afterEach(() => vi.clearAllMocks());

describe("extractMetricFromNews", () => {
  it("returns the parsed value + source URL when the model picks an article", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      JSON.stringify({
        found: true,
        value: "67",
        asOf: "2026-05-13",
        context: "Sydney, week ending May 13",
        sourceIndex: 1,
      })
    );

    const out = await extractMetricFromNews({
      metricLabel: "Auction clearance",
      unit: "%",
      guidance: "Most recent national clearance rate.",
      articles,
    });

    expect(out).not.toBeNull();
    expect(out?.value).toBe("67");
    expect(out?.context).toBe("Sydney, week ending May 13");
    expect(out?.sourceUrl).toBe("https://example.com/afr-sydney");
    expect(out?.asOf?.toISOString().startsWith("2026-05-13")).toBe(true);
  });

  it("returns null when the model reports found:false", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      JSON.stringify({
        found: false,
        value: null,
        asOf: null,
        context: null,
        sourceIndex: null,
      })
    );

    const out = await extractMetricFromNews({
      metricLabel: "Auction clearance",
      unit: "%",
      guidance: "Most recent national clearance rate.",
      articles,
    });

    expect(out).toBeNull();
  });

  it("returns null on malformed JSON rather than throwing", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce("totally not json {");

    const out = await extractMetricFromNews({
      metricLabel: "Auction clearance",
      unit: "%",
      guidance: "Most recent national clearance rate.",
      articles,
    });

    expect(out).toBeNull();
  });

  it("returns null sourceUrl when sourceIndex is out of range", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      JSON.stringify({
        found: true,
        value: "67",
        asOf: null,
        context: null,
        // Within the schema's allowed range (0–20) but beyond the
        // 2-article fixture, should map to no URL rather than crash.
        sourceIndex: 5,
      })
    );

    const out = await extractMetricFromNews({
      metricLabel: "Auction clearance",
      unit: "%",
      guidance: "Most recent national clearance rate.",
      articles,
    });

    expect(out?.value).toBe("67");
    expect(out?.sourceUrl).toBeNull();
  });
});
