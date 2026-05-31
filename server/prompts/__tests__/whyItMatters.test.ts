import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM core so no network call fires.
vi.mock("../../core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../core/llm";
import { generateWhyItMatters } from "../whyItMatters";

const mockedInvoke = vi.mocked(invokeLLM);

const input = {
  title: "RBA holds cash rate at 4.35% for second straight meeting",
  summary: "The Reserve Bank kept rates on hold, citing sticky services inflation.",
  category: "MACRO",
};

describe("generateWhyItMatters", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("returns the trimmed line on a normal response", async () => {
    mockedInvoke.mockResolvedValue(
      "  Back-to-back holds signal the tightening cycle is done, watch for refinancing demand to lift.  "
    );
    const result = await generateWhyItMatters(input);
    expect(result).toBe(
      "Back-to-back holds signal the tightening cycle is done, watch for refinancing demand to lift."
    );
  });

  it("strips wrapping quotes the model sometimes adds", async () => {
    mockedInvoke.mockResolvedValue('"Watch for renewed investor borrowing capacity."');
    const result = await generateWhyItMatters(input);
    expect(result).toBe("Watch for renewed investor borrowing capacity.");
  });

  it("returns null when the model emits the SKIP token", async () => {
    mockedInvoke.mockResolvedValue("SKIP");
    expect(await generateWhyItMatters(input)).toBeNull();
  });

  it("returns null on an over-long response", async () => {
    mockedInvoke.mockResolvedValue("x".repeat(321));
    expect(await generateWhyItMatters(input)).toBeNull();
  });

  it("returns null rather than throwing when the LLM errors", async () => {
    mockedInvoke.mockRejectedValue(new Error("network down"));
    expect(await generateWhyItMatters(input)).toBeNull();
  });
});
