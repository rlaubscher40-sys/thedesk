/**
 * Lazy-initialised Drizzle client. Returns null when DATABASE_URL is missing
 * so the rest of the app can boot in tests without a live database — every
 * query helper that imports this checks for null.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _attempted = false;

export function getDb() {
  if (!_db && !_attempted && env.databaseUrl) {
    _attempted = true;
    try {
      _db = drizzle(env.databaseUrl);
    } catch (err) {
      console.warn("[db] failed to connect:", err);
    }
  }
  return _db;
}
