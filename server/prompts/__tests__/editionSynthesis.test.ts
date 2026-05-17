/**
 * Smoke tests for the weekly synthesis prompt. We mock invokeLLM so the
 * test runs offline and verifies:
 *   - A valid JSON response gets parsed and the structured output shape
 *     matches the schema (topics, signals, marketStress, datesToWatch).
 *   - Banned characters get stripped at the boundary.
 *   - A malformed response surfaces a clear error rather than silently
 *     returning partial data.
 *
 * The Anthropic SDK is never imported here — we mock the project's
 * invokeLLM wrapper, so a CI run never touches the live API.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../core/llm";
import { synthesizeWeeklyEdition } from "../editionSynthesis";

const fakeItems = [
  {
    id: 1,
    feedDate: "2026-05-13",
    title: "RBA holds at 4.35%",
    source: "ABC",
    sourceUrl: null,
    summary: "The RBA kept the cash rate steady at 4.35%.",
    category: "MACRO",
    imageUrl: null,
    partnerTag: null,
    sayThis: null,
    rubensNote: null,
    promotedToEdition: false,
    createdAt: new Date(),
  },
];

const validResponse = JSON.stringify({
  topics: [
    {
      title: "Cash rate holds, broker channel keeps pricing",
      summary: "The RBA held at 4.35% — the third hold in a row.",
      category: "MACRO",
      body: "What happened. The RBA held. Why it matters. Brokers can plan around stability. What to watch. Next month's CPI. What it means for you. Lock the conversation on serviceability.",
      keyTakeaway: "The hold gives brokers a clear runway.",
      whyItMatters: "Brokers and BAs now have a stable rate to price serviceability conversations around.",
      whatToWatch: ["Next CPI release on May 28"],
      talkingPoints: {
        Broker: "Lock in the conversation on serviceability while the rate is stable.",
      },
    },
    {
      title: "APRA softens serviceability draft",
      summary: "APRA released a softer serviceability paper.",
      category: "POLICY",
      body: "What happened. The paper. Why it matters. Lending capacity may expand. What to watch. Industry response. What it means for you. Watch the broker channel.",
      keyTakeaway: "Softer buffers mean more capacity, but only at the margins.",
      whyItMatters: "Advisers should prepare clients for incremental capacity, not a step change.",
      whatToWatch: ["Submissions close June 14"],
      talkingPoints: {
        Adviser: "Frame this as marginal capacity, not a green light.",
      },
    },
    {
      title: "Sydney clearance holds at 67%",
      summary: "Auction clearance held above 65 for the sixth week.",
      category: "PROPERTY",
      body: "What happened. Six weeks above 65. Why it matters. Confidence is rebuilding. What to watch. June listings volume. What it means for you. Buyer's agents can lean into the cycle.",
      keyTakeaway: "Six weeks above 65 is no longer noise.",
      whyItMatters: "Buyer's agents can frame this as a sustained trend, not a blip.",
      whatToWatch: ["June listings"],
      talkingPoints: {
        "Buyers Agent": "Six weeks above 65 is a trend, not a print.",
      },
    },
    {
      title: "AUKUS budget under pressure as US lags submarine plan",
      summary: "Treasury revises AUKUS expenditure assumptions.",
      category: "GEOPOLITICS",
      body: "What happened. US production behind. Why it matters. Capital allocation shifts. What to watch. Defence DOC release. What it means for you. Watch regional industrial property.",
      keyTakeaway: "Defence spend is a property catalyst no one is pricing.",
      whyItMatters: "BAs covering regional industrial corridors should monitor defence-zone announcements.",
      whatToWatch: ["Q3 defence procurement update"],
      talkingPoints: {
        "Buyers Agent": "Defence pipeline still anchors industrial corridors.",
      },
    },
    {
      title: "Anthropic releases a long-context agent SDK",
      summary: "AI tooling for brokers and advisers gets cheaper.",
      category: "AI",
      body: "What happened. New SDK. Why it matters. Document workflows. What to watch. Adoption rate. What it means for you. Pilot one workflow.",
      keyTakeaway: "Pick one document workflow and pilot the new tooling.",
      whyItMatters: "Mortgage brokers can pilot document-handling agents without bespoke ML cost.",
      whatToWatch: ["Adoption benchmarks Q3"],
      talkingPoints: {
        Broker: "Pilot doc-handling automation on a low-risk workflow first.",
      },
    },
  ],
  signals: [
    "RBA holds at 4.35% for the third meeting",
    "APRA serviceability paper softens",
    "Sydney clearance above 65 for six weeks",
    "Fixed-rate roll-off volume peaks in June",
    "AUKUS production schedule slipping",
    "Anthropic agent SDK lands",
  ],
  keyMetrics: { "Cash rate": "4.35%", "Sydney clearance": "67%" },
  readingTime: "9 min",
  fullText: "An editor's letter explaining the through-line across these stories.",
  marketStress: "low",
  datesToWatch: [
    { label: "May 28", description: "April CPI release." },
    { label: "June 14", description: "APRA submissions close." },
  ],
});

afterEach(() => vi.clearAllMocks());

describe("synthesizeWeeklyEdition", () => {
  it("parses a valid LLM response into a typed SynthesisOutput", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce(validResponse);

    const out = await synthesizeWeeklyEdition({
      weekRange: "May 6 – May 12, 2026",
      weekOf: "2026-05-06",
      items: fakeItems,
    });

    expect(out.topics).toHaveLength(5);
    expect(out.topics[0]?.title).toBe(
      "Cash rate holds, broker channel keeps pricing"
    );
    expect(out.topics[0]?.whyItMatters).toContain("Brokers and BAs");
    expect(out.signals.length).toBeGreaterThanOrEqual(6);
    expect(out.marketStress).toBe("low");
    expect(out.datesToWatch).toHaveLength(2);
  });

  it("strips em dashes that slip past the prompt rubric", async () => {
    const withEmDash = JSON.stringify({
      ...JSON.parse(validResponse),
      topics: [
        {
          ...JSON.parse(validResponse).topics[0],
          summary: "The RBA held — the third in a row.",
        },
        ...JSON.parse(validResponse).topics.slice(1),
      ],
    });
    vi.mocked(invokeLLM).mockResolvedValueOnce(withEmDash);

    const out = await synthesizeWeeklyEdition({
      weekRange: "May 6 – May 12, 2026",
      weekOf: "2026-05-06",
      items: fakeItems,
    });

    expect(out.topics[0]?.summary).not.toContain("—");
    expect(out.topics[0]?.summary).toContain(",");
  });

  it("throws when the LLM returns invalid JSON", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce("not json at all");

    await expect(
      synthesizeWeeklyEdition({
        weekRange: "May 6 – May 12, 2026",
        weekOf: "2026-05-06",
        items: fakeItems,
      })
    ).rejects.toThrow(/invalid JSON/);
  });

  it("throws when topics or signals fall below the schema minimum", async () => {
    const thin = JSON.stringify({
      ...JSON.parse(validResponse),
      topics: [JSON.parse(validResponse).topics[0]], // just one — below min 5
    });
    vi.mocked(invokeLLM).mockResolvedValueOnce(thin);

    await expect(
      synthesizeWeeklyEdition({
        weekRange: "May 6 – May 12, 2026",
        weekOf: "2026-05-06",
        items: fakeItems,
      })
    ).rejects.toThrow(/schema/);
  });
});
