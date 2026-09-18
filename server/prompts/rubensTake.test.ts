import { afterEach, expect, it, vi } from "vitest";
vi.mock("../core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./editorialReview", () => ({ reviewEditorialCopy: vi.fn() }));
import { invokeLLM } from "../core/llm";
import { reviewEditorialCopy } from "./editorialReview";
import { generateRubensTake } from "./rubensTake";
const input = { weekRange: "A dated week", topics: [], keyMetrics: {} };
afterEach(() => vi.resetAllMocks());
it("returns only independently reviewed opening commentary", async () => {
  vi.mocked(invokeLLM).mockResolvedValue(
    "A qualified interpretation of the week's housing reports."
  );
  vi.mocked(reviewEditorialCopy).mockResolvedValue({ take: "Reviewed interpretation." });
  expect(await generateRubensTake(input)).toBe("Reviewed interpretation.");
  expect(reviewEditorialCopy).toHaveBeenCalledWith(
    expect.objectContaining({ take: expect.any(String) }),
    input,
    expect.any(AbortSignal)
  );
});
it("does not persist a take whose review rejects its factual premise", async () => {
  vi.mocked(invokeLLM).mockResolvedValue("Existing home prices now have a guaranteed floor.");
  vi.mocked(reviewEditorialCopy).mockResolvedValue({ take: null });
  await expect(generateRubensTake(input)).rejects.toThrow("evidence review");
});
