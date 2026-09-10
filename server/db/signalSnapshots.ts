import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { signalSnapshotId, signalSnapshotSchema, type SignalSnapshot } from "../../shared/signalSnapshot";
import { getDb } from "./client";
import { signalSnapshots } from "./schema";

export const SIGNAL_SNAPSHOT_DDL = {
  name: "signal evidence · immutable shared snapshots",
  sql: `CREATE TABLE signal_snapshots (
  id VARCHAR(64) PRIMARY KEY,
  snapshot JSON NOT NULL,
  storedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
};

export function signalFingerprint(snapshot: SignalSnapshot): string {
  return createHash("sha256").update(JSON.stringify(signalSnapshotSchema.parse(snapshot))).digest("hex");
}

/** Only server-retrieved records enter here; no public arbitrary-payload writes. */
export async function storeSignalSnapshot(input: SignalSnapshot): Promise<string> {
  const snapshot = signalSnapshotSchema.parse(input);
  const db = getDb();
  if (!db) throw new Error("Shared signal persistence requires a database");
  const id = signalFingerprint(snapshot);
  // A duplicate is a no-op, including storedAt. Never revise an existing share.
  await db.insert(signalSnapshots).values({ id, snapshot })
    .onDuplicateKeyUpdate({ set: { id: sql`${signalSnapshots.id}` } });
  return id;
}

export async function readSignalSnapshot(id: string): Promise<SignalSnapshot | null> {
  if (!signalSnapshotId.safeParse(id).success) return null;
  const db = getDb();
  if (!db) throw new Error("Shared signal retrieval requires a database");
  const [row] = await db.select().from(signalSnapshots).where(eq(signalSnapshots.id, id)).limit(1);
  if (!row) return null;
  const parsed = signalSnapshotSchema.safeParse(row.snapshot);
  if (!parsed.success || signalFingerprint(parsed.data) !== id) return null;
  return parsed.data;
}
