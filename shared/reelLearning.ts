import {
  firstDayReading,
  inInsightWindow,
  validMetricCount,
  type MeasuredPost,
} from "./instagramMeasurement";

export type ReelLearningRow = MeasuredPost & {
  postId: string;
  family: string;
  recipe: string | null;
  profile: string | null;
  voice: string | null;
  seconds: number | null;
  firstDayMetrics?: unknown;
};
function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Descriptive cohorts, never a causal ranking. Ratios are per post, not a ratio
 * of totals, and each metric retains its own denominator/sample count. */
export function summariseReelLearning(rows: ReelLearningRow[]) {
  const excluded = { outsideWindow: 0, noReach: 0, noProvenance: 0, duplicate: 0 };
  const seen = new Set<string>();
  const groups = new Map<
    string,
    {
      family: string;
      recipe: string;
      profile: string;
      voice: string;
      durationBand: string;
      ageBand: string;
      posts: number;
      saves: number[];
      shares: number[];
      reach: number[];
    }
  >();
  for (const original of rows) {
    if (seen.has(original.postId)) {
      excluded.duplicate++;
      continue;
    }
    seen.add(original.postId);
    const row = firstDayReading(original);
    if (!inInsightWindow(row)) {
      excluded.outsideWindow++;
      continue;
    }
    if (!validMetricCount(row.reach) || row.reach === 0) {
      excluded.noReach++;
      continue;
    }
    if (
      !row.recipe ||
      !row.profile ||
      !row.voice ||
      !row.seconds ||
      !Number.isFinite(row.seconds)
    ) {
      excluded.noProvenance++;
      continue;
    }
    const age =
      (new Date(row.metricsFetchedAt!).getTime() - new Date(row.createdAt!).getTime()) / 3600000;
    const ageStart = Math.floor(age / 6) * 6;
    const durationStart = Math.floor(row.seconds / 15) * 15;
    const labels = {
      family: row.family,
      recipe: row.recipe,
      profile: row.profile,
      voice: row.voice,
      durationBand: `${durationStart}–<${durationStart + 15}s`,
      ageBand: `${ageStart}–<${ageStart + 6}h`,
    };
    const key = JSON.stringify(labels);
    const group = groups.get(key) ?? { ...labels, posts: 0, saves: [], shares: [], reach: [] };
    group.posts++;
    group.reach.push(row.reach);
    if (validMetricCount(row.saved)) group.saves.push((row.saved / row.reach) * 1000);
    if (validMetricCount(row.shares)) group.shares.push((row.shares / row.reach) * 1000);
    groups.set(key, group);
  }
  return {
    excluded,
    cohorts: [...groups.values()]
      .map(({ saves, shares, reach, ...group }) => ({
        ...group,
        medianReach: median(reach),
        savesPerThousand: median(saves),
        savesSamples: saves.length,
        sharesPerThousand: median(shares),
        sharesSamples: shares.length,
        nextAction:
          Math.min(saves.length, shares.length) < 5
            ? "Collect at least five usable readings for each metric in this cohort before choosing an editorial test. Five is an operating minimum, not statistical significance."
            : "Review the strongest and weakest stories within this cohort. Record one hook, picture or delivery change to test; keep the other settings fixed. These observations do not establish a winner.",
      }))
      .sort(
        (a, b) =>
          a.family.localeCompare(b.family) ||
          a.recipe.localeCompare(b.recipe) ||
          a.profile.localeCompare(b.profile) ||
          a.ageBand.localeCompare(b.ageBand)
      ),
  };
}
