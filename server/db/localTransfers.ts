import { and, gte, lte, sql } from "drizzle-orm";
import { LOCAL_SOURCE_KEYS, type LocalSourceKey } from "../../shared/localData";
import { withCollectionWrite } from "./collectionRuns";
import { getDb } from "./client";
import { localTransferStats as stats } from "./collectionEfficiencySchema";

export type LocalTransfer =
  | { status: "downloaded"; bodyBytes: number }
  | { status: "unchanged"; previousBodyBytes?: number };
export async function recordLocalTransfer(
  sourceKey: LocalSourceKey,
  transfer: LocalTransfer,
  now = new Date()
) {
  const bytes = transfer.status === "downloaded" ? transfer.bodyBytes : transfer.previousBodyBytes;
  if (
    !LOCAL_SOURCE_KEYS.includes(sourceKey) ||
    (transfer.status === "downloaded" && bytes === undefined) ||
    (bytes !== undefined && (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 10_000_000)) ||
    !Number.isFinite(now.getTime())
  )
    throw new Error("Invalid local transfer measurement");
  const values = {
    sourceKey,
    day: now.toISOString().slice(0, 10),
    downloads: transfer.status === "downloaded" ? 1 : 0,
    unchanged: transfer.status === "unchanged" ? 1 : 0,
    bodyBytes: transfer.status === "downloaded" ? bytes! : 0,
    estimatedAvoidedBytes: transfer.status === "unchanged" ? (bytes ?? 0) : 0,
    unknownSize: transfer.status === "unchanged" && bytes === undefined ? 1 : 0,
    firstMeasuredAt: now,
  };
  await withCollectionWrite(async (db) => {
    await db
      .insert(stats)
      .values(values)
      .onDuplicateKeyUpdate({
        set: {
          downloads: sql`${stats.downloads} + ${values.downloads}`,
          unchanged: sql`${stats.unchanged} + ${values.unchanged}`,
          bodyBytes: sql`${stats.bodyBytes} + ${values.bodyBytes}`,
          estimatedAvoidedBytes: sql`${stats.estimatedAvoidedBytes} + ${values.estimatedAvoidedBytes}`,
          unknownSize: sql`${stats.unknownSize} + ${values.unknownSize}`,
        },
      });
  });
}

export async function readLocalTransfers(now = new Date()) {
  const db = getDb();
  if (!db) throw new Error("Transfer measurements unavailable");
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 29);
  const rows = await db
    .select()
    .from(stats)
    .where(
      and(
        gte(stats.day, from.toISOString().slice(0, 10)),
        lte(stats.day, now.toISOString().slice(0, 10))
      )
    );
  return LOCAL_SOURCE_KEYS.map((sourceKey) => {
    const entries = rows.filter((row) => row.sourceKey === sourceKey);
    return {
      sourceKey,
      downloads: entries.reduce((n, row) => n + row.downloads, 0),
      unchanged: entries.reduce((n, row) => n + row.unchanged, 0),
      bodyBytes: entries.reduce((n, row) => n + row.bodyBytes, 0),
      estimatedAvoidedBytes: entries.reduce((n, row) => n + row.estimatedAvoidedBytes, 0),
      unknownSize: entries.reduce((n, row) => n + row.unknownSize, 0),
      firstMeasuredAt: entries.map((row) => row.firstMeasuredAt.toISOString()).sort()[0] ?? null,
    };
  });
}
