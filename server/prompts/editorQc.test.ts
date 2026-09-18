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
