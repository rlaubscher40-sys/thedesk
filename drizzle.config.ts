import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * TiDB Serverless rejects unencrypted connections. The driver picks up the
 * `?ssl={...}` query parameter from the connection string when present, but
 * drizzle-kit (the migration runner) doesn't always parse it. Setting `ssl`
 * explicitly here covers both: the driver uses the bundled CA bundle that
 * AWS hosts, which matches what TiDB Cloud signs with.
 */
export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
    ssl: { rejectUnauthorized: true },
  },
  verbose: true,
  strict: true,
});
