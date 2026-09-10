import { z } from "zod";

export const signalSnapshotId = z.string().regex(/^[a-f0-9]{64}$/);
export const signalSnapshotSchema = z.object({
  version: z.literal(1),
  metric: z.object({
    metricKey: z.string().min(1).max(64),
    label: z.string().min(1).max(128),
    value: z.string().min(1).max(64),
    unit: z.string().max(16).nullable(),
    previousValue: z.string().max(64).nullable(),
    source: z.string().max(64).nullable(),
    sourceUrl: z.string().max(4096).nullable(),
    context: z.string().max(256).nullable(),
    asOf: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  series: z.array(z.object({ value: z.number().finite(), recordedAt: z.coerce.date() })).max(1000),
  move: z.string().max(256).nullable(),
  deskTake: z.string().max(20_000).nullable(),
  editionNumber: z.number().int().positive().nullable(),
});
export type SignalSnapshot = z.infer<typeof signalSnapshotSchema>;

export function signalSharePath(metricKey: string, snapshot: string, chart = false): string {
  return `/signals?metric=${encodeURIComponent(metricKey)}&snapshot=${snapshot}${chart ? "&view=chart" : ""}`;
}

/** A requested key must never silently select the highest-ranked alternative. */
export function selectSignal<T extends { metric: { metricKey: string } }>(
  rows: T[], requestedKey: string | null, fallback: T | null
): T | null {
  return requestedKey !== null ? rows.find(row => row.metric.metricKey === requestedKey) ?? null : fallback;
}
