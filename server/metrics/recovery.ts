import { runDailyMetricsIngest } from "../../scripts/ingest/dailyMetrics";
import { METRIC_EXPECTATIONS, metricHealth } from "../../shared/metricHealth";
import { listDailyMetrics, upsertDailyMetric } from "../db/dailyMetrics";
import { getDb } from "../db/client";
import { isDemoMode } from "../demo/store";
import { isAuctionCollectionPaused } from "../../shared/auctionCollectionPolicy";
import { collectionSignal, withCollectionWrite } from "../db/collectionRuns";

export type MetricRefreshReport = {
  startedAt: Date;
  finishedAt: Date;
  stored: number;
  unavailable: string[];
  failedWrites: string[];
  sourceErrors: Array<{ metricKey: string; reason: string }>;
};
let pending: Promise<MetricRefreshReport> | null = null;
let lastReport: MetricRefreshReport | null = null;
let lastError: string | null = null;
let startedAt: Date | null = null;

export function metricRefreshStatus() {
  return { running: pending !== null, startedAt, lastReport, lastError };
}

export async function needsMetricRecovery() {
  return metricHealth(await listDailyMetrics()).some(
    (row) =>
      !row.extracted &&
      !isAuctionCollectionPaused(row.key) &&
      [
        "missing",
        "collection overdue",
        "invalid dates",
        "old reporting period",
        "check extracted evidence",
      ].includes(row.state) &&
      // Re-downloading an unchanged release cannot make its period newer.
      // Leave the warning visible, but don't immediately fetch it again.
      (row.state !== "old reporting period" ||
        !row.storedAt ||
        Date.now() - row.storedAt.getTime() >= 6 * 60 * 60_000),
  );
}

/** Direct, authenticated/admin or scheduler collection. No self-HTTP, model,
 * email or publication call. Concurrent requests in this process share a run. */
export function refreshOfficialMetrics(): Promise<MetricRefreshReport> {
  const signal = collectionSignal();
  signal?.throwIfAborted();
  if (!signal && pending) return pending;
  if (
    !signal &&
    lastReport &&
    Date.now() - lastReport.finishedAt.getTime() < 60_000
  )
    return Promise.resolve(lastReport);
  if (!getDb() || isDemoMode())
    return Promise.reject(
      new Error("Live metric collection requires a database"),
    );
  const runStartedAt = new Date();
  startedAt = runStartedAt;
  lastError = null;
  const task = (async () => {
    const written = new Set<string>();
    const collected = new Set<string>();
    const failedWrites: string[] = [];
    const sourceErrors: MetricRefreshReport["sourceErrors"] = [];
    await runDailyMetricsIngest("", "", {
      extractFromNews: false,
      onSourceError: (metricKey, reason) => {
        sourceErrors.push({ metricKey, reason: reason.slice(0, 400) });
      },
      persist: async (metrics) => {
        await withCollectionWrite(async () => {
          for (const metric of metrics) {
            signal?.throwIfAborted();
            collected.add(metric.metricKey);
            try {
              await upsertDailyMetric({
                ...metric,
                asOf: new Date(metric.asOf),
              });
              written.add(metric.metricKey);
            } catch (error) {
              failedWrites.push(metric.metricKey);
              console.error(
                `[metrics] storage failed for ${metric.metricKey}:`,
                (error as Error).message,
              );
            }
          }
        });
      },
    });
    signal?.throwIfAborted();
    const report = {
      startedAt: runStartedAt,
      finishedAt: new Date(),
      stored: written.size,
      unavailable: METRIC_EXPECTATIONS.filter(
        (row) => !row.extracted && !collected.has(row.key),
      ).map((row) => row.key),
      failedWrites,
      sourceErrors,
    };
    if (startedAt === runStartedAt) lastReport = report;
    return report;
  })()
    .catch((error) => {
      if (startedAt === runStartedAt) lastError = (error as Error).message;
      throw error;
    })
    .finally(() => {
      if (pending === task) pending = null;
    });
  pending = task;
  signal?.addEventListener(
    "abort",
    () => {
      if (pending === task) pending = null;
    },
    { once: true },
  );
  return task;
}

/** The scheduler retries incomplete collections, preserving successful writes. */
export async function recoverMissingMetrics() {
  if (!(await needsMetricRecovery())) return;
  await runScheduledMetricRefresh();
}

/** Scheduled refreshes must check all active sources, even when retained
 * values are still fresh enough to pass the coverage review thresholds. */
export async function runScheduledMetricRefresh() {
  const report = await refreshOfficialMetrics();
  // Still expose all gaps in Admin. An intentional source pause cannot be
  // repaired by retrying all the other sources and should not exhaust retries.
  const retryableUnavailable = report.unavailable.filter(
    (key) => !isAuctionCollectionPaused(key),
  );
  if (retryableUnavailable.length || report.failedWrites.length)
    throw new Error(
      `Metric refresh stored ${report.stored}; unavailable: ${retryableUnavailable.join(", ") || "none"}; failed writes: ${report.failedWrites.join(", ") || "none"}` +
        (report.sourceErrors.length
          ? `; source errors: ${report.sourceErrors.map((error) => `${error.metricKey}: ${error.reason}`).join("; ")}`
          : ""),
    );
}
