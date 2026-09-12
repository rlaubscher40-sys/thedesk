import { claimJobRun, markJobRun, readJobRun } from "../db/jobRuns";
import { fetchStoryReach } from "./api";

/** One early snapshot, dated by actual Story age. Separate media identity and
 * reach prevent counting a Story view as an original Reel view. */
export async function measureReelStory(opts: {
  reelId: string;
  storyId: string;
  date: string;
  publishedAt: Date;
  accessToken: string;
  now: Date;
}) {
  const age = opts.now.getTime() - opts.publishedAt.getTime();
  if (age < 30 * 60_000 || age > 23 * 60 * 60_000) return;
  const key = `reel-story-reach-${opts.storyId}`;
  const row = await readJobRun(key, opts.date);
  if (row?.status === "success" || row?.status === "running" || (row?.attempts ?? 0) >= 2) return;
  if (row && opts.now.getTime() - (row.finishedAt ?? row.startedAt).getTime() < 15 * 60_000) return;
  if (!(await claimJobRun(key, opts.date, 2))) return;
  let reach: number | null = null;
  let reason: string | null = null;
  try {
    reach = await fetchStoryReach({ mediaId: opts.storyId, accessToken: opts.accessToken });
  } catch {
    reason = "provider_unavailable";
  }
  const snapshot = {
    reelId: opts.reelId,
    storyId: opts.storyId,
    reach,
    observedAt: opts.now.toISOString(),
    ageMinutes: Math.round(age / 60_000),
    status: reach === null ? "unavailable" : "available",
    reason,
  };
  await markJobRun(key, opts.date, reach === null ? "failed" : "success", JSON.stringify(snapshot));
  console.log(`[reel-story-reach] ${JSON.stringify(snapshot)}`);
}
