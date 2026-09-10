import { expect, it, vi } from "vitest";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { signalSnapshotSchema } from "../../shared/signalSnapshot";
const state = vi.hoisted(() => ({ db: null as ReturnType<typeof drizzle> | null }));
vi.mock("./client", () => ({ getDb: () => state.db }));
import { readSignalSnapshot, SIGNAL_SNAPSHOT_DDL, signalFingerprint, storeSignalSnapshot } from "./signalSnapshots";

const fixture = () => signalSnapshotSchema.parse({
  version: 1, metric: { metricKey: "cash_rate", label: "Cash rate", value: "4.35", unit: "%",
    source: "RBA", sourceUrl: null, previousValue: "4.1", context: null,
    asOf: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-02T00:00:00.000Z" },
  series: [{ value: 4.35, recordedAt: "2026-07-01T00:00:00.000Z" }],
  move: null, deskTake: null, editionNumber: null,
});

it("fingerprints complete evidence and preserves identity through JSON date roundtrips", () => {
  const snapshot = fixture();
  expect(signalFingerprint(signalSnapshotSchema.parse(JSON.parse(JSON.stringify(snapshot))))).toBe(signalFingerprint(snapshot));
  for (const change of [
    { ...snapshot, metric: { ...snapshot.metric, value: "4.5" } },
    { ...snapshot, metric: { ...snapshot.metric, source: "Other" } },
    { ...snapshot, series: [{ value: 4.2, recordedAt: new Date("2026-07-01Z") }] },
    { ...snapshot, deskTake: "Revised take" },
  ]) expect(signalFingerprint(change)).not.toBe(signalFingerprint(snapshot));
});

it("rejects invalid IDs without requiring a database and fails closed on missing storage", async () => {
  expect(await readSignalSnapshot("invalid")).toBeNull();
  await expect(storeSignalSnapshot(fixture())).rejects.toThrow("requires a database");
});

const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
it.skipIf(!testUrl)("persists immutable snapshots, handles duplicates and detects corrupt stored content in MySQL", async () => {
  const url = new URL(testUrl!);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Requires the isolated local test database");
  const connection = await createConnection(testUrl!);
  try {
    await connection.query(SIGNAL_SNAPSHOT_DDL.sql.replace("CREATE TABLE", "CREATE TEMPORARY TABLE"));
    state.db = drizzle(connection);
    const original = fixture();
    const id = await storeSignalSnapshot(original);
    expect(await storeSignalSnapshot(original)).toBe(id);
    expect(await readSignalSnapshot(id)).toEqual(original);
    const revised = { ...original, metric: { ...original.metric, value: "4.5" } };
    const revisedId = await storeSignalSnapshot(revised);
    expect(revisedId).not.toBe(id);
    expect(await readSignalSnapshot(id)).toEqual(original);
    expect(await readSignalSnapshot(revisedId)).toEqual(revised);
    expect(await readSignalSnapshot("0".repeat(64))).toBeNull();
    const [rows] = await connection.query("SELECT COUNT(*) AS total FROM signal_snapshots");
    expect((rows as Array<{ total: number }>)[0].total).toBe(2);
    await connection.execute("UPDATE signal_snapshots SET snapshot = ? WHERE id = ?", [JSON.stringify(revised), id]);
    expect(await readSignalSnapshot(id)).toBeNull();
  } finally {
    state.db = null;
    await connection.end();
  }
});
