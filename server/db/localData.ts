import { desc, eq } from "drizzle-orm";
import {
  LOCAL_SOURCE_KEYS,
  type LocalDataset,
  type LocalSourceKey,
} from "../../shared/localData";
import { getDb } from "./client";
import { localDataHealth, localDataSnapshots } from "./localDataSchema";
import { withCollectionWrite } from "./collectionRuns";
import { cached, invalidate } from "../core/cache";

export async function readLocalDataset(
  source: LocalSourceKey,
): Promise<LocalDataset | null> {
  return cached(`local-data:${source}`, 60_000, async () => {
    const db = getDb();
    if (!db) return null;
    const rows = await db
      .select({ payload: localDataSnapshots.payload })
      .from(localDataSnapshots)
      .where(eq(localDataSnapshots.sourceKey, source))
      .orderBy(desc(localDataSnapshots.id))
      .limit(1);
    return rows[0]?.payload ?? null;
  });
}
export async function writeLocalDataset(data: LocalDataset): Promise<void> {
  if (
    !LOCAL_SOURCE_KEYS.includes(data.sourceKey) ||
    !/^[a-f0-9]{64}$/.test(data.fingerprint) ||
    data.areas.length > 12_000 ||
    Buffer.byteLength(JSON.stringify(data)) > 12_000_000
  )
    throw new Error("Invalid local dataset snapshot");
  await withCollectionWrite(async (db) => {
    const [latest] = await db
      .select({
        period: localDataSnapshots.period,
        payload: localDataSnapshots.payload,
      })
      .from(localDataSnapshots)
      .where(eq(localDataSnapshots.sourceKey, data.sourceKey))
      .orderBy(desc(localDataSnapshots.id))
      .limit(1);
    if (
      latest &&
      (latest.period > data.period ||
        latest.payload.retrievedAt > data.retrievedAt)
    )
      throw new Error("Refusing an older local data release");
    if (latest?.payload.fingerprint !== data.fingerprint)
      await db
        .insert(localDataSnapshots)
        .values({
          sourceKey: data.sourceKey,
          fingerprint: data.fingerprint,
          period: data.period,
          payload: data,
        });
  });
  invalidate(`local-data:${data.sourceKey}`);
}
export async function markLocalDataCheck(
  sourceKey: LocalSourceKey,
  error: string | null,
): Promise<void> {
  const now = new Date();
  await withCollectionWrite(async (db) => {
    await db
      .insert(localDataHealth)
      .values({
        sourceKey,
        checkedAt: now,
        lastSuccessAt: error ? null : now,
        error,
      })
      .onDuplicateKeyUpdate({
        set: {
          checkedAt: now,
          error,
          ...(!error ? { lastSuccessAt: now } : {}),
        },
      });
  });
}
export async function readLocalDataHealth() {
  const db = getDb();
  if (!db) return [];
  return db.select().from(localDataHealth);
}
