import { runDailyMetricsIngest } from "../../scripts/ingest/dailyMetrics";
import { METRIC_EXPECTATIONS, metricHealth } from "../../shared/metricHealth";
import { listDailyMetrics, upsertDailyMetric } from "../db/dailyMetrics";
import { getDb } from "../db/client";
import { isDemoMode } from "../demo/store";

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
      !row.extracted && ["missing", "collection overdue", "invalid dates", "old reporting period", "check extracted evidence"].includes(row.state)
  );
}

/** Direct, authenticated/admin or scheduler collection. No self-HTTP, model,
 * email or publication call. Concurrent requests in this process share a run. */
export function refreshOfficialMetrics(): Promise<MetricRefreshReport> {
  if (pending) return pending;
  if (lastReport && Date.now() - lastReport.finishedAt.getTime() < 60_000)
    return Promise.resolve(lastReport);
  if (!getDb() || isDemoMode())
    return Promise.reject(new Error("Live metric collection requires a database"));
  startedAt = new Date();
  lastError = null;
  pending = (async () => {
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
        for (const metric of metrics) {
          collected.add(metric.metricKey);
          try {
            await upsertDailyMetric({ ...metric, asOf: new Date(metric.asOf) });
            written.add(metric.metricKey);
          } catch (error) {
            failedWrites.push(metric.metricKey);
            console.error(
              `[metrics] storage failed for ${metric.metricKey}:`,
              (error as Error).message
            );
          }
        }
      },
    });
    lastReport = {
      startedAt: startedAt!,
      finishedAt: new Date(),
      stored: written.size,
      unavailable: METRIC_EXPECTATIONS.filter(
        (row) => !row.extracted && !collected.has(row.key)
      ).map((row) => row.key),
      failedWrites,
      sourceErrors,
    };
    return lastReport;
  })()
    .catch((error) => {
      lastError = (error as Error).message;
      throw error;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** The scheduler retries incomplete collections, preserving successful writes. */
export async function recoverMissingMetrics() {
  if (!(await needsMetricRecovery())) return;
  const report = await refreshOfficialMetrics();
  if (report.unavailable.length || report.failedWrites.length)
    throw new Error(
      `Metric refresh stored ${report.stored}; unavailable: ${report.unavailable.join(", ") || "none"}; failed writes: ${report.failedWrites.join(", ") || "none"}` +
        (report.sourceErrors.length
          ? `; source errors: ${report.sourceErrors.map((error) => `${error.metricKey}: ${error.reason}`).join("; ")}`
          : "")
    );
}

