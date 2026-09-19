import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ data: undefined as unknown, error: null as unknown }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ instagram: { reelOperations: { invalidate: vi.fn() } } }),
    instagram: {
      reelOperations: { useQuery: () => ({ data: state.data, error: state.error }) },
      saveReelReview: { useMutation: () => ({ isSuccess: false, isPending: false }) },
    },
  },
}));
import { ReelOperationsPanel } from "./ReelOperationsPanel";
const post = {
  postId: "123",
  publication: { key: "instagram-reel-test", date: "2026-09-01" },
  headline: "Example film",
  measurement: null,
  render: null,
  sourceState: "not-recorded",
  review: null,
  reviewState: "not-recorded",
};
function report(posts: unknown[] = []) {
  return {
    posts,
    historyLimit: 80,
    runway: {
      readyCount: 0,
      lastScheduled: null,
      daysRemaining: 0,
      needsProduction: true,
      nextAction: "Research the next batch.",
      rows: [],
    },
    learning: {
      excluded: { outsideWindow: 0, noReach: 0, noProvenance: 0, duplicate: 0 },
      cohorts: [],
    },
  };
}
const html = () => renderToStaticMarkup(createElement(ReelOperationsPanel));
beforeEach(() => {
  state.error = null;
  state.data = report();
});
it("distinguishes empty reports and unavailable evidence from completed work", () => {
  expect(html()).toContain("No confirmed Reel receipts");
  state.error = new Error("Unavailable");
  state.data = undefined;
  expect(html()).toContain("Missing evidence has not been counted as success");
});
it("does not offer an exact-video review for unrecorded exports", () => {
  state.data = report([post]);
  expect(html()).toContain("An exact-video review cannot be recorded");
  expect(html()).not.toContain("Save review");
});
it("starts recorded exports unreviewed and displays actual voice separately from missing delivery diagnostics", () => {
  state.data = report([
    {
      ...post,
      sourceState: "recorded",
      render: {
        videoSha256: "a".repeat(64),
        seconds: 35,
        recipe: "rent-comparison",
        voice: { engine: "elevenlabs", voice: "ruben", speed: 1 },
      },
    },
  ]);
  const output = html();
  expect(output).toContain("elevenlabs");
  expect(output).toContain("Delivery diagnostics were not recorded");
  expect(output).toContain("Review incomplete");
  expect(output).toContain("Save review");
  expect(output).not.toContain('checked=""');
  expect(output).not.toContain("Human review complete");
});
