import { DOCUMENTARY_RELEASE_DATES } from "./documentaryReleasePlan";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { DOCUMENTARY_EPISODES } from "./documentaryEpisodes";
import {
  documentaryCandidate,
  documentaryLaunchReady,
  getDocumentaryProgramme,
} from "./verifiedDocumentaryReel";
import {
  documentaryReviewHash,
  sealDocumentary,
  validateDocumentary,
} from "../video/documentaryStory";
import { assertProductionCandidate } from "../video/reelProduction";
import { createDocumentaryRenderer } from "../video/documentaryRenderer";
import { DOCUMENTARY_PHOTOS } from "../../shared/documentaryPhotos";
import { documentarySlot, inReelWindow } from "../../shared/instagramSchedule";
import { reelDurationLimit } from "../video/statReel";
import * as cards from "../og/instagramCards";

const reviews = vi.hoisted(
  () =>
    ({}) as Record<
      string,
      { hash: string; seconds: number; videoSha256: string; reviewedAt: string }
    >
);
vi.mock("./documentaryReviews", () => ({ DOCUMENTARY_REVIEWS: reviews }));
afterEach(() => {
  for (const key of Object.keys(reviews)) delete reviews[key];
  vi.restoreAllMocks();
});
function reviewAll() {
  for (const e of DOCUMENTARY_EPISODES)
    reviews[e.id] = {
      hash: documentaryReviewHash(sealDocumentary(e)),
      seconds: e.series === "The Deal" ? 75 : 110,
      videoSha256: "a".repeat(64),
      reviewedAt: "2026-09-14",
    };
}
describe("documentary publishing gate", () => {
  it("allows the expanded biography within three minutes without lengthening other formats", () => {
    reviewAll();
    const episode = DOCUMENTARY_EPISODES.find((e) => e.id === "triguboff-apartments")!;
    expect(reelDurationLimit(documentaryCandidate(episode).stat)).toBe(180);
    reviews[episode.id]!.seconds = 175;
    expect(documentaryLaunchReady()).toBe(true);
    reviews[episode.id]!.seconds = 181;
    expect(documentaryLaunchReady()).toBe(false);
    reviews[episode.id]!.seconds = 175;
    reviews["grollo-family"]!.seconds = 151;
    expect(documentaryLaunchReady()).toBe(false);
    expect(reelDurationLimit()).toBe(32);
  });
  it("requires all four matching reviews, and a changed script invalidates approval", () => {
    expect(documentaryLaunchReady()).toBe(false);
    reviewAll();
    expect(documentaryLaunchReady()).toBe(true);
    reviews[DOCUMENTARY_EPISODES[0]!.id]!.hash = "b".repeat(64);
    expect(documentaryLaunchReady()).toBe(false);
    expect(
      getDocumentaryProgramme(new Date("2026-09-16T08:30:00Z")).every((e) => !e.candidate)
    ).toBe(true);
  });
  it("selects only the assigned Sydney day and series, never catches up another episode", () => {
    reviewAll();
    for (const episode of DOCUMENTARY_EPISODES) {
      const now = new Date(`${DOCUMENTARY_RELEASE_DATES[episode.id]}T08:30:00Z`);
      expect(documentarySlot(now)).toBe(episode.series);
      const candidates = getDocumentaryProgramme(now).filter((e) => e.candidate);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.candidate!.stat.documentary!.id).toBe(episode.id);
    }
    for (const date of ["2026-09-15", "2026-09-17", "2026-10-01", "2026-10-04"])
      expect(
        getDocumentaryProgramme(new Date(`${date}T08:30:00Z`)).every((e) => !e.candidate)
      ).toBe(true);
    expect(getDocumentaryProgramme(new Date(NaN)).every((e) => !e.candidate)).toBe(true);
  });
  it("uses the existing window correctly through daylight saving", () => {
    expect(documentarySlot(new Date("2026-10-04T07:30:00Z"))).toBe("Property Empires");
    expect(inReelWindow(new Date("2026-10-04T07:29:59Z"))).toBe(false);
    expect(inReelWindow(new Date("2026-10-04T07:30:00Z"))).toBe(true);
    expect(inReelWindow(new Date("2026-10-04T09:00:00Z"))).toBe(false);
  });
  it("rejects drift and preserves episode identity when a script or release slot is revised", () => {
    for (const episode of DOCUMENTARY_EPISODES) {
      const candidate = documentaryCandidate(episode);
      expect(() => assertProductionCandidate(candidate)).not.toThrow();
      const changed = structuredClone(candidate);
      changed.script[0]!.text += " Unsupported assertion.";
      expect(() => assertProductionCandidate(changed)).toThrow();
      const badSource = structuredClone(candidate.stat.documentary!);
      badSource.scenes[0]!.sources = ["unknown" as never];
      expect(() => validateDocumentary(badSource, candidate.script)).toThrow();
      const revised = structuredClone(episode);
      revised.releaseDate = "2027-01-01";
      revised.scenes[0]!.phrases[0] += " A revised introduction.";
      const next = documentaryCandidate(revised);
      expect(next.publication).toEqual(candidate.publication);
      expect(next.evidenceHash).not.toBe(candidate.evidenceHash);
    }
  });
});

it("renders every documentary scene within the shared safe areas using credited, matching images", async () => {
  for (const photo of Object.values(DOCUMENTARY_PHOTOS)) {
    const bytes = await cards.loadAsset(photo.asset);
    expect(
      createHash("sha256")
        .update(Buffer.from(bytes!.split(",")[1]!, "base64"))
        .digest("hex")
    ).toBe(photo.sha256);
    expect(photo.licence).toMatch(/^https:\/\//);
  }
  for (const episode of DOCUMENTARY_EPISODES) {
    const story = sealDocumentary(episode);
    const scenes = story.scenes.map((s, i) => ({
      key: s.key,
      start: i * 10,
      seconds: 9,
      phrases: s.phrases.map((text, j) => ({ text, start: j * 4, seconds: 4 })),
    }));
    const draw = await createDocumentaryRenderer(story, scenes, 80);
    for (const scene of scenes)
      for (const offset of [2, 7])
        expect((await draw(scene.start + offset)).length).toBe(1080 * 1920 * 4);
    await expect(draw(80)).rejects.toThrow("timeline");
  }
}, 30_000);

it("fails before encoding when a reviewed photograph is absent or changed", async () => {
  const story = sealDocumentary(DOCUMENTARY_EPISODES[0]!);
  const scenes = story.scenes.map((s, i) => ({
    key: s.key,
    start: i * 10,
    seconds: 9,
    phrases: s.phrases.map((text, j) => ({ text, start: j * 4, seconds: 4 })),
  }));
  const asset = vi.spyOn(cards, "loadAsset").mockResolvedValue(null);
  await expect(createDocumentaryRenderer(story, scenes, 80)).rejects.toThrow("missing");
  asset.mockResolvedValue("data:image/jpeg;base64,Y2hhbmdlZA==");
  await expect(createDocumentaryRenderer(story, scenes, 80)).rejects.toThrow("changed");
});
