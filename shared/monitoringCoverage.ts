/** Successful samples are not measured wall-clock uptime. */
export function monitoringCoverage(total: number, latest: Date | string | null, now = new Date()) {
  const last = latest === null ? NaN : new Date(latest).getTime();
  const ageMinutes = Number.isFinite(last)
    ? Math.max(0, Math.floor((now.getTime() - last) / 60000))
    : null;
  const expected = (24 * 60) / 5;
  return {
    expected,
    observed: total,
    ageMinutes,
    sparse: total < expected * 0.8,
    stale: ageMinutes === null || ageMinutes > 15,
    note: "Successful checks describe sampled requests, not time-based uptime. Unobserved intervals are unknown.",
  };
}
