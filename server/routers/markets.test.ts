import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../core/context";
import { resetAskQuotaForTests } from "../core/askQuota";
import { comparisonAnswer, comparisonEvidence } from "../markets/comparison.fixture";
vi.mock("../markets/evidence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../markets/evidence")>()),
  retrieveMarketEvidence: vi.fn(),
}));
vi.mock("../core/llm", () => ({ invokeLLMJson: vi.fn() }));
import { retrieveMarketEvidence } from "../markets/evidence";
import { invokeLLMJson } from "../core/llm";
import { marketsRouter } from "./markets";
import { readIntelligenceShareToken } from "../core/intelligenceShare";
const input = { marketA: "Brisbane", marketB: "Perth" };
const ctx = { req: { ip: "192.0.2.5" }, res: {}, user: null } as TrpcContext;
beforeEach(() => {
  vi.clearAllMocks();
  resetAskQuotaForTests();
  vi.mocked(retrieveMarketEvidence).mockResolvedValue(
    comparisonEvidence.map((source) => ({ ...source, date: new Date().toISOString().slice(0, 10) }))
  );
  vi.mocked(invokeLLMJson).mockResolvedValue(comparisonAnswer);
});
describe("markets.compare", () => {
  it("returns a trusted, re-readable shared comparison", async () => {
    const result = await marketsRouter.createCaller(ctx).compare(input);
    expect(result.status).toBe("compared");
    if (result.status !== "compared") throw new Error("Expected comparison");
    expect(readIntelligenceShareToken(result.shareToken)?.comparison).toEqual(result.comparison);
    expect(result.anonymousRemaining).toBe(2);
  });
  it("skips the model when either market has no local evidence", async () => {
    vi.mocked(retrieveMarketEvidence).mockResolvedValue([comparisonEvidence[0]!]);
    expect((await marketsRouter.createCaller(ctx).compare(input)).status).toBe("insufficient");
    expect(invokeLLMJson).not.toHaveBeenCalled();
  });
  it("never mints a share token from an invalid generated claim", async () => {
    vi.mocked(invokeLLMJson).mockResolvedValue({
      ...comparisonAnswer,
      verdict: "Brisbane will grow 55%.",
    });
    const result = await marketsRouter.createCaller(ctx).compare(input);
    expect(result.status).toBe("insufficient");
    expect(result).not.toHaveProperty("shareToken");
  });
  it("shares the anonymous Ask quota and blocks work before retrieval", async () => {
    const caller = marketsRouter.createCaller(ctx);
    for (let i = 0; i < 3; i++) await caller.compare(input);
    await expect(caller.compare(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(retrieveMarketEvidence).toHaveBeenCalledTimes(3);
  });
  it("keeps authenticated usage unmetered and rejects identical markets", async () => {
    const caller = marketsRouter.createCaller({
      ...ctx,
      user: { id: 1 } as NonNullable<TrpcContext["user"]>,
    });
    for (let i = 0; i < 4; i++) expect((await caller.compare(input)).anonymousRemaining).toBeNull();
    await expect(caller.compare({ marketA: "Perth", marketB: "perth" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
