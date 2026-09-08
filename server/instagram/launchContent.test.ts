import { describe, expect, it } from "vitest";
import { buildMarketDirectory } from "../markets/discovery";
import { buildLaunchContent, launchContentHash } from "./launchContent";

function directory(a = 4.6, b = 5.3, period = "2026-07") {
  const result = buildMarketDirectory([], "2026-09-08");
  result.markets = result.markets.map((file) => ({
    ...file,
    rents: {
      status: "available",
      retrievedAt: "2026-09-08T00:00:00Z",
      observations: [
        { city: "Brisbane", period, annualPercent: a, status: "" },
        { city: "Perth", period, annualPercent: b, status: "" },
      ],
    },
  }));
  return result;
}

describe("trusted launch copy", () => {
  it("derives both numbers, period and gap from the same official read", () => {
    const content = buildLaunchContent("comparison", directory());
    expect(content.caption).toContain("Brisbane 4.6% vs Perth 5.3%");
    expect(content.caption).toContain("July 2026");
    expect(content.caption).toContain("0.7pp");
    expect(content.comparison?.take).toContain("Perth");
    expect(content.caption).toContain("No overall investment winner");
  });
  it("changes the read when the evidence reverses, including a tie", () => {
    expect(buildLaunchContent("comparison", directory(6, 4)).comparison?.take).toContain(
      "Brisbane"
    );
    expect(buildLaunchContent("comparison", directory(4, 4)).comparison?.take).toContain("level");
  });
  it("withholds stale, missing, mismatched and demo evidence", () => {
    expect(() => buildLaunchContent("comparison")).toThrow();
    expect(() => buildLaunchContent("comparison", directory(4, 5, "2025-07"))).toThrow();
    const demo = directory();
    demo.demo = true;
    expect(() => buildLaunchContent("comparison", demo)).toThrow();
    const mismatch = directory();
    for (const file of mismatch.markets) file.rents!.observations[1]!.period = "2026-06";
    expect(() => buildLaunchContent("comparison", mismatch)).toThrow();
  });
  it("binds review to the actual copy/data, and preserves the live homepage handoff", () => {
    const original = buildLaunchContent("comparison", directory());
    expect(launchContentHash(original)).toBe(
      launchContentHash(buildLaunchContent("comparison", directory()))
    );
    expect(launchContentHash(original)).not.toBe(
      launchContentHash(buildLaunchContent("comparison", directory(4.7)))
    );
    for (const id of ["start", "how"] as const) {
      const content = buildLaunchContent(id);
      expect(content.slides).toHaveLength(5);
      expect(content.caption).toContain("tap Markets");
      expect(content.caption.length).toBeLessThan(2200);
    }
  });
});
