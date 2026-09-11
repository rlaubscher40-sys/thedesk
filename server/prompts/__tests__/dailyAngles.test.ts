import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../core/llm";
import { generateDailyAngles } from "../dailyAngles";

const mockedInvoke = vi.mocked(invokeLLM);

// A valid 3-line partner block (labels must match READER_ANGLE_LABELS).
const VALID_TAG = `Buying: The hold steadies what you can borrow, but competition builds before listings do.
Holding: Nothing changes on your repayments until the fixed-rate roll-off lands in June.
Watching: The next CPI print is the test, not the decision itself.`;

const input = {
  title: "RBA holds cash rate at 4.35%",
  summary: "The Reserve Bank kept rates on hold.",
  category: "MACRO",
  articleText:
    "The Reserve Bank of Australia left the cash rate at 4.35% for a third straight meeting.",
};

describe("generateDailyAngles", () => {
  beforeEach(() => mockedInvoke.mockReset());

  it("parses a full valid response into all four angles", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        sayThis: "Everyone called the hold, the money is in calling the first cut.",
        partnerTag: VALID_TAG,
        whyItMatters:
          "Third straight hold marks the cycle top, refinancing demand is the next move to watch.",
        counterpoint: "A long hold can mask a hike if services inflation stays sticky.",
      })
    );
    const out = await generateDailyAngles(input);
    expect(out.sayThis).toContain("first cut");
    expect(out.partnerTag).toBe(VALID_TAG);
    expect(out.whyItMatters).toContain("cycle top");
    expect(out.counterpoint).toContain("services inflation");
  });

  it("makes a single LLM call (article text sent once)", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({ sayThis: null, partnerTag: null, whyItMatters: null, counterpoint: null })
    );
    await generateDailyAngles(input);
    expect(mockedInvoke).toHaveBeenCalledTimes(1);
  });

  it("treats JSON null as a culled field", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        sayThis: null,
        partnerTag: null,
        whyItMatters: "Still has broad significance for the rates outlook.",
        counterpoint: null,
      })
    );
    const out = await generateDailyAngles(input);
    expect(out.sayThis).toBeNull();
    expect(out.partnerTag).toBeNull();
    expect(out.whyItMatters).toContain("rates outlook");
    expect(out.counterpoint).toBeNull();
  });

  it("treats a literal SKIP string the same as null", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        sayThis: "SKIP",
        partnerTag: "SKIP",
        whyItMatters: "SKIP",
        counterpoint: "SKIP",
      })
    );
    const out = await generateDailyAngles(input);
    expect(out).toEqual({
      sayThis: null,
      partnerTag: null,
      whyItMatters: null,
      counterpoint: null,
    });
  });

  it("drops a partner block that does not parse to all three roles", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        sayThis: "A valid opener about the rates hold and what it means for serviceability.",
        partnerTag: "Buying: only one position here, missing the other two",
        whyItMatters: null,
        counterpoint: null,
      })
    );
    const out = await generateDailyAngles(input);
    // sayThis survives on its own; the malformed tag is dropped independently.
    expect(out.sayThis).toContain("serviceability");
    expect(out.partnerTag).toBeNull();
  });

  it("strips banned characters (em dash, smart quotes) from lines", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        sayThis: "The hold — not the cut — is the “obvious” story.",
        partnerTag: null,
        whyItMatters: null,
        counterpoint: null,
      })
    );
    const out = await generateDailyAngles(input);
    expect(out.sayThis).not.toMatch(/[—“”]/);
  });

  it("strips markdown fences before parsing", async () => {
    mockedInvoke.mockResolvedValue(
      "```json\n" +
        JSON.stringify({
          sayThis: null,
          partnerTag: null,
          whyItMatters: "A fenced response still parses cleanly.",
          counterpoint: null,
        }) +
        "\n```"
    );
    const out = await generateDailyAngles(input);
    expect(out.whyItMatters).toContain("parses cleanly");
  });

  it("returns all-null on malformed JSON rather than throwing", async () => {
    mockedInvoke.mockResolvedValue("not json at all");
    const out = await generateDailyAngles(input);
    expect(out).toEqual({
      sayThis: null,
      partnerTag: null,
      whyItMatters: null,
      counterpoint: null,
    });
  });

  it("returns all-null when the LLM call throws", async () => {
    mockedInvoke.mockRejectedValueOnce(new Error("network down"));
    const out = await generateDailyAngles(input);
    expect(out).toEqual({
      sayThis: null,
      partnerTag: null,
      whyItMatters: null,
      counterpoint: null,
    });
  });

  it("rejects an over-long line in favour of null", async () => {
    mockedInvoke.mockResolvedValue(
      JSON.stringify({
        sayThis: "x".repeat(400),
        partnerTag: null,
        whyItMatters: null,
        counterpoint: null,
      })
    );
    const out = await generateDailyAngles(input);
    expect(out.sayThis).toBeNull();
  });
});

it("strict recovery distinguishes a deliberate empty result from a failed attempt", async () => {
  mockedInvoke.mockResolvedValueOnce(
    JSON.stringify({ sayThis: null, partnerTag: null, whyItMatters: null, counterpoint: null })
  );
  const signal = AbortSignal.timeout(1000);
  expect(await generateDailyAngles(input, { strict: true, signal })).toEqual({
    sayThis: null,
    partnerTag: null,
    whyItMatters: null,
    counterpoint: null,
  });
  expect(mockedInvoke).toHaveBeenLastCalledWith(expect.objectContaining({ signal, maxRetries: 0 }));
  for (const response of ["not JSON", "null", "[]", "{}", '{"sayThis":4}']) {
    mockedInvoke.mockResolvedValueOnce(response);
    await expect(generateDailyAngles(input, { strict: true })).rejects.toThrow();
  }
  mockedInvoke.mockRejectedValueOnce(new Error("unavailable"));
  await expect(generateDailyAngles(input, { strict: true })).rejects.toThrow();
});

it("supplies the current date and drops an expired deadline before persistence", async () => {
 vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-11T11:00:00Z"));
 try {
  mockedInvoke.mockResolvedValue(JSON.stringify({sayThis:"Watch the result by mid-2026.",partnerTag:null,whyItMatters:"The model covers 2026–27 to 2029–30.",counterpoint:null}));
  const result=await generateDailyAngles(input);
  expect(result.sayThis).toBeNull();
  expect(result.whyItMatters).toContain("2029-30");
  expect(mockedInvoke.mock.calls.at(-1)?.[0].messages[1]?.content).toContain("Current Sydney calendar date: 2026-09-11");
 } finally {vi.useRealTimers();}
});
