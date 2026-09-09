import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { LOCAL_DATA_DDL } from "./localDataSchema";
import sa from "../localData/releases/sa-2026-06";

const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
let pool: Pool;
let runs: typeof import("./collectionRuns");
let data: typeof import("./localData");
const key = "local-data-sa-reviewed-release";
const day = "2026-09-09";
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Local data tests require the isolated local test database");
  pool = createPool(testUrl);
  for (const ddl of LOCAL_DATA_DDL)
    await pool.query(ddl.sql.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS "));
  await pool.query(`CREATE TABLE IF NOT EXISTS job_runs (
    id INT AUTO_INCREMENT PRIMARY KEY, jobKey VARCHAR(64) NOT NULL,
    runDate VARCHAR(10) NOT NULL, status VARCHAR(16) NOT NULL,
    attempts INT NOT NULL DEFAULT 1, detail TEXT,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, finishedAt TIMESTAMP NULL,
    UNIQUE KEY uq_job_runs_key_date (jobKey, runDate))`);
  await pool.query("DELETE FROM job_runs WHERE jobKey = ? AND runDate = ?", [key, day]);
  await pool.query("DELETE FROM local_data_snapshots WHERE sourceKey = 'sa-bond-rents'");
  await pool.query("DELETE FROM local_data_health WHERE sourceKey = 'sa-bond-rents'");
  vi.doMock("./client", () => ({getDb: () => drizzle(pool)}));
  vi.doMock("../demo/store", () => ({isDemoMode: () => false}));
  runs = await import("./collectionRuns");
  data = await import("./localData");
});
afterAll(async () => { await pool?.end(); });

it.skipIf(!testUrl)("stores the reviewed release under a lease and atomically preserves existing data and access health", async () => {
  const lease = await runs.claimCollectionRun(key, day, 2);
  expect(lease).not.toBeNull();
  await runs.runCollectionAttempt(lease!, async () => {
    await data.markLocalDataCheck("sa-bond-rents", "Publisher HTTP 403");
    await data.writeLocalDataset(sa, {onlyIfMissing:true});
    // Even a candidate with a later retrieval date must not overwrite an existing snapshot.
    await data.writeLocalDataset({...sa, retrievedAt:"2026-09-10T00:00:00Z", fingerprint:"a".repeat(64)}, {onlyIfMissing:true});
  });
  const [snapshots] = await pool.query("SELECT fingerprint, period FROM local_data_snapshots WHERE sourceKey = 'sa-bond-rents'");
  expect(snapshots).toEqual([{fingerprint:sa.fingerprint,period:sa.period}]);
  const [health] = await pool.query("SELECT error, lastSuccessAt FROM local_data_health WHERE sourceKey = 'sa-bond-rents'");
  expect(health).toEqual([{error:"Publisher HTTP 403",lastSuccessAt:null}]);
  expect(await runs.finishCollectionRun(lease!, "success")).toBe(true);
});
