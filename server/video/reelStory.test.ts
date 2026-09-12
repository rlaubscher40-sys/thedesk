import { expect, it } from "vitest";
import { reelStorySegments, renderReelStory } from "./reelStory";
const video = {
  seconds: 30,
  timeline: ["label", "value", "line", "claim", "facts", "signOff"].map((key, i) => ({
    key,
    start: i * 5,
    seconds: 5,
  })),
};
it("keeps complete opening, evidence and explanation passages plus the complete takeaway", () => {
  expect(reelStorySegments(video)).toEqual([
    { start: 0, seconds: 15 },
    { start: 25, seconds: 5 },
  ]);
  expect(() => reelStorySegments({ ...video, seconds: 25 })).toThrow("timeline");
  expect(() => reelStorySegments({ ...video, timeline: video.timeline.slice(0, -1) })).toThrow(
    "timeline"
  );
  expect(() =>
    reelStorySegments({
      seconds: 60,
      timeline: video.timeline.map((s) => ({ ...s, start: s.start * 2, seconds: 10 })),
    })
  ).toThrow("35-second");
});
it("rejects missing narration or burned-in subtitles before encoding", async () => {
  await expect(
    renderReelStory({ ...video, bytes: Buffer.alloc(0), narrated: false, subtitled: true })
  ).rejects.toThrow("narrated");
  await expect(
    renderReelStory({ ...video, bytes: Buffer.alloc(0), narrated: true, subtitled: false })
  ).rejects.toThrow("subtitled");
});
