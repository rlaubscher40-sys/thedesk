import { afterEach, expect, it, vi } from "vitest";
vi.mock("../core/llm", () => ({ invokeLLMJson: vi.fn() }));
import { invokeLLMJson } from "../core/llm";
import { reviewEditorialCopy } from "./editorialReview";
afterEach(() => vi.resetAllMocks());
it("withholds unsupported fields without rewriting supported reporting", async () => {
  vi.mocked(invokeLLMJson).mockResolvedValue({ unsupportedFields: ["whyItMatters"] });
  const copy = {
    summary: "The report describes a broker's refinancing examples.",
    whyItMatters: "The stress is structural, not a rate-cycle blip.",
  };
  const input = {
    title: "Homeowners switch to interest only",
    summary: "A broker described recent refinances.",
  };
  const reviewed = await reviewEditorialCopy(copy, input);
  expect(reviewed).toEqual({ ...copy, whyItMatters: null });
  expect(copy.whyItMatters).toContain("structural");
  expect(vi.mocked(invokeLLMJson).mock.calls[0]![0].messages[1]!.content).toContain(input.summary);
});
it("fails closed for unavailable, malformed or unrecognised reviews", async () => {
  for (const result of [
    { unsupportedFields: ["unrecognised"] },
    { supported: true },
    { unsupportedFields: [], extra: true },
  ]) {
    vi.mocked(invokeLLMJson).mockResolvedValue(result);
    await expect(reviewEditorialCopy({ take: "Draft" }, {})).rejects.toThrow();
  }
  vi.mocked(invokeLLMJson).mockRejectedValue(new Error("offline"));
  await expect(reviewEditorialCopy({ take: "Draft" }, {})).rejects.toThrow();
});
it("does not spend a review call on empty copy and preserves the caller deadline", async () => {
  expect(await reviewEditorialCopy({ take: null }, {})).toEqual({ take: null });
  expect(invokeLLMJson).not.toHaveBeenCalled();
  vi.mocked(invokeLLMJson).mockResolvedValue({ unsupportedFields: [] });
  const signal = AbortSignal.timeout(1000);
  await reviewEditorialCopy({ take: "Qualified interpretation" }, {}, signal);
  expect(invokeLLMJson).toHaveBeenCalledWith(
    expect.objectContaining({ signal, maxRetries: 0, maxTokens: 350 })
  );
});
