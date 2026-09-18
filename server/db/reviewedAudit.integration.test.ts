import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
const name = "reviewed_audit_" + randomUUID().replaceAll("-", "");
let setup: Pool | undefined, pool: Pool | undefined;
let edition: typeof import("./reviewedEditionCorrection").applyReviewedEditionCorrection;
let evidence: typeof import("./reviewedEvidenceCorrection").applyReviewedEvidenceCorrection;
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Requires isolated local CI database");
  setup = createPool(testUrl);
  await setup.query(`CREATE DATABASE \`${name}\``);
  url.pathname = "/" + name;
  pool = createPool(url.toString());
  await pool.query(
    "CREATE TABLE editions (id INT PRIMARY KEY, editionNumber INT, weekOf VARCHAR(64), topics JSON, fullText TEXT, rubensTake TEXT, lookback JSON, datesToWatch JSON)"
  );
  await pool.query(
    "CREATE TABLE property_evidence (id INT PRIMARY KEY, title TEXT, source TEXT, regions JSON)"
  );
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool!) }));
  edition = (await import("./reviewedEditionCorrection")).applyReviewedEditionCorrection;
  evidence = (await import("./reviewedEvidenceCorrection")).applyReviewedEvidenceCorrection;
});
afterAll(async () => {
  await pool?.end();
  if (setup) {
    await setup.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await setup.end();
  }
});
it.skipIf(!testUrl)(
  "corrects exact edition text in JSON and text columns, preserving revisions and other weeks",
  async () => {
    const before =
      "The cut everyone was waiting for is off the table, the next move is up, and a falling housing market will not change the RBA's mind.";
    const topics = [{ keyTakeaway: before, sourceItemIds: [7], body: "A later editor's wording." }];
    for (const [id, week] of [
      [1, "2026-09-07"],
      [2, "2026-09-14"],
    ])
      await pool!.query("INSERT INTO editions SET ?", {
        id,
        editionNumber: 17,
        weekOf: week,
        topics: JSON.stringify(topics),
        fullText: before,
      });
    await edition();
    await edition();
    const [rows] = await pool!.query<RowDataPacket[]>("SELECT * FROM editions ORDER BY id");
    const corrected =
      typeof rows[0]!.topics === "string" ? JSON.parse(rows[0]!.topics) : rows[0]!.topics;
    expect(rows[0]!.fullText).toContain("remains uncertain");
    expect(corrected[0].keyTakeaway).toBe(rows[0]!.fullText);
    expect(corrected[0].body).toBe(topics[0]!.body);
    expect(corrected[0].sourceItemIds).toEqual([7]);
    expect(rows[1]!.fullText).toBe(before);
    await pool!.query("UPDATE editions SET fullText=? WHERE id=1", ["An editor's newer text."]);
    await edition();
    const [updated] = await pool!.query<RowDataPacket[]>(
      "SELECT fullText FROM editions WHERE id=1"
    );
    expect(updated[0]!.fullText).toBe("An editor's newer text.");
  }
);
it.skipIf(!testUrl)(
  "removes only the audited NSW classification without deleting source evidence",
  async () => {
    const title =
      "Builder defends controversial Newcastle housing plans after row over council land deal";
    await pool!.query("INSERT INTO property_evidence SET ?", {
      id: 287372,
      title,
      source: "Yahoo News UK",
      regions: '["NSW"]',
    });
    await evidence();
    await evidence();
    const [rows] = await pool!.query<RowDataPacket[]>(
      "SELECT title, JSON_LENGTH(regions) AS count FROM property_evidence WHERE id=287372"
    );
    expect(rows[0]).toMatchObject({ title, count: 0 });
    await pool!.query("UPDATE property_evidence SET title=?,regions='[\"NSW\"]' WHERE id=287372", [
      "A corrected NSW article",
    ]);
    await evidence();
    const [revised] = await pool!.query<RowDataPacket[]>(
      "SELECT JSON_LENGTH(regions) AS count FROM property_evidence WHERE id=287372"
    );
    expect(revised[0]!.count).toBe(1);
  }
);
