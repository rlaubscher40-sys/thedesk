import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../core/llm", () => ({ invokeLLM: vi.fn() }));

import { invokeLLM } from "../../core/llm";
import { generateLookback } from "../editionLookback";

const mockedInvoke = vi.mocked(invokeLLM);

const priorTopics = [
  {
    title: "RBA holds, the cut is the next trade",
    summary: "The RBA held at 4.35%.",
    category: "MACRO",
    body: "…",
    keyTakeaway: "The hold gives brokers a stable runway into winter.",
    whyItMatters: "Brokers can price serviceability around a stable rate.",
    whatToWatch: ["April CPI on May 28"],
    talkingPoints: { Broker: "Lock applications before CPI." },
  },
];

const thisWeekItems = [
  {
    id: 1,
    feedDate: "2026-05-20",
    title: "April CPI comes in hot at 3.6%",
    source: "ABS",
    sourceUrl: null,
    summary: "Trimmed mean CPI surprised to the upside.",
    category: "ECONOMICS",
    imageUrl: null,
    partnerTag: null,
    sayThis: null,
    whyItMatters: null,
    counterpoint: null,
    corroborationCount: 1,
    corroboratingSources: null,
    rubensNote: null,
    priority: 50,
    promotedToEdition: false,
    createdAt: new Date(),
  },
];

const input = {
  priorWeekRange: "May 6 - May 12, 2026",
  priorTopics: priorTopics as never,
  priorDatesToWatch: [{ label: "May 28", description: "April CPI release." }],
  thisWeekItems: thisWeekItems as never,
};

describe("generateLookback", () => {
  beforeEach(() => mockedInvoke.mockReset());

  it("returns a validated, banned-char-stripped lookback", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        summary: "Last week's read on a stable rate held up — until the CPI print.",
        items: [
          {
            reference: "April CPI on May 28 as the thing to watch",
            outcome: "CPI landed hot at 3.6%, undercutting the stable-rate call",
            verdict: "missed",
          },
        ],
      })
    );
    const out = await generateLookback(input);
    expect(out).not.toBeNull();
    expect(out!.items).toHaveLength(1);
    expect(out!.items[0]!.verdict).toBe("missed");
    expect(out!.summary).not.toContain("—"); // em dash stripped
  });

  it("returns null when there is no prior edition to score", async () => {
    const out = await generateLookback({ ...input, priorTopics: [] });
    expect(out).toBeNull();
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("returns null on an empty items array (nothing to assess)", async () => {
    mockedInvoke.mockResolvedValue(JSON.stringify({ summary: "Quiet week.", items: [] }));
    expect(await generateLookback(input)).toBeNull();
  });

  it("returns null on malformed JSON rather than throwing", async () => {
    mockedInvoke.mockResolvedValue("not json");
    expect(await generateLookback(input)).toBeNull();
  });
});
