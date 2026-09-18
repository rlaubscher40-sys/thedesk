import { afterEach, expect, it, vi } from "vitest";
vi.mock("../core/llm", () => ({ invokeLLMJson: vi.fn() }));
import { invokeLLMJson } from "../core/llm";
import { reviewEditorialCopy } from "./editorialReview";
afterEach(() => vi.resetAllMocks());
const passage = "A broker described recent refinances.";
const assessment = (field: string, supported = true, evidenceQuotes = [passage]) => ({
  field,
  supported,
  evidenceQuotes,
});
it("withholds unsupported fields without rewriting supported reporting", async () => {
  vi.mocked(invokeLLMJson).mockResolvedValue({
    assessments: [assessment("summary"), assessment("whyItMatters", false, [])],
  });
  const copy = {
    summary: "The report describes a broker's refinancing examples.",
    whyItMatters: "The stress is structural, not a rate-cycle blip.",
  };
  expect(await reviewEditorialCopy(copy, { summary: passage })).toEqual({
    ...copy,
    whyItMatters: null,
  });
  expect(copy.whyItMatters).toContain("structural");
});
it("requires complete unique assessments, not an empty declaration of no problems", async () => {
  for (const result of [
    { unsupportedFields: [] },
    { assessments: [] },
    { assessments: [assessment("other")] },
    { assessments: [assessment("take")], extra: true },
  ]) {
    vi.mocked(invokeLLMJson).mockResolvedValue(result);
    await expect(reviewEditorialCopy({ take: "Draft" }, {})).rejects.toThrow();
  }
  vi.mocked(invokeLLMJson).mockResolvedValue({
    assessments: [assessment("take"), assessment("take")],
  });
  await expect(reviewEditorialCopy({ take: "Draft", angle: "Another" }, {})).rejects.toThrow();
  vi.mocked(invokeLLMJson).mockRejectedValue(new Error("offline"));
  await expect(reviewEditorialCopy({ take: "Draft" }, {})).rejects.toThrow();
});
it("withholds fabricated, absent and self-quoted anchors even when the model approves", async () => {
  for (const quotes of [
    [],
    ["All households face structural stress."],
    ["The report proves a nationwide problem."],
  ]) {
    vi.mocked(invokeLLMJson).mockResolvedValue({ assessments: [assessment("take", true, quotes)] });
    expect(
      await reviewEditorialCopy(
        { take: "The report proves a nationwide problem." },
        { summary: passage }
      )
    ).toEqual({ take: null });
  }
});
it("accepts whitespace-normalised excerpts from nested supplied evidence", async () => {
  vi.mocked(invokeLLMJson).mockResolvedValue({
    assessments: [assessment("take", true, ["described recent refinances."])],
  });
  expect(
    await reviewEditorialCopy(
      { take: "Qualified interpretation" },
      { topics: [{ summary: "A broker described\nrecent refinances." }] }
    )
  ).toEqual({ take: "Qualified interpretation" });
});
it("does not spend a call on empty copy and preserves the caller deadline", async () => {
  expect(await reviewEditorialCopy({ take: null }, {})).toEqual({ take: null });
  expect(invokeLLMJson).not.toHaveBeenCalled();
  vi.mocked(invokeLLMJson).mockResolvedValue({ assessments: [assessment("take")] });
  const signal = AbortSignal.timeout(1000);
  await reviewEditorialCopy({ take: "Qualified interpretation" }, { summary: passage }, signal);
  expect(invokeLLMJson).toHaveBeenCalledWith(
    expect.objectContaining({ signal, maxRetries: 0, maxTokens: 450 })
  );
});
