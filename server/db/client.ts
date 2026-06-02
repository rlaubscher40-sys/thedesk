/**
 * Lazy-initialised Drizzle client. Returns null when DATABASE_URL is missing
 * so the rest of the app can boot in tests without a live database, every
 * query helper that imports this checks for null.
 *
 * SSL is required for TiDB Serverless (rejects unencrypted connections).
 * We always opt into TLS, local MySQL setups accept it too, so this is a
 * safe default everywhere.
 *
 * Pool sizing is explicit rather than mysql2's default-of-10-with-no-other-
 * knobs, so the single instance behaves predictably under public load:
 *
 *   · connectionLimit — bounded (DB_POOL_SIZE, default 10) so a traffic
 *     spike can't open more connections than the TiDB cluster allows and
 *     get refused mid-request. Requests beyond the limit queue rather than
 *     fail (waitForConnections), backstopped by the upstream rate limiter.
 *   · enableKeepAlive — TiDB Serverless drops idle connections server-side;
 *     keep-alive pings stop the pool from handing out a half-dead socket
 *     ("ECONNRESET" / "PROTOCOL_CONNECTION_LOST") on the first query after
 *     a quiet period.
 *   · maxIdle + idleTimeout — let the pool shrink back toward zero when
 *     traffic subsides instead of pinning DB_POOL_SIZE connections open,
 *     which matters on a metered Serverless plan.
 */
import { createPool } from "mysql2";
import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _attempted = false;

export function getDb() {
  if (!_db && !_attempted && env.databaseUrl) {
    _attempted = true;
    try {
      const pool = createPool({
        uri: env.databaseUrl,
        ssl: { rejectUnauthorized: true },
        connectionLimit: env.dbPoolSize,
        waitForConnections: true,
        queueLimit: 0,
        maxIdle: env.dbPoolSize,
        idleTimeout: 60_000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10_000,
        connectTimeout: 15_000,
      });
      _db = drizzle(pool);
    } catch (err) {
      console.warn("[db] failed to connect:", err);
    }
  }
  return _db;
}
