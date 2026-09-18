import { afterEach, expect, it, vi } from "vitest";
vi.mock("../core/llm", () => ({ invokeLLM: vi.fn() }));
import { invokeLLM } from "../core/llm";
import { runEditorQc, type SynthesisShape } from "./editorQc";
const input: SynthesisShape = {
  topics: [1, 2, 3].map((id) => ({
    title: `Housing report ${id}`,
    summary: "Dated source finding.",
    category: "PROPERTY",
    whyItMatters: "The source describes a proposal.",
    sourceItemIds: [id],
  })),
  signals: ["Dated signal one", "Dated signal two", "Dated signal three", "Dated signal four"],
  keyMetrics: { "Cash rate": "4.35%" },
  readingTime: "5 min",
  fullText: "Dated reporting.",
  marketStress: null,
  datesToWatch: null,
};
afterEach(() => vi.resetAllMocks());
it("rejects cross-topic, invented, missing and reordered source attribution", async () => {
  for (const replacement of [[2], [999], [], undefined]) {
    const revised = structuredClone(input);
    revised.topics[0]!.sourceItemIds = replacement;
    vi.mocked(invokeLLM).mockResolvedValue(JSON.stringify({ approved: true, notes: [], revised }));
    await expect(runEditorQc(input, "Original source packet")).rejects.toThrow(
      /source attribution/
    );
  }
  const revised = { ...input, topics: [...input.topics].reverse() };
  vi.mocked(invokeLLM).mockResolvedValue(JSON.stringify({ approved: true, notes: [], revised }));
  await expect(runEditorQc(input, "Original source packet")).rejects.toThrow(/source attribution/);
});
it("accepts wording edits and reference order changes but keeps original topic references", async () => {
  const original = structuredClone(input);
  original.topics[0]!.sourceItemIds = [1, 4];
  const revised = structuredClone(original);
  revised.topics[0]!.sourceItemIds = [4, 1];
  revised.topics[0]!.summary = "A clearer, qualified account.";
  vi.mocked(invokeLLM).mockResolvedValue(JSON.stringify({ approved: false, notes: [], revised }));
  const result = await runEditorQc(original, "Original source packet");
  expect(result.revised.topics[0]!.sourceItemIds).toEqual([1, 4]);
  expect(result.revised.topics[0]!.summary).toBe("A clearer, qualified account.");
});
it("supplies source evidence to review and preserves verified figures", async () => {
  vi.mocked(invokeLLM).mockResolvedValue(
    JSON.stringify({ approved: true, notes: [], revised: input })
  );
  const reviewed = await runEditorQc(input, "Original source packet");
  expect(reviewed.revised.keyMetrics).toEqual(input.keyMetrics);
  expect(vi.mocked(invokeLLM).mock.calls[0]![0].messages[1]!.content).toContain(
    "Original source packet"
  );
});
it("rejects review output that changes verified metrics or silently drops a topic", async () => {
  for (const revised of [
    { ...input, keyMetrics: { "Cash rate": "9%" } },
    { ...input, topics: [...input.topics, { ...input.topics[0]!, title: "Extra topic" }] },
  ]) {
    vi.mocked(invokeLLM).mockResolvedValue(JSON.stringify({ approved: false, notes: [], revised }));
    await expect(runEditorQc(input)).rejects.toThrow(/changed/);
  }
});
