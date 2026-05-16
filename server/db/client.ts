/**
 * Lazy-initialised Drizzle client. Returns null when DATABASE_URL is missing
 * so the rest of the app can boot in tests without a live database — every
 * query helper that imports this checks for null.
 *
 * SSL is required for TiDB Serverless (rejects unencrypted connections).
 * We always opt into TLS — local MySQL setups accept it too, so this is a
 * safe default everywhere.
 */
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _attempted = false;

export function getDb() {
  if (!_db && !_attempted && env.databaseUrl) {
    _attempted = true;
    try {
      const pool = mysql.createPool({
        uri: env.databaseUrl,
        ssl: { rejectUnauthorized: true },
      });
      _db = drizzle(pool);
    } catch (err) {
      console.warn("[db] failed to connect:", err);
    }
  }
  return _db;
}
