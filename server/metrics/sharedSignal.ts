import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { signalSnapshotSchema, type SignalSnapshot } from "../../shared/signalSnapshot";

/** A snapshot request is exclusive: missing evidence never falls back to live. */
export async function loadSharedSignal(metricKey: string, snapshotId?: string): Promise<SignalSnapshot> {
  if (snapshotId !== undefined) {
    const snapshot = await db.readSignalSnapshot(snapshotId);
    if (!snapshot || snapshot.metric.metricKey !== metricKey)
      throw new TRPCError({ code: "NOT_FOUND", message: "That shared observation is unavailable. No newer value has been substituted." });
    return snapshot;
  }
  const [metrics, histories] = await Promise.all([db.listDailyMetrics(), db.listMetricHistories(30)]);
  const metric = metrics.find(row => row.metricKey === metricKey);
  if (!metric) throw new TRPCError({ code: "NOT_FOUND", message: "That signal is no longer available." });
  return signalSnapshotSchema.parse({ version: 1, metric, series: histories[metricKey] ?? [], move: null, deskTake: null, editionNumber: null });
}
