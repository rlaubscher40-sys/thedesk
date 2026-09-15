import { describe, expect, it } from "vitest";
import { reelCoverDesign } from "./reelCover";
import { renderCoverArtwork } from "./reelCoverArtwork";
import { verifiedInterstateMigration } from "../instagram/verifiedContextReels";
import { contextNow, testMigration } from "../instagram/fixtures/contextReels";
import { documentaryCandidate } from "../instagram/verifiedDocumentaryReel";
import { DOCUMENTARY_EPISODES } from "../instagram/documentaryEpisodes";

describe("cover evidence and release boundaries", () => {
  it.each([-4000, 0, 4000])(
    "retains the sign and interstate meaning of quarterly flow %s",
    (flow) => {
      const data = testMigration();
      data.observations
        .filter((r) => r.state === "Queensland" && r.measure === "netInternalMigration")
        .forEach((r) => {
          r.people = flow;
        });
      const candidate = verifiedInterstateMigration(data, contextNow)!;
      const design = reelCoverDesign(candidate.stat, candidate.script);
      expect(design.subject).toBe("Queensland");
      expect(design.figure).toBe(flow < 0 ? "−16,000" : flow > 0 ? "+16,000" : "0");
      expect(design.headline).toBe(
        flow < 0
          ? "Net interstate departures."
          : flow > 0
            ? "Net interstate arrivals."
            : "No net interstate change."
      );
      expect(design.detail).toContain("Arrivals minus departures");
    }
  );

  it("does not let a changed data photograph reach publication", async () => {
    const c = verifiedInterstateMigration(testMigration(), contextNow)!;
    const design = reelCoverDesign(c.stat, c.script);
    await expect(
      renderCoverArtwork({ ...design, photo: { ...design.photo, sha256: "0".repeat(64) } })
    ).rejects.toThrow("Reviewed photograph changed");
  });

  it("keeps cover edits separate from the accepted documentary script and visual inputs", () => {
    const c = documentaryCandidate(
      DOCUMENTARY_EPISODES.find((e) => e.id === "triguboff-apartments")!
    );
    const before = JSON.stringify(c);
    const design = reelCoverDesign(c.stat, c.script);
    expect(design.subject).toBe("Harry Triguboff");
    expect(design.period).toBe("Meriton / founded 1963");
    expect(JSON.stringify(c)).toBe(before);
  });
});
