import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../core/context";
import { consumeAnonymousAsk, resetAskQuotaForTests } from "../core/askQuota";
import { ASK_SERVER_TIMEOUT_MS } from "../../shared/requestDeadline";

vi.mock("../db", () => ({
  searchPropertyEvidence: vi.fn(),
  searchAllContent: vi.fn(),
  listDailyMetrics: vi.fn(),
}));
vi.mock("../core/llm", () => ({ invokeLLMJson: vi.fn() }));
vi.mock("../ask/review", () => ({ reviewAskAnswer: vi.fn() }));
vi.mock("../ask/localFacts", () => ({retrieveLocalFacts: vi.fn()}));
vi.mock("../og/intelligenceCard", () => ({ renderIntelligenceCard: vi.fn() }));
vi.mock("../core/intelligenceShare", () => ({
  createIntelligenceShareToken: vi.fn(() => "verified-share-token"),
  readIntelligenceShareToken: vi.fn(),
}));
import * as db from "../db";
import { invokeLLMJson } from "../core/llm";
import { reviewAskAnswer } from "../ask/review";
import { createIntelligenceShareToken } from "../core/intelligenceShare";
import { askRouter } from "./ask";
import { retrieveLocalFacts } from "../ask/localFacts";

const ctx = { req: { ip: "192.0.2.71" }, res: {}, user: null } as TrpcContext;
const input = { question: "What changed in investor lending?" };
const answer = {
  status: "answered",
  headline: "Lending update",
  answer: "The supplied reporting shows lender competition.",
  whyItMatters: "Borrowers can compare offers.",
  deskTake: "Check eligibility before relying on a headline rate.",
  whatWouldChangeOurMind: "Updated lender pricing.",
  signals: [],
  sourceRefs: [1],
  confidence: "medium",
};
const related = {
  feedItems: [
    {
      id: 1,
      title: "Lending update",
      summary: "Lender competition increased.",
      feedDate: "2026-09-08",
      category: "MARKETS",
    },
  ],
  editions: [],
} as unknown as Awaited<ReturnType<typeof db.searchAllContent>>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(retrieveLocalFacts).mockResolvedValue([]);
  resetAskQuotaForTests();
  vi.mocked(db.searchAllContent).mockResolvedValue(related);
  vi.mocked(db.listDailyMetrics).mockResolvedValue([]);
  vi.mocked(db.searchPropertyEvidence).mockResolvedValue([]);
  vi.mocked(invokeLLMJson).mockResolvedValue(answer);
  vi.mocked(reviewAskAnswer).mockResolvedValue(true);
  vi.mocked(createIntelligenceShareToken).mockReturnValue("verified-share-token");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Ask answer recovery", () => {
  it("limits the model's evidence and schema to a requested source count", async () => {
    vi.mocked(db.searchAllContent).mockResolvedValue({ feedItems: Array.from({ length: 12 }, (_, index) => ({ ...related.feedItems[0], id: index + 1 })), editions: [] } as typeof related);
    await askRouter.createCaller(ctx).answer({ question: "What changed in investor lending? Use at most three dated sources." });
    const call = vi.mocked(invokeLLMJson).mock.calls[0]![0];
    const prompt = call.messages.map((message) => message.content).join("\n");
    expect(prompt.match(/\[SOURCE \d+\]/g)).toHaveLength(3);
    expect(prompt).toContain("at most 3 distinct source references");
    expect(call.responseFormat).toMatchObject({ json_schema: { schema: { oneOf: [expect.objectContaining({ properties: expect.objectContaining({ sourceRefs: expect.objectContaining({ maxItems: 3 }) }) }), expect.anything()] } } });
    expect(vi.mocked(reviewAskAnswer).mock.calls[0]![2]).toHaveLength(1);
    expect(vi.mocked(reviewAskAnswer).mock.calls[0]![2][0]!.ref).toBe(1);
  });
  it("accepts repeated citations without hiding distinct invalid references", async () => {
    vi.mocked(invokeLLMJson).mockResolvedValue({ ...answer, sourceRefs: Array(12).fill(1) });
    expect(await askRouter.createCaller(ctx).answer(input)).toMatchObject({ status: "answered", answer: { sourceRefs: [1] } });
    expect(reviewAskAnswer).toHaveBeenCalledTimes(1);
  });
  it("rejects a source that was retrieved but excluded by the requested limit", async () => {
    vi.mocked(db.searchAllContent).mockResolvedValue({ feedItems: Array.from({ length: 4 }, (_, index) => ({ ...related.feedItems[0], id: index + 1 })), editions: [] } as typeof related);
    vi.mocked(invokeLLMJson).mockResolvedValue({ ...answer, sourceRefs: [4] });
    await expect(askRouter.createCaller(ctx).answer({ question: "Investor lending? Use at most three sources." })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(reviewAskAnswer).not.toHaveBeenCalled();
    expect(createIntelligenceShareToken).not.toHaveBeenCalled();
  });
  it("does not silently remove one period to fit a local comparison into one citation", async () => {
    vi.mocked(retrieveLocalFacts).mockResolvedValue(["2025-06-30", "2026-06-30"].map((date) => ({ title: "4000 QLD", date, href: `/markets?period=${date}`, publisher: "RTA", sourceUrl: "https://source.test/rents", text: "Published rent" })));
    expect(await askRouter.createCaller(ctx).answer({ question: "Compare median weekly rents in 4000 QLD in June 2025 and June 2026. Use only one source." })).toMatchObject({ status: "insufficient", sources: [] });
    expect(invokeLLMJson).not.toHaveBeenCalled();
    expect(reviewAskAnswer).not.toHaveBeenCalled();
    expect((await consumeAnonymousAsk(ctx.req)).remaining).toBe(2);
  });
  it("withholds an unsupported draft before sharing and refunds the answer allowance", async () => {
    vi.mocked(reviewAskAnswer).mockResolvedValue(false);
    expect(await askRouter.createCaller(ctx).answer(input)).toMatchObject({ status: "insufficient", sources: [{ href: "/story/1" }] });
    expect(createIntelligenceShareToken).not.toHaveBeenCalled();
    expect((await consumeAnonymousAsk(ctx.req)).remaining).toBe(2);
  });
  it("does not publish when the review is unavailable", async () => {
    vi.mocked(reviewAskAnswer).mockRejectedValue(new Error("Review unavailable"));
    await expect(askRouter.createCaller(ctx).answer(input)).rejects.toThrow("Review unavailable");
    expect(createIntelligenceShareToken).not.toHaveBeenCalled();
    expect((await consumeAnonymousAsk(ctx.req)).remaining).toBe(2);
  });
  it("bounds review spend with the existing model-attempt ceiling", async () => {
    vi.mocked(reviewAskAnswer).mockResolvedValue(false);
    const caller = askRouter.createCaller(ctx);
    for (let index = 0; index < 6; index++) await caller.answer(input);
    await expect(caller.answer(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(invokeLLMJson).toHaveBeenCalledTimes(6);
    expect(reviewAskAnswer).toHaveBeenCalledTimes(6);
  });
  it("aborts a stalled review and never signs its late result", async () => {
    vi.useFakeTimers();
    let resolve!: (supported: boolean) => void;
    vi.mocked(reviewAskAnswer).mockReturnValue(new Promise((done) => { resolve = done; }));
    const request = askRouter.createCaller(ctx).answer(input);
    const rejected = expect(request).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(0);
    const signal = vi.mocked(reviewAskAnswer).mock.calls[0]![3];
    await vi.advanceTimersByTimeAsync(ASK_SERVER_TIMEOUT_MS);
    await rejected;
    expect(signal.aborted).toBe(true);
    resolve(true); await vi.advanceTimersByTimeAsync(0);
    expect(createIntelligenceShareToken).not.toHaveBeenCalled();
    expect((await consumeAnonymousAsk(ctx.req)).remaining).toBe(2);
  });
  it("answers a factual rent lookup from stored observations through normal sharing", async () => {
    const href = "/markets?q=4000&state=QLD&areaKind=postcode&period=2026-06-30#local-data";
    vi.mocked(retrieveLocalFacts).mockResolvedValue([{
      title: "4000, QLD (postcode)", date: "2026-06-30", href,
      publisher: "RTA", sourceUrl: "https://source.test/rents.xlsx", text: "Stored rent evidence",
      localRent: { method: "New-tenancy medians; bond counts are contextual.", observations: [{
        measure: "weekly-rent", value: 850, unit: "AUD/week", period: "2026-06-30",
        category: "Flat 2", sample: 287, status: "published",
        periodLabel: "Quarter ended 30 June 2026", sampleLabel: "Bonds lodged",
      }] },
    }]);
    const result = await askRouter.createCaller(ctx).answer({ question: "What is the median weekly rent for a 2-bedroom flat in postcode 4000 QLD?" });
    expect(result).toMatchObject({ status: "answered", sources: [{ href, date: "2026-06-30" }], shareToken: "verified-share-token" });
    expect(result).toHaveProperty("answer.answer", expect.stringContaining("$850/week"));
    expect(invokeLLMJson).not.toHaveBeenCalled();
    expect(reviewAskAnswer).not.toHaveBeenCalled();
    expect(createIntelligenceShareToken).toHaveBeenCalledTimes(1);
  });
  it("answers an entirely withheld rent lookup without model speculation or a share token", async () => {
    const href = "/markets?q=4000&state=QLD&areaKind=postcode&period=2026-06-30#local-data";
    vi.mocked(retrieveLocalFacts).mockResolvedValue([{
      title: "4000, QLD (postcode)", date: "2026-06-30", href,
      publisher: "RTA", sourceUrl: "https://source.test/rents.xlsx",
      text: "House 4; withheld: suppressed; Bonds lodged: 8.", withheldRent: true,
    }]);
    const result = await askRouter.createCaller(ctx).answer({ question: "What is the median weekly rent for a 4-bedroom house in postcode 4000 QLD in June 2026?" });
    expect(result).toMatchObject({ status: "insufficient", sources: [{ href, date: "2026-06-30" }] });
    expect(result).not.toHaveProperty("answer");
    expect(invokeLLMJson).not.toHaveBeenCalled();
    expect(createIntelligenceShareToken).not.toHaveBeenCalled();
    expect((await consumeAnonymousAsk(ctx.req)).remaining).toBe(2);
  });
  it("does not bypass synthesis when only part of the requested rent evidence is withheld", async () => {
    const fact = { title: "4000, QLD", date: "2026-06-30", href: "/markets?q=4000", publisher: "RTA", sourceUrl: "https://source.test/rents.xlsx", text: "Rent evidence" };
    vi.mocked(retrieveLocalFacts).mockResolvedValue([{ ...fact, withheldRent: true }, { ...fact, withheldRent: false, date: "2025-06-30" }]);
    await askRouter.createCaller(ctx).answer({ question: "Compare median weekly rents in postcode 4000 QLD in June 2025 and June 2026" });
    expect(invokeLLMJson).toHaveBeenCalledTimes(1);
  });
  it("does not label an old metric current when its database record was freshly updated", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-09T08:00:00Z"));
    vi.mocked(db.listDailyMetrics).mockResolvedValue([{
      metricKey: "cash_rate", label: "RBA cash rate", value: "4.35", unit: "%",
      asOf: new Date("2025-01-01"), updatedAt: new Date("2026-09-09T07:00:00Z"),
      source: "RBA", groupKey: "MACRO", context: null, previousValue: null,
    }] as Awaited<ReturnType<typeof db.listDailyMetrics>>);
    await askRouter.createCaller(ctx).answer({ question: "What does the RBA cash rate mean?" });
    const messages = vi.mocked(invokeLLMJson).mock.calls[0]![0].messages.map((m) => m.content).join("\n");
    expect(messages).toContain("Stored observation: 4.35%");
    expect(messages).toContain("Older reporting period. This is not a current observation.");
    expect(messages).toContain("As of: 2025-01-01");
    expect(messages).not.toContain("Current value: 4.35%");
  });
  it("answers from stored local facts when there are no archived stories or headline metrics", async () => {
    vi.mocked(db.searchAllContent).mockResolvedValue({ feedItems: [], editions: [] });
    const href = "/markets?q=Aranda&state=ACT&areaKind=SA2#local-data";
    vi.mocked(retrieveLocalFacts).mockResolvedValue([{
      title: "Aranda, ACT (SA2): population",
      date: "2025-06-30",
      href,
      publisher: "Australian Bureau of Statistics",
      sourceUrl: "https://www.abs.gov.au/population.xlsx",
      text: "Aranda SA2 population: 2,500 people at 30 June 2025. Statistical area, not a metropolitan total.",
    }]);
    const result = await askRouter.createCaller(ctx).answer({ question: "What is the population of Aranda SA2 ACT?" });
    expect(result).toMatchObject({ status: "answered", sources: [{ href, category: "LOCAL DATA" }], shareToken: "verified-share-token" });
    expect(invokeLLMJson).toHaveBeenCalledTimes(1);
    expect(vi.mocked(invokeLLMJson).mock.calls[0]![0].messages.map(m => m.content).join(" ")).toContain("Aranda SA2 population: 2,500");
  });

  it("ranks the combined evidence before assigning citations and applying the source cap", async () => {
    const feedItems = [
      ...Array.from({ length: 12 }, (_, index) => ({
        ...related.feedItems[0],
        id: index + 1,
        title: `Investor stock news ${index}`,
        summary: "Technology companies.",
      })),
      {
        ...related.feedItems[0],
        id: 99,
        title: "Investor lending update",
        summary: "Housing loan commitments.",
      },
    ];
    vi.mocked(db.searchAllContent).mockResolvedValue({ feedItems, editions: [] } as typeof related);
    expect(await askRouter.createCaller(ctx).answer(input)).toMatchObject({
      status: "answered",
      sources: [{ href: "/story/99" }],
    });
  });

  it("keeps the matched excerpt when long edition text exceeds the evidence budget", async () => {
    vi.mocked(db.searchAllContent).mockResolvedValue({
      feedItems: [],
      editions: [
        {
          id: 1,
          editionNumber: 1,
          weekRange: "Test week",
          weekOf: "2026-09-01",
          fullText: "Other reporting. ".repeat(400),
          snippet: "Investor lending evidence near the end of this edition.",
        },
      ],
    } as unknown as typeof related);
    await askRouter.createCaller(ctx).answer(input);
    const messages = vi.mocked(invokeLLMJson).mock.calls[0]![0].messages;
    expect(messages.map((message) => message.content).join("\n")).toContain(
      "Investor lending evidence near the end of this edition."
    );
  });

  it("returns no evidence without calling the model or using an answer", async () => {
    vi.mocked(db.searchAllContent).mockResolvedValue({
      feedItems: [],
      editions: [],
    } as unknown as typeof related);
    expect(await askRouter.createCaller(ctx).answer(input)).toMatchObject({
      status: "insufficient",
      sources: [],
    });
    expect(invokeLLMJson).not.toHaveBeenCalled();
    expect((await consumeAnonymousAsk(ctx.req)).remaining).toBe(2);
  });

  it("lets the model decline related but insufficient evidence and refunds the reservation", async () => {
    vi.mocked(invokeLLMJson).mockResolvedValue({
      status: "insufficient",
      reason: "The records do not contain this lender's current investor rate.",
      relatedSourceRefs: [1],
    });
    const result = await askRouter.createCaller(ctx).answer(input);
    expect(result).toMatchObject({ status: "insufficient", sources: [{ href: "/story/1" }] });
    expect(result).not.toHaveProperty("answer");
    expect(result).not.toHaveProperty("shareToken");
    expect(createIntelligenceShareToken).not.toHaveBeenCalled();
    expect((await consumeAnonymousAsk(ctx.req)).remaining).toBe(2);
  });

  it.each([
    { relatedSourceRefs: undefined },
    { relatedSourceRefs: [] },
    { relatedSourceRefs: [999] },
  ])(
    "does not turn unselected or unknown records into suggested reading ($relatedSourceRefs)",
    async ({ relatedSourceRefs }) => {
      vi.mocked(invokeLLMJson).mockResolvedValue({
        status: "insufficient",
        reason: "No evidence for this lender.",
        relatedSourceRefs,
      });
      expect(await askRouter.createCaller(ctx).answer(input)).toMatchObject({
        status: "insufficient",
        sources: [],
      });
      expect(createIntelligenceShareToken).not.toHaveBeenCalled();
    }
  );

  it.each(["provider failure", "malformed output", "invalid citation"])(
    "refunds %s, then permits a successful retry",
    async (failure) => {
      if (failure === "provider failure")
        vi.mocked(invokeLLMJson).mockRejectedValueOnce(new Error("offline"));
      if (failure === "malformed output")
        vi.mocked(invokeLLMJson).mockResolvedValueOnce({ status: "answered" });
      if (failure === "invalid citation")
        vi.mocked(invokeLLMJson).mockResolvedValueOnce({ ...answer, sourceRefs: [1, 999] });
      const caller = askRouter.createCaller(ctx);
      await expect(caller.answer(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
      expect(createIntelligenceShareToken).not.toHaveBeenCalled();
      expect(await caller.answer(input)).toMatchObject({
        status: "answered",
        anonymousRemaining: 2,
      });
    }
  );

  it("only charges completed answers and still enforces the daily limit", async () => {
    const caller = askRouter.createCaller(ctx);
    for (const remaining of [2, 1, 0]) {
      expect(await caller.answer(input)).toMatchObject({
        status: "answered",
        anonymousRemaining: remaining,
      });
    }
    await expect(caller.answer(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(invokeLLMJson).toHaveBeenCalledTimes(3);
  });

  it("bounds refunded model attempts separately from free answers", async () => {
    vi.mocked(invokeLLMJson).mockResolvedValue({
      status: "insufficient",
      reason: "Missing current evidence.",
    });
    const caller = askRouter.createCaller(ctx);
    for (let i = 0; i < 12; i++) await caller.answer(input);
    await expect(caller.answer(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(invokeLLMJson).toHaveBeenCalledTimes(12);
    expect((await consumeAnonymousAsk(ctx.req)).remaining).toBe(2);
  });

  it("times out stalled retrieval without allowing late work to spend quota or call the model", async () => {
    vi.useFakeTimers();
    let resolve!: (value: typeof related) => void;
    vi.mocked(db.searchAllContent).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const request = askRouter.createCaller(ctx).answer(input);
    const rejected = expect(request).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(ASK_SERVER_TIMEOUT_MS);
    await rejected;
    resolve(related);
    await vi.advanceTimersByTimeAsync(0);
    expect(invokeLLMJson).not.toHaveBeenCalled();
    expect((await consumeAnonymousAsk(ctx.req)).remaining).toBe(2);
  });

  it("aborts a stalled model, refunds promptly, and never shares a late answer", async () => {
    vi.useFakeTimers();
    let resolve!: (value: typeof answer) => void;
    vi.mocked(invokeLLMJson).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const request = askRouter.createCaller(ctx).answer(input);
    const rejected = expect(request).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(0);
    const signal = vi.mocked(invokeLLMJson).mock.calls[0]![0].signal!;
    await vi.advanceTimersByTimeAsync(ASK_SERVER_TIMEOUT_MS);
    await rejected;
    expect(signal.aborted).toBe(true);
    expect((await consumeAnonymousAsk(ctx.req)).remaining).toBe(2);
    resolve(answer);
    await vi.advanceTimersByTimeAsync(0);
    expect(createIntelligenceShareToken).not.toHaveBeenCalled();
  });

  it("keeps signed-in answers unmetered", async () => {
    const caller = askRouter.createCaller({
      ...ctx,
      user: { id: 1 } as NonNullable<TrpcContext["user"]>,
    });
    for (let i = 0; i < 4; i++) expect((await caller.answer(input)).anonymousRemaining).toBeNull();
    expect((await consumeAnonymousAsk(ctx.req)).remaining).toBe(2);
  });
});

it("answers from archived state evidence absent from the daily briefing", async () => {
  vi.mocked(db.searchAllContent).mockResolvedValue({ feedItems: [], editions: [] });
  vi.mocked(db.searchPropertyEvidence).mockResolvedValue([
    {
      id: 71,
      identity: "fixture",
      title: "Hobart investor lending update",
      summary: "Tasmania housing loan commitments increased.",
      source: "Fixture",
      sourceUrl: "https://example.org/housing",
      publishedAt: new Date("2026-09-07"),
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      regions: ["TAS"],
      topics: ["credit"],
    },
  ]);
  expect(await askRouter.createCaller(ctx).answer(input)).toMatchObject({
    status: "answered",
    sources: [{ href: "/evidence/71" }],
  });
  expect(
    vi
      .mocked(invokeLLMJson)
      .mock.calls[0]![0].messages.map((message) => message.content)
      .join(" ")
  ).toContain("Public feed excerpt only");
});
