const MINUTE = 60_000;
const INTERVAL = 5 * MINUTE;
const WINDOW = 24 * 60 * MINUTE;

/** Time-distributed sampling, never a wall-clock uptime estimate. SQL can
 * supply the first/last sample per five-minute bucket: this preserves occupied
 * buckets and every gap longer than the expected cadence. */
export function monitoringCoverage(samples: Array<Date | string>, now = new Date()) {
  const end = now.getTime();
  const start = end - WINDOW;
  const times = [...new Set(samples.map((sample) => new Date(sample).getTime()))]
    .filter((time) => Number.isFinite(time) && time >= start && time <= end)
    .sort((a, b) => a - b);
  const expected = WINDOW / INTERVAL;
  const observedIntervals = new Set(
    times.map((time) => Math.min(expected - 1, Math.floor((time - start) / INTERVAL)))
  ).size;
  const ageMinutes = times.length ? Math.floor((end - times.at(-1)!) / MINUTE) : null;
  const edges = [start, ...times, end];
  const longestGapMinutes = Math.ceil(
    Math.max(...edges.slice(1).map((time, i) => time - edges[i]!)) / MINUTE
  );
  return {
    expected,
    observedIntervals,
    coveragePercent: Math.round((observedIntervals / expected) * 1000) / 10,
    ageMinutes,
    longestGapMinutes,
    sparse: observedIntervals < expected * 0.8,
    stale: ageMinutes === null || ageMinutes > 15,
    hasLongGap: longestGapMinutes > 15,
    note: "Successful checks describe sampled requests, not time-based uptime. Unobserved intervals are unknown.",
  };
}
