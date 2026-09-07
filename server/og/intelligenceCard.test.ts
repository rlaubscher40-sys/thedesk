import { describe, expect, it } from "vitest";
import { renderIntelligenceCard } from "./intelligenceCard";

const base = {
  question: "What is changing in investor lending?",
  headline: "Credit capacity is doing more of the work than sentiment.",
  answer:
    "The archive points to borrowing capacity and lender competition as the more useful near-term signal. The rate headline matters, but the transmission into approvals and investor activity is where the practical change shows up.",
  deskTake:
    "The better question is whether more borrowers can transact at today's prices. If capacity keeps improving, demand can strengthen before the public narrative changes.",
  confidence: "medium" as const,
  sourceCount: 4,
};

describe("renderIntelligenceCard", () => {
  it("renders a non-trivial 4:5 PNG without a numeric signal", async () => {
    const png = await renderIntelligenceCard(base);
    expect(png).toBeInstanceOf(Buffer);
    expect(png.byteLength).toBeGreaterThan(20_000);
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("renders the signal treatment when an explicit archive metric is supplied", async () => {
    const png = await renderIntelligenceCard({
      ...base,
      signal: {
        label: "Investor lending",
        value: "+7.2%",
        context: "Change cited in the evidence used for this brief.",
      },
    });
    expect(png.byteLength).toBeGreaterThan(20_000);
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("clamps long distribution copy rather than failing layout", async () => {
    const png = await renderIntelligenceCard({
      ...base,
      headline: "A very long property intelligence thesis ".repeat(8),
      answer: "Supporting archive evidence and context. ".repeat(40),
      deskTake: "A disciplined interpretation of the evidence. ".repeat(30),
    });
    expect(png.byteLength).toBeGreaterThan(20_000);
  });
});

describe("market comparison cards", () => {
  it("renders the comparison treatment with an explicit verdict", async () => {
    const png = await renderIntelligenceCard({
      ...base,
      comparison: { marketA: "Brisbane", marketB: "Perth" },
      headline: "Brisbane vs Perth",
      answer: "No clear edge on the available evidence.",
    });
    expect(png.byteLength).toBeGreaterThan(20_000);
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1350);
  });
});
