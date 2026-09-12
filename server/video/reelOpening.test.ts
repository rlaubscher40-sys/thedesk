import { describe, expect, it } from "vitest";
import { evidenceOpening } from "./reelOpening";
import { reelCoverContent, renderReelCover } from "./reelCover";
import { verifiedInterstateMigration } from "../instagram/verifiedContextReels";
import { contextNow, testMigration } from "../instagram/fixtures/contextReels";
import { housingBalanceStoryboard, renderHousingBalanceFrame } from "./housingBalanceStoryboard";
import { HOUSING_BALANCE_SNAPSHOT } from "../../shared/housingBalance";

describe("specific evidence-bound Reel openings", () => {
  it.each(["question", "consequence"] as const)(
    "keeps the housing %s opening inside its actual rendered text bounds",
    async (opening) => {
      await expect(
        renderHousingBalanceFrame(
          housingBalanceStoryboard(HOUSING_BALANCE_SNAPSHOT, opening),
          "label",
          1,
          "navy"
        )
      ).resolves.toBeInstanceOf(Buffer);
    }
  );
  it.each([16000, -16000, 0])("preserves net migration meaning at %s", (value) => {
    const opening = evidenceOpening("interstate-migration", [{ label: "Queensland", value }]);
    expect(opening.voice).toContain(
      value > 0
        ? "net interstate gain"
        : value < 0
          ? "net interstate loss"
          : "arrivals matched its departures"
    );
    expect(opening.voice).not.toMatch(/homes|Brisbane|population growth/);
  });
  it("does not turn tied or negative rent changes into growth claims or price rankings", () => {
    const rows = [
      { label: "Brisbane", value: -2 },
      { label: "Perth", value: -1 },
    ];
    expect(evidenceOpening("rent-comparison", rows).headline).toBe("Perth's rate is higher.");
    rows[0]!.value = -1;
    expect(evidenceOpening("rent-comparison", rows).headline).toBe("Two cities. Same rate.");
    expect(evidenceOpening("capital-rents", rows).headline).toBe("-1.0% in every capital.");
    expect(
      evidenceOpening("rent-change", [
        { label: "prior", value: 3.8 },
        { label: "latest", value: 3.5 },
      ]).headline
    ).toBe("Sydney's rate is lower.");
  });
  it("refuses changed source/script or an unreviewed recipe instead of making a generic cover", async () => {
    const candidate = verifiedInterstateMigration(testMigration(), contextNow)!;
    expect(() =>
      reelCoverContent({ ...candidate.stat, source: "Other source" }, candidate.script)
    ).toThrow("attribution changed");
    await expect(
      renderReelCover(candidate.stat, [{ key: "label", text: "Unverified headline" }])
    ).rejects.toThrow();
    await expect(
      renderReelCover({ label: "New", value: "1", line: "New", subtext: "New" }, [])
    ).rejects.toThrow("reviewed recipe");
  });
});
