import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../core/llm";
import { runDailyItemQc } from "../dailyItemQc";

const mockedInvoke = vi.mocked(invokeLLM);

// A valid 4-line partner block (labels must match PARTNER_TAG_LABELS).
const VALID_TAG = `Institutional: Frame the rate hold as a planning window for salary-packaging reviews.
Broker: Tell clients the hold steadies serviceability, lock applications before the next CPI print.
Adviser: Position the pause as a moment to revisit gearing structures, not chase yield.
Buyers Agent: Use the stable rate to push buyers off the fence before listings tighten.`;

const input = {
  title: "RBA holds cash rate at 4.35%",
  summary: "The Reserve Bank kept rates on hold.",
  category: "MACRO",
  sayThis: "The hold is the story everyone expected, the timing of the first cut is the one that pays.",
  partnerTag: VALID_TAG,
  whyItMatters: "A third straight hold signals the tightening cycle is done; watch refinancing demand lift.",
};

describe("runDailyItemQc", () => {
  beforeEach(() => mockedInvoke.mockReset());

  it("applies polished revisions when the editor returns valid JSON", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        approved: false,
        notes: ["sharpened sayThis"],
        sayThis: "Everyone called the hold, the money is in calling the first cut.",
        partnerTag: VALID_TAG,
        whyItMatters: "Third straight hold marks the cycle top, refinancing demand is the next move to watch.",
      })
    );
    const out = await runDailyItemQc(input);
    expect(out.approved).toBe(false);
    expect(out.sayThis).toBe("Everyone called the hold, the money is in calling the first cut.");
    expect(out.partnerTag).toBe(VALID_TAG);
    expect(out.notes).toEqual(["sharpened sayThis"]);
  });

  it("culls a line when the editor returns null for it", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        approved: false,
        notes: ["culled contrived angles"],
        sayThis: null,
        partnerTag: null,
        whyItMatters: input.whyItMatters,
      })
    );
    const out = await runDailyItemQc(input);
    expect(out.sayThis).toBeNull();
    expect(out.partnerTag).toBeNull();
    expect(out.whyItMatters).toBe(input.whyItMatters);
  });

  it("never resurrects a line that was null on input", async () => {
    // Editor tries to invent a sayThis the generator deliberately skipped.
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        approved: false,
        notes: [],
        sayThis: "An invented opener that should be ignored.",
        partnerTag: null,
        whyItMatters: input.whyItMatters,
      })
    );
    const out = await runDailyItemQc({ ...input, sayThis: null, partnerTag: null });
    expect(out.sayThis).toBeNull();
    expect(out.partnerTag).toBeNull();
  });

  it("keeps the original partnerTag when the revision no longer parses to 4 personas", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        approved: false,
        notes: [],
        sayThis: input.sayThis,
        partnerTag: "Broker: only one line survived",
        whyItMatters: input.whyItMatters,
      })
    );
    const out = await runDailyItemQc(input);
    expect(out.partnerTag).toBe(VALID_TAG);
  });

  it("keeps the original line when the revision is implausibly long", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        approved: false,
        notes: [],
        sayThis: "x".repeat(400),
        partnerTag: VALID_TAG,
        whyItMatters: input.whyItMatters,
      })
    );
    const out = await runDailyItemQc(input);
    expect(out.sayThis).toBe(input.sayThis);
  });

  it("falls back to originals (never throws) on an LLM error", async () => {
    mockedInvoke.mockRejectedValueOnce(new Error("network down"));
    // `.resolves` lets the matcher own the rejected-mock promise so vitest's
    // result-tracking doesn't flag it as unhandled; the assertion still proves
    // the SUT swallowed the error and returned the originals.
    await expect(runDailyItemQc(input)).resolves.toMatchObject({
      approved: true,
      sayThis: input.sayThis,
      partnerTag: input.partnerTag,
      whyItMatters: input.whyItMatters,
    });
  });

  it("falls back to originals on malformed JSON", async () => {
    mockedInvoke.mockResolvedValue("not json at all");
    const out = await runDailyItemQc(input);
    expect(out.sayThis).toBe(input.sayThis);
    expect(out.whyItMatters).toBe(input.whyItMatters);
  });

  it("skips the LLM entirely when there is nothing to review", async () => {
    const out = await runDailyItemQc({
      ...input,
      sayThis: null,
      partnerTag: null,
      whyItMatters: null,
    });
    expect(mockedInvoke).not.toHaveBeenCalled();
    expect(out.approved).toBe(true);
    expect(out.sayThis).toBeNull();
  });

  it("strips banned characters the editor lets slip", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        approved: false,
        notes: [],
        sayThis: "The hold landed — the first cut is the trade.",
        partnerTag: VALID_TAG,
        whyItMatters: input.whyItMatters,
      })
    );
    const out = await runDailyItemQc(input);
    expect(out.sayThis).not.toContain("—");
    expect(out.sayThis).toContain(",");
  });
});
