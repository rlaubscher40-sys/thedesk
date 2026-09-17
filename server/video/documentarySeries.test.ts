import { describe, expect, it } from "vitest";
import { DOCUMENTARY_EPISODES } from "../instagram/documentaryEpisodes";
import { documentaryCandidate, documentaryLaunchReady } from "../instagram/verifiedDocumentaryReel";
import {
  documentaryReviewHash,
  sealDocumentary,
  validateDocumentary,
  documentaryScript,
} from "./documentaryStory";
import { SERIES_DIRECTION, seriesCuts, seriesShots } from "./documentarySeriesDirection";
import { documentaryShotPlan } from "./documentaryShotPlan";
import { documentaryProductionDossier } from "./documentaryProduction";

describe("authored launch films", () => {
  it("preserves the accepted Harry input hash", () => {
    const harry = DOCUMENTARY_EPISODES.find((e) => e.id === "triguboff-apartments")!;
    expect(documentaryReviewHash(sealDocumentary(harry))).toBe(
      "ee8cf73ded8469d8925262eb5917cd4fdc77cc853aca14bf0c9e6c51152d9aef"
    );
  });
  it("gives every new phrase a story-specific directed visual and no Harry-only caption", () => {
    for (const episode of DOCUMENTARY_EPISODES.filter((e) => e.treatment === "series-led-v1")) {
      const plan = documentaryShotPlan(episode);
      expect(plan).toHaveLength(16);
      expect(plan.flatMap((p) => p.shots).length).toBeGreaterThan(16);
      expect(seriesCuts(episode.id)).toHaveLength(16);
      expect(plan.every((p) => p.authored)).toBe(true);
      expect(documentaryCandidate(episode).caption).not.toContain("Regis prices");
      expect(documentaryProductionDossier(episode).referenceFinancialFacts).toBeNull();
      for (const phrase of SERIES_DIRECTION.episodes[episode.id]!)
        for (const shot of phrase) {
          expect(shot.lines.length).toBeGreaterThan(0);
          if (shot.kind === "photo") expect(shot.photo).toBeDefined();
          if (["workforce", "houses"].includes(shot.kind)) expect(shot.count).toBeGreaterThan(0);
        }
    }
    expect(() => seriesShots("unwritten-film", 0)).toThrow();
    expect(() => seriesCuts("unwritten-film")).toThrow();
  });
  it("keeps four distinct launch subjects and varied authored imagery", () => {
    expect(DOCUMENTARY_EPISODES.map((episode) => episode.id).sort()).toEqual([
      "grollo-family",
      "lowy-westfield",
      "triguboff-apartments",
      "walker-rebuild",
    ]);
    for (const phrases of Object.values(SERIES_DIRECTION.episodes)) {
      const shots = phrases.flat();
      expect(new Set(shots.map((shot) => shot.kind)).size).toBeGreaterThanOrEqual(7);
      expect(
        new Set(shots.flatMap((shot) => [shot.photo, shot.secondPhoto]).filter(Boolean)).size
      ).toBeGreaterThanOrEqual(3);
      expect(shots.some((shot) => shot.kind === "photo" && shot.layout === "full")).toBe(true);
    }
  });
  it("binds new direction changes without invalidating another film", () => {
    const [film, other] = DOCUMENTARY_EPISODES;
    const before = documentaryReviewHash(sealDocumentary(film!));
    const otherBefore = documentaryReviewHash(sealDocumentary(other!));
    const shot = seriesShots(film!.id, 0)[0]!;
    const title = shot.title;
    try {
      shot.title += " revised";
      expect(documentaryReviewHash(sealDocumentary(film!))).not.toBe(before);
      expect(documentaryReviewHash(sealDocumentary(other!))).toBe(otherBefore);
    } finally {
      shot.title = title;
    }
  });
  it("rejects incomplete authored narration", () => {
    const episode = structuredClone(DOCUMENTARY_EPISODES[0]!);
    episode.scenes[0]!.phrases.pop();
    const story = sealDocumentary(episode);
    expect(() => validateDocumentary(story, documentaryScript(story))).toThrow();
  });
  it("closes the authorised launch buffer when an authored film changes", () => {
    expect(documentaryLaunchReady()).toBe(true);
    const episode = DOCUMENTARY_EPISODES[0]!;
    const phrase = episode.scenes[0]!.phrases[0]!;
    try {
      episode.scenes[0]!.phrases[0] = phrase + " Revised introduction.";
      expect(documentaryLaunchReady()).toBe(false);
    } finally {
      episode.scenes[0]!.phrases[0] = phrase;
    }
    expect(documentaryLaunchReady()).toBe(true);
  });
});
