import { afterEach, expect, it, vi } from "vitest";
vi.mock("../core/llm", () => ({ invokeLLM: vi.fn() }));
import { invokeLLM } from "../core/llm";
import { generateSayThis } from "./sayThis";
import { generateWhyItMatters } from "./whyItMatters";
import { generatePartnerTag } from "./partnerTag";
afterEach(() => vi.resetAllMocks());
const input = {
  title: "NSW rental release",
  summary: "NSW quarterly rent growth was 0.8%. NSW annual rent growth was 3.2%.",
  category: "PROPERTY",
};
it.each([generateSayThis, generateWhyItMatters])(
  "applies the same source checks to manual/backfill generation",
  async (generate) => {
    vi.mocked(invokeLLM).mockResolvedValue("NSW annual rent growth was 0.8%.");
    expect(await generate(input)).toBeNull();
    vi.mocked(invokeLLM).mockResolvedValue("NSW annual rent growth was 3.2%.");
    expect(await generate(input)).toBe("NSW annual rent growth was 3.2%.");
    expect(await generate({ ...input, summary: null })).toBeNull();
  }
);
it("does not let an existing generated tag validate its replacement", async () => {
  const output =
    "Buying: NSW annual rent growth was 0.8%.\nHolding: Check the reporting period.\nWatching: Read the next release.";
  vi.mocked(invokeLLM).mockResolvedValue(output);
  expect(await generatePartnerTag({ ...input, existingTag: output })).toBeNull();
  vi.mocked(invokeLLM).mockResolvedValue(output.replace("annual", "quarterly"));
  expect(await generatePartnerTag(input)).toBe(output.replace("annual", "quarterly"));
});
