import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATCHUP_STATEMENTS } from "./catchup";

/**
 * Drift guard.
 *
 * The production database has no drizzle migration journal, so `runCatchup`
 * (driven by CATCHUP_STATEMENTS) is what brings a stale schema up to date on
 * boot. If a new migration adds a column but nobody adds the matching
 * catch-up entry, the running code's `SELECT *` will throw against any DB
 * that hasn't been hand-migrated — exactly the outage this list exists to
 * prevent. This test fails the build in that case.
 *
 * It only checks `ALTER TABLE … ADD <column>` statements (the incremental
 * additions). Columns defined inside a `CREATE TABLE` in 0000_init are part
 * of the base schema and are assumed to exist.
 */

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "..", "..", "drizzle");

/** Strip backticks and collapse whitespace so the two sources compare cleanly. */
function normalise(sql: string): string {
  return sql.replace(/`/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Extract every `ALTER TABLE <table> ADD <column>` pair from a SQL blob. */
function extractAddColumns(sql: string): Array<{ table: string; column: string }> {
  const out: Array<{ table: string; column: string }> = [];
  const re = /alter\s+table\s+`?(\w+)`?\s+add\s+(?:column\s+)?`?(\w+)`?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.push({ table: m[1]!.toLowerCase(), column: m[2]!.toLowerCase() });
  }
  return out;
}

describe("catch-up migration coverage", () => {
  const catchupAdds = new Set(
    CATCHUP_STATEMENTS.flatMap((s) =>
      extractAddColumns(normalise(s.sql)).map((a) => `${a.table}.${a.column}`)
    )
  );

  const migrationAdds = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .flatMap((f) =>
      extractAddColumns(readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
    );

  it("finds ADD COLUMN statements in the migrations (sanity check)", () => {
    // If this is zero the regex broke; the coverage assertion would pass
    // vacuously and the guard would be useless.
    expect(migrationAdds.length).toBeGreaterThan(0);
  });

  it.each(migrationAdds.map((a) => [`${a.table}.${a.column}`] as const))(
    "covers migration column %s in CATCHUP_STATEMENTS",
    (key) => {
      expect(catchupAdds.has(key)).toBe(true);
    }
  );
});
