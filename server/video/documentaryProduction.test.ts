import { describe, expect, it } from "vitest";
import { DOCUMENTARY_EPISODES } from "../instagram/documentaryEpisodes";
import { documentaryProductionDossier, newDocumentaryBrief } from "./documentaryProduction";
import { documentaryShotPlan, measuredDocumentaryShots } from "./documentaryShotPlan";

describe("repeatable documentary production", () => {
  it("accounts for every measured phrase and every visual across different episode structures", () => {
    for (const episode of DOCUMENTARY_EPISODES) {
      const timeline = episode.scenes.map((s, i) => ({
        key: s.key,
        start: i * 10,
        seconds: 9,
        phrases: s.phrases.map((text, j) => ({ text, start: j * 4.5, seconds: 4 })),
      }));
      const shots = measuredDocumentaryShots(episode, timeline, 80);
      expect(new Set(shots.map((s) => s.id)).size).toBe(shots.length);
      expect(new Set(shots.map((s) => s.narration)).size).toBe(
        episode.scenes.flatMap((s) => s.phrases).length
      );
      for (const shot of shots) {
        expect(shot.inspectAt).toBeGreaterThan(shot.start);
        expect(shot.inspectAt).toBeLessThan(shot.end);
        expect(shot.end).toBeLessThan(80);
        expect(shot.sources.length).toBeGreaterThan(0);
      }
      expect(shots.length).toBe(documentaryShotPlan(episode).flatMap((p) => p.shots).length);
    }
  });
  it("rejects swapped, incomplete and unmeasured narration before making a review sheet", () => {
    const episode = DOCUMENTARY_EPISODES[0]!;
    const timeline = episode.scenes.map((s, i) => ({
      key: s.key,
      start: i * 10,
      seconds: 9,
      phrases: s.phrases.map((text, j) => ({ text, start: j * 4.5, seconds: 4 })),
    }));
    expect(() => measuredDocumentaryShots(episode, timeline.slice(1), 80)).toThrow();
    timeline[0]!.phrases[0]!.text = "A different story.";
    expect(() => measuredDocumentaryShots(episode, timeline, 80)).toThrow("script");
  });
  it("carries the complete episode evidence while leaving human judgement pending", () => {
    for (const episode of DOCUMENTARY_EPISODES) {
      const dossier = documentaryProductionDossier(episode);
      for (const source of episode.scenes.flatMap((s) => s.sources))
        expect(dossier.sources[source]).toBeDefined();
      expect(dossier.manualReview.every((r) => r.verdict === "pending")).toBe(true);
      expect(dossier.published).toBe(false);
    }
  });
  it("starts a new subject with empty evidence and no publishing slot or invented money", () => {
    const brief = newDocumentaryBrief("lang-walker", "Lang Walker", "Property Empires");
    expect(brief.claims).toEqual([]);
    expect(brief.sources).toEqual([]);
    expect(brief.releaseDate).toBeNull();
    expect(brief.status).toBe("research-required");
    expect(brief.turningPoints.every((t) => t.event === null && t.decision === null)).toBe(true);
    expect(() => newDocumentaryBrief("../bad", "Someone", "The Deal")).toThrow();
  });
});
