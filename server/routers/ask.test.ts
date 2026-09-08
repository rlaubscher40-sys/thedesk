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
vi.mock("../og/intelligenceCard", () => ({ renderIntelligenceCard: vi.fn() }));
vi.mock("../core/intelligenceShare", () => ({
  createIntelligenceShareToken: vi.fn(() => "verified-share-token"),
  readIntelligenceShareToken: vi.fn(),
}));
import * as db from "../db";
import { invokeLLMJson } from "../core/llm";
import { createIntelligenceShareToken } from "../core/intelligenceShare";
import { askRouter } from "./ask";

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
  resetAskQuotaForTests();
  vi.mocked(db.searchAllContent).mockResolvedValue(related);
  vi.mocked(db.listDailyMetrics).mockResolvedValue([]);
  vi.mocked(db.searchPropertyEvidence).mockResolvedValue([]);
  vi.mocked(invokeLLMJson).mockResolvedValue(answer);
  vi.mocked(createIntelligenceShareToken).mockReturnValue("verified-share-token");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Ask answer recovery", () => {
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
