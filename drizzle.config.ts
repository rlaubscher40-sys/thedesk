import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * TiDB Serverless rejects unencrypted connections. drizzle-kit silently
 * ignores the `ssl` option when `dbCredentials.url` is set — it only
 * honours it on split host/port/user/password form. So we parse the URL
 * ourselves and pass it split.
 */
function buildCredentials() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is required to run drizzle-kit commands");
  }
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "test",
    ssl: { rejectUnauthorized: true },
  };
}

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: buildCredentials(),
  verbose: true,
  strict: true,
});
