import { describe, expect, it } from "vitest";
import { HOUSING_BALANCE_SNAPSHOT } from "../../shared/housingBalance";
import { verifiedHousingBalanceReel } from "../instagram/verifiedHousingBalanceReel";
import { verifiedRentReel } from "../instagram/verifiedReel";
import { DEFAULT_SPEECH_PROFILE } from "./localVoice";
import { assertProductionCandidate, productionReelOptions } from "./reelProduction";

const now = new Date("2026-09-10T12:00:00Z");
const rent = () =>
  verifiedRentReel(
    {
      status: "available",
      retrievedAt: now.toISOString(),
      observations: [
        { city: "Brisbane", annualPercent: 4.6, period: "2026-07", status: "" },
        { city: "Perth", annualPercent: 5.3, period: "2026-07", status: "" },
      ],
    },
    now
  )!;

describe("repeatable approved Reel production", () => {
  it("pins Fable at natural speed with mandatory voice and subtitles", () => {
    expect(DEFAULT_SPEECH_PROFILE).toEqual({ voice: "bm_fable", speed: 1 });
    expect(Object.isFrozen(DEFAULT_SPEECH_PROFILE)).toBe(true);
    const candidate = rent();
    expect(productionReelOptions(candidate.script)).toEqual({
      script: candidate.script,
      narrate: true,
      subtitles: true,
      voice: { voice: "bm_fable", speed: 1 },
    });
    expect(() => assertProductionCandidate(candidate)).not.toThrow();
  });
  it("preserves the reviewed housing story and rejects picture/voice drift", () => {
    const candidate = verifiedHousingBalanceReel(HOUSING_BALANCE_SNAPSHOT, now)!;
    expect(() => assertProductionCandidate(candidate)).not.toThrow();
    candidate.script[0]!.text = "A different unreviewed story.";
    expect(() => assertProductionCandidate(candidate)).toThrow("do not match");
  });
  it.each([
    "source",
    "context",
    "identity",
    "hash",
    "duplicate",
    "empty",
    "duration",
    "caption",
    "dashes",
    "spelling",
  ])("withholds a candidate with broken %s", (kind) => {
    const candidate = rent();
    if (kind === "source") candidate.stat.source = "";
    if (kind === "context") candidate.stat.subtext = "";
    if (kind === "identity") candidate.publication.key = "";
    if (kind === "hash") candidate.evidenceHash = "unverified";
    if (kind === "duplicate") candidate.script.push(candidate.script[0]!);
    if (kind === "empty") candidate.script = [];
    if (kind === "duration") candidate.script[0]!.text = "word ".repeat(200);
    if (kind === "caption") candidate.caption = "";
    if (kind === "dashes") candidate.caption += "\u2014";
    if (kind === "spelling") candidate.caption += " neighborhood";
    expect(() => assertProductionCandidate(candidate)).toThrow();
  });
});
