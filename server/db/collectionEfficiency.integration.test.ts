import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { DAILY_BRIEF_DDL } from "./dailyBriefSchema";
import { FEED_ENRICHMENT_DDL } from "./feedEnrichmentSchema";
import { FEED_EVIDENCE_DDL } from "./feedEvidenceSchema";
import { createEvidenceDuplicateIndex } from "../../shared/storyEvidenceDuplicate";
import { COLLECTION_EFFICIENCY_DDL } from "./collectionEfficiencySchema";
import type { InsertDailyFeedItem } from "./schema";

const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
let pool: Pool;
let brief: typeof import("./dailyBrief");
let claims: typeof import("./feedClaims");
let transfers: typeof import("./localTransfers");
let recovery: typeof import("./feedEnrichment");
let worker: typeof import("../feed/enrichmentWorker");
const emptyAngles = { partnerTag: null, sayThis: null, whyItMatters: null, counterpoint: null };
const generate = vi.fn(async () => emptyAngles);
let feed: typeof import("./feed");
const item: InsertDailyFeedItem = {
  feedDate: "2026-09-09",
  title: "Concurrent article",
  source: "concurrency-test",
  sourceUrl: "https://concurrency-test.example/article?id=1",
  summary: "Verified excerpt",
  category: "PROPERTY",
  channel: "PROPERTY",
};
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Use the isolated local test database");
  pool = createPool(testUrl);
  for (const ddl of [
    ...COLLECTION_EFFICIENCY_DDL,
    ...FEED_ENRICHMENT_DDL,
    ...FEED_EVIDENCE_DDL,
    ...DAILY_BRIEF_DDL,
  ])
    await pool.query(ddl.sql.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS "));
  await pool.query(`CREATE TABLE IF NOT EXISTS daily_feed_items (
    id INT AUTO_INCREMENT PRIMARY KEY, sourceTiming JSON, feedDate VARCHAR(10) NOT NULL,
    title VARCHAR(512) NOT NULL, source VARCHAR(256) NOT NULL, sourceUrl TEXT,
    summary TEXT NOT NULL, category VARCHAR(64) NOT NULL, channel VARCHAR(32) NOT NULL DEFAULT 'AU',
    imageUrl TEXT, partnerTag TEXT, sayThis TEXT, whyItMatters TEXT, counterpoint TEXT,
    corroborationCount INT NOT NULL DEFAULT 1, corroboratingSources JSON, threadParentId INT,
    threadParentTitle TEXT, rubensNote TEXT, priority INT NOT NULL DEFAULT 50,
    promotedToEdition BOOLEAN DEFAULT FALSE, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS subscribers (
    id INT PRIMARY KEY, email VARCHAR(320) NOT NULL UNIQUE, name VARCHAR(128),
    confirmedAt TIMESTAMP NULL, unsubscribedAt TIMESTAMP NULL, lastDailyBriefDate VARCHAR(10)
  )`);
  await pool.query("DELETE FROM daily_feed_items WHERE source = 'concurrency-test'");
  await pool.query("DELETE FROM feed_ingest_claims");
  await pool.query("DELETE FROM feed_enrichment_jobs");
  await pool.query("DELETE FROM local_transfer_stats");
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool) }));
  vi.doMock("../demo/store", () => ({ isDemoMode: () => false }));
  vi.doMock("../prompts/dailyAngles", () => ({ generateDailyAngles: generate }));
  recovery = await import("./feedEnrichment");
  worker = await import("../feed/enrichmentWorker");
  brief = await import("./dailyBrief");
  claims = await import("./feedClaims");
  transfers = await import("./localTransfers");
  feed = await import("./feed");
});
afterAll(async () => {
  await pool?.end();
});

it.skipIf(!testUrl)(
  "keeps private evidence fingerprints after enrichment input cleanup and excludes held rows",
  async () => {
    const stamp = new Date().toISOString();
    const row = {
      ...item,
      feedDate: stamp.slice(0, 10),
      title: "Australian housing approvals fall as builders face delays",
      sourceUrl: "https://concurrency-test.example/evidence",
      articleText: Array.from({ length: 160 }, (_, i) => `evidenceword${i}`).join(" "),
      sourceTiming: {
        publisherDateStatus: "available" as const,
        publisherPublishedAt: stamp,
        feedReportedAt: null,
        retrievedAt: stamp,
      },
    };
    const id = await claims.insertFeedOnce(row);
    try {
      expect(id).toBeGreaterThan(0);
      const [stored] = await pool.query(
        "SELECT fingerprint FROM feed_evidence_fingerprints WHERE feedItemId=?",
        [id]
      );
      expect(stored).toHaveLength(1);
      expect(JSON.stringify(stored)).not.toContain("evidenceword");
      await pool.query(
        "UPDATE feed_enrichment_jobs SET input=NULL, status='completed' WHERE feedItemId=?",
        [id]
      );
      const { recentEditorialStories } = await import("./editorial");
      const history = await recentEditorialStories();
      const previous = history.find((entry) => entry.id === id)!;
      expect(previous.evidenceFingerprint).toBeTruthy();
      expect(previous).not.toHaveProperty("articleText");
      expect(createEvidenceDuplicateIndex(history).find(row)?.id).toBe(id);
      await pool.query("UPDATE daily_feed_items SET channel='HOLD' WHERE id=?", [id]);
      expect((await recentEditorialStories()).some((entry) => entry.id === id)).toBe(false);
    } finally {
      // This fixture must not affect the existing concurrency row-count test.
      await pool.query("DELETE FROM feed_evidence_fingerprints WHERE feedItemId=?", [id]);
      await pool.query("DELETE FROM feed_enrichment_jobs WHERE feedItemId=?", [id]);
      await pool.query("DELETE FROM feed_ingest_claims WHERE feedItemId=?", [id]);
      await pool.query("DELETE FROM daily_feed_items WHERE id=?", [id]);
    }
  }
);

it.skipIf(!testUrl)(
  "gives only one simultaneous worker an inserted ID, including tracking variants",
  async () => {
    const now = new Date("2026-09-09T00:00:00Z");
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        claims.insertFeedOnce(
          { ...item, sourceUrl: `${item.sourceUrl}&utm_source=worker${i}` },
          now
        )
      )
    );
    expect(results.filter((id) => id > 0)).toHaveLength(1);
    expect(results.filter((id) => id === 0)).toHaveLength(5);
    const [rows] = await pool.query(
      "SELECT id FROM daily_feed_items WHERE source = 'concurrency-test'"
    );
    expect(rows).toHaveLength(1);
  }
);
it.skipIf(!testUrl)("rolls failed insertion back so a retry can win", async () => {
  const row = { ...item, sourceUrl: "https://concurrency-test.example/retry" };
  await expect(claims.insertFeedOnce({ ...row, title: "x".repeat(513) })).rejects.toThrow();
  const [locks] = await pool.query("SELECT identity FROM feed_ingest_claims WHERE identity=?", [
    claims.feedClaimIdentity(row),
  ]);
  expect(locks).toHaveLength(0);
  expect(await claims.insertFeedOnce(row)).toBeGreaterThan(0);
});
it.skipIf(!testUrl)("keeps result indices and duplicate/failure counts distinct", async () => {
  const row = { ...item, sourceUrl: "https://concurrency-test.example/indices" };
  const result = await feed.createFeedItems([
    row,
    row,
    { ...row, sourceUrl: "https://concurrency-test.example/invalid", title: "x".repeat(513) },
  ]);
  expect(result.ids[0]).toBeGreaterThan(0);
  expect(result.ids.slice(1)).toEqual([0, 0]);
  expect(result).toMatchObject({ duplicateCount: 1, failedCount: 1 });
});
it.skipIf(!testUrl)(
  "preserves the 14-day acceptance window without resetting it on a duplicate",
  async () => {
    const row = { ...item, sourceUrl: "https://concurrency-test.example/window" };
    expect(await claims.insertFeedOnce(row, new Date("2026-08-01"))).toBeGreaterThan(0);
    expect(await claims.insertFeedOnce(row, new Date("2026-08-14"))).toBe(0);
    expect(await claims.insertFeedOnce(row, new Date("2026-08-15"))).toBeGreaterThan(0);
  }
);
it.skipIf(!testUrl)(
  "atomically counts concurrent responses and labels unknown estimates separately",
  async () => {
    const now = new Date("2026-09-09T00:00:00Z");
    await Promise.all(
      Array.from({ length: 5 }, () =>
        transfers.recordLocalTransfer(
          "nsw-bond-rents",
          { status: "downloaded", bodyBytes: 100 },
          now
        )
      )
    );
    await Promise.all(
      Array.from({ length: 3 }, () =>
        transfers.recordLocalTransfer(
          "nsw-bond-rents",
          { status: "unchanged", previousBodyBytes: 100 },
          now
        )
      )
    );
    await transfers.recordLocalTransfer("nsw-bond-rents", { status: "unchanged" }, now);
    await transfers.recordLocalTransfer(
      "nsw-bond-rents",
      { status: "downloaded", bodyBytes: 500 },
      new Date("2026-07-01")
    );
    expect(
      (await transfers.readLocalTransfers(now)).find((r) => r.sourceKey === "nsw-bond-rents")
    ).toMatchObject({
      downloads: 5,
      unchanged: 4,
      bodyBytes: 500,
      estimatedAvoidedBytes: 300,
      unknownSize: 1,
    });
  }
);

async function freshJob(key: string, extra: Partial<InsertDailyFeedItem> = {}) {
  await pool.query("DELETE FROM feed_enrichment_jobs");
  generate.mockReset().mockResolvedValue(emptyAngles);
  return claims.insertFeedOnce({
    ...item,
    sourceUrl: `https://concurrency-test.example/job-${key}`,
    articleText: "Grounding detail",
    ...extra,
  });
}
it.skipIf(!testUrl)("holds unsupported generated figures at the database boundary and records the review state", async () => {
  const id = await freshJob("claim-evidence");
  const claim = (await recovery.claimFeedEnrichment())!;
  const before = (await feed.getFeedItemById(id))!;
  await recovery.completeFeedEnrichment(claim, { ...emptyAngles, sayThis: "Rent rose 999%.", whyItMatters: "Check the original reporting." }, before);
  expect(await feed.getFeedItemById(id)).toMatchObject({ sayThis: null, whyItMatters: "Check the original reporting." });
  const [jobs] = await pool.query("SELECT status, reason, input FROM feed_enrichment_jobs WHERE feedItemId=?", [id]);
  expect((jobs as any[])[0]).toMatchObject({ status: "completed", reason: "claim_fields_held", input: null });
  expect((await recovery.feedEnrichmentHealth()).claimHolds.map((j) => j.feedItemId)).toContain(id);
});

it.skipIf(!testUrl)(
  "commits one durable job with the winning story and rolls both back on failure",
  async () => {
    const id = await freshJob("atomic");
    expect(await recovery.feedEnrichmentStates([id])).toMatchObject([{ feedItemId: id, status: "pending", attempts: 0 }]);
    expect(
      await claims.insertFeedOnce({
        ...item,
        sourceUrl: "https://concurrency-test.example/job-atomic?utm_source=again",
      })
    ).toBe(0);
    const [rows] = await pool.query("SELECT feedItemId, input FROM feed_enrichment_jobs");
    expect(rows).toHaveLength(1);
    expect((rows as any[])[0].feedItemId).toBe(id);
    await expect(
      claims.insertFeedOnce({
        ...item,
        title: "x".repeat(513),
        sourceUrl: "https://concurrency-test.example/job-rollback",
      })
    ).rejects.toThrow();
    const [after] = await pool.query("SELECT feedItemId FROM feed_enrichment_jobs");
    expect(after).toHaveLength(1);
  }
);

it.skipIf(!testUrl)(
  "only one worker claims a job and an expired worker cannot write after recovery",
  async () => {
    const id = await freshJob("lease");
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () => recovery.claimFeedEnrichment())
    );
    const winners = attempts.filter((c) => c !== null);
    expect(winners).toHaveLength(1);
    const stale = winners[0]!;
    const before = (await feed.getFeedItemById(id))!;
    await pool.query(
      "UPDATE feed_enrichment_jobs SET availableAt=DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)"
    );
    // Even before takeover, an expired owner's write is fenced.
    expect(
      await recovery.completeFeedEnrichment(stale, { ...emptyAngles, sayThis: "stale" }, before)
    ).toBe(false);
    const next = (await recovery.claimFeedEnrichment())!;
    expect(next.owner).not.toBe(stale.owner);
    expect(next.attempts).toBe(2);
    expect(
      await recovery.completeFeedEnrichment(stale, { ...emptyAngles, sayThis: "stale" }, before)
    ).toBe(false);
    expect(
      await recovery.completeFeedEnrichment(next, { ...emptyAngles, sayThis: "Recovered" }, before)
    ).toBe(true);
    await recovery.failFeedEnrichment(stale);
    expect((await feed.getFeedItemById(id))?.sayThis).toBe("Recovered");
    expect(await recovery.claimFeedEnrichment()).toBeNull();
  }
);

it.skipIf(!testUrl)(
  "resumes a saved job, treats intentional nulls as complete and never calls AI again",
  async () => {
    const id = await freshJob("nulls");
    await worker.drainFeedEnrichment();
    await worker.drainFeedEnrichment();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ articleText: "Grounding detail" }),
      expect.objectContaining({ strict: true, signal: expect.any(AbortSignal) })
    );
    const [rows] = await pool.query(
      "SELECT status, input FROM feed_enrichment_jobs WHERE feedItemId=?",
      [id]
    );
    expect((rows as any[])[0]).toMatchObject({ status: "completed", input: null });
  }
);

it.skipIf(!testUrl)(
  "preserves presets and concurrent manual edits while filling only remaining gaps",
  async () => {
    const id = await freshJob("manual", { sayThis: "Source supplied" });
    const claim = (await recovery.claimFeedEnrichment())!;
    const before = (await feed.getFeedItemById(id))!;
    await feed.updateFeedItemWhyItMatters(id, "Editor supplied while model ran");
    await feed.updateFeedItemPartnerTag(id, "");
    await recovery.completeFeedEnrichment(
      claim,
      {
        partnerTag: "Generated",
        sayThis: "Generated",
        whyItMatters: "Generated",
        counterpoint: "A second side",
      },
      before
    );
    expect(await feed.getFeedItemById(id)).toMatchObject({
      partnerTag: "",
      sayThis: "Source supplied",
      whyItMatters: "Editor supplied while model ran",
      counterpoint: "A second side",
    });
  }
);

it.skipIf(!testUrl)(
  "discards stale output when the story changes and skips deleted stories",
  async () => {
    const id = await freshJob("changed");
    const claim = (await recovery.claimFeedEnrichment())!;
    const before = (await feed.getFeedItemById(id))!;
    await pool.query("UPDATE daily_feed_items SET summary='Edited summary' WHERE id=?", [id]);
    await recovery.completeFeedEnrichment(
      claim,
      { ...emptyAngles, sayThis: "Old story output" },
      before
    );
    expect((await feed.getFeedItemById(id))?.sayThis).toBeNull();
    expect((await recovery.feedEnrichmentHealth()).counts.skipped).toBe(1);
    const deleted = await freshJob("deleted");
    await feed.deleteFeedItem(deleted);
    await worker.drainFeedEnrichment();
    expect(generate).not.toHaveBeenCalled();
    expect((await recovery.feedEnrichmentHealth()).counts.skipped).toBe(1);
  }
);

it.skipIf(!testUrl)(
  "backs off failed generation and stops after three attempts, visible in Admin",
  async () => {
    const id = await freshJob("retries");
    generate.mockRejectedValue(new Error("provider unavailable"));
    for (let attempt = 1; attempt <= 3; attempt++) {
      await worker.drainFeedEnrichment();
      expect(generate).toHaveBeenCalledTimes(attempt);
      // Immediate polling does not bypass the retry delay.
      await worker.drainFeedEnrichment();
      expect(generate).toHaveBeenCalledTimes(attempt);
      await pool.query(
        "UPDATE feed_enrichment_jobs SET availableAt=DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)"
      );
    }
    await worker.drainFeedEnrichment();
    expect(generate).toHaveBeenCalledTimes(3);
    expect(await recovery.feedEnrichmentHealth()).toMatchObject({
      counts: { failed: 1 },
      recentFailures: [{ feedItemId: id, attempts: 3, reason: "attempts_exhausted" }],
    });
    const [rows] = await pool.query("SELECT input FROM feed_enrichment_jobs");
    expect((rows as any[])[0].input).toBeNull();
  }
);

it.skipIf(!testUrl)("exhausts abandoned leases without a fourth model call", async () => {
  await freshJob("abandoned");
  for (let i = 0; i < 3; i++) {
    expect((await recovery.claimFeedEnrichment())?.attempts).toBe(i + 1);
    await pool.query(
      "UPDATE feed_enrichment_jobs SET availableAt=DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)"
    );
  }
  expect(await recovery.claimFeedEnrichment()).toBeNull();
  expect((await recovery.feedEnrichmentHealth()).counts.failed).toBe(1);
});

it.skipIf(!testUrl)(
  "makes no model call for fully supplied angles or coverage-only channels",
  async () => {
    await freshJob("preset", {
      partnerTag: "preset",
      sayThis: "preset",
      whyItMatters: "preset",
      counterpoint: "preset",
    });
    await worker.drainFeedEnrichment();
    expect(generate).not.toHaveBeenCalled();
    await freshJob("coverage", { channel: "BUSINESS" });
    await worker.drainFeedEnrichment();
    expect(generate).not.toHaveBeenCalled();
    expect((await recovery.feedEnrichmentHealth()).counts).toEqual({});
  }
);

it.skipIf(!testUrl)("one failed story does not abandon other queued stories", async () => {
  await freshJob("bad-neighbour");
  await claims.insertFeedOnce({
    ...item,
    sourceUrl: "https://concurrency-test.example/good-neighbour",
  });
  generate.mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValue(emptyAngles);
  await Promise.all([worker.drainFeedEnrichment(), worker.drainFeedEnrichment()]);
  expect(generate).toHaveBeenCalledTimes(2);
  expect((await recovery.feedEnrichmentHealth()).counts).toEqual({ pending: 1, completed: 1 });
});

it.skipIf(!testUrl)(
  "rolls back the story and identity when persisting its recovery job fails",
  async () => {
    await pool.query("DELETE FROM feed_enrichment_jobs");
    const row = {
      ...item,
      title: "Queue rollback test",
      sourceUrl: "https://concurrency-test.example/queue-failure",
    };
    await pool.query(`CREATE TRIGGER test_reject_recovery_job BEFORE INSERT ON feed_enrichment_jobs
    FOR EACH ROW BEGIN
      IF JSON_UNQUOTE(JSON_EXTRACT(NEW.input, '$.title')) = 'Queue rollback test' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Test queue storage failure';
      END IF;
    END`);
    try {
      await expect(claims.insertFeedOnce(row)).rejects.toThrow();
      const [stories] = await pool.query("SELECT id FROM daily_feed_items WHERE sourceUrl=?", [
        row.sourceUrl,
      ]);
      const [identities] = await pool.query(
        "SELECT identity FROM feed_ingest_claims WHERE identity=?",
        [claims.feedClaimIdentity(row)]
      );
      expect(stories).toHaveLength(0);
      expect(identities).toHaveLength(0);
    } finally {
      await pool.query("DROP TRIGGER test_reject_recovery_job");
    }
    expect(await claims.insertFeedOnce(row)).toBeGreaterThan(0);
  }
);

const briefDate = "2026-09-10";
const briefPayload = {
  to: "brief-test@example.com",
  from: "The Desk <hello@example.com>",
  subject: "Saved subject",
  html: "Saved body",
};
async function resetBrief() {
  await pool.query("DELETE FROM daily_brief_deliveries");
  await pool.query("DELETE FROM daily_brief_batches");
  await pool.query(`INSERT INTO subscribers (id,email,name,confirmedAt,unsubscribedAt,lastDailyBriefDate)
    VALUES (910001,'brief-test@example.com','Test',CURRENT_TIMESTAMP,NULL,NULL)
    ON DUPLICATE KEY UPDATE confirmedAt=CURRENT_TIMESTAMP,unsubscribedAt=NULL,lastDailyBriefDate=NULL,email='brief-test@example.com'`);
}
it.skipIf(!testUrl)(
  "claims one daily email across workers and reuses its immutable payload after a crash",
  async () => {
    await resetBrief();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => brief.claimDailyBrief(briefDate, 910001, briefPayload))
    );
    const winners = results.filter((x) => x !== null);
    expect(winners).toHaveLength(1);
    const stale = winners[0]!;
    await pool.query(
      "UPDATE daily_brief_deliveries SET availableAt=DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 1 SECOND)"
    );
    const recovered = (await brief.claimDailyBrief(briefDate, 910001, {
      ...briefPayload,
      html: "Changed template",
    }))!;
    expect(recovered.payload).toEqual(briefPayload);
    expect(recovered.attempts).toBe(2);
    expect(await brief.finishDailyBrief(stale, "accepted", "stale")).toBe(false);
    expect(await brief.finishDailyBrief(recovered, "accepted", "receipt")).toBe(true);
    expect(await brief.claimDailyBrief(briefDate, 910001, briefPayload)).toBeNull();
    expect(await brief.dailyBriefCandidates(briefDate)).toHaveLength(0);
    const [rows] = await pool.query("SELECT payload,receipt FROM daily_brief_deliveries");
    expect((rows as any[])[0]).toMatchObject({ payload: null, receipt: "receipt" });
  }
);
it.skipIf(!testUrl)(
  "checks current subscriber consent, address and prior delivery after claiming",
  async () => {
    await resetBrief();
    const claim = (await brief.claimDailyBrief(briefDate, 910001, briefPayload))!;
    expect(await brief.briefRecipientEligible(claim)).toBe(true);
    await pool.query("UPDATE subscribers SET unsubscribedAt=CURRENT_TIMESTAMP WHERE id=910001");
    expect(await brief.briefRecipientEligible(claim)).toBe(false);
    await pool.query(
      "UPDATE subscribers SET unsubscribedAt=NULL,email='changed@example.com' WHERE id=910001"
    );
    expect(await brief.briefRecipientEligible(claim)).toBe(false);
    await pool.query(
      "UPDATE subscribers SET email='brief-test@example.com',lastDailyBriefDate=? WHERE id=910001",
      [briefDate]
    );
    expect(await brief.briefRecipientEligible(claim)).toBe(false);
  }
);
it.skipIf(!testUrl)("bounds daily delivery retries and expires old unsent emails", async () => {
  await resetBrief();
  for (let i = 1; i <= 3; i++) {
    const claim = (await brief.claimDailyBrief(briefDate, 910001, briefPayload))!;
    expect(claim.attempts).toBe(i);
    await brief.finishDailyBrief(claim, "retry");
    expect(await brief.claimDailyBrief(briefDate, 910001, briefPayload)).toBeNull();
    await pool.query(
      "UPDATE daily_brief_deliveries SET availableAt=DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 1 SECOND)"
    );
  }
  expect((await brief.dailyBriefHealth(briefDate)).counts.failed).toBe(1);
  await resetBrief();
  await brief.claimDailyBrief(briefDate, 910001, briefPayload);
  await brief.expireDailyBriefs("2026-09-11");
  expect((await brief.dailyBriefHealth(briefDate)).counts.expired).toBe(1);
  expect(await brief.claimDailyBrief(briefDate, 910001, briefPayload)).toBeNull();
});
it.skipIf(!testUrl)(
  "requires completed story jobs and freezes the first brief selection",
  async () => {
    await resetBrief();
    const id = await freshJob("brief-readiness");
    await pool.query("UPDATE daily_feed_items SET feedDate=? WHERE id=?", [briefDate, id]);
    expect(await brief.readReadyBriefStories(briefDate)).toBeNull();
    expect(await brief.readReadyBriefStories("2026-01-01")).toBeNull();
    await worker.drainFeedEnrichment();
    expect((await brief.readReadyBriefStories(briefDate))?.[0]?.id).toBe(id);
    const stories = [{ id, title: "Original story", category: "PROPERTY", summary: "Evidence" }];
    expect(await brief.freezeBriefBatch(briefDate, stories)).toEqual(stories);
    expect(
      await brief.freezeBriefBatch(briefDate, [{ ...stories[0]!, title: "Later edit" }])
    ).toEqual(stories);
  }
);

it.skipIf(!testUrl)(
  "repairs overseas lanes without changing saved story identity or editorial text",
  async () => {
    const url = "https://concurrency-test.example/geography";
    const id = await claims.insertFeedOnce({
      ...item,
      sourceUrl: url,
      channel: "AU",
      title: "Home prices fall in most major US cities as housing market cools: See where",
      summary: "Single-family homes in San Diego, California.",
      whyItMatters: "An Australian comparison must not decide the section.",
    });
    const { repairFeedGeography } = await import("./feedGeography");
    expect(await repairFeedGeography()).toBeGreaterThanOrEqual(1);
    const [rows] = await pool.query("SELECT * FROM daily_feed_items WHERE id=?", [id]);
    expect(rows).toEqual([
      expect.objectContaining({
        id,
        sourceUrl: url,
        channel: "BUSINESS",
        category: "PROPERTY",
        whyItMatters: "An Australian comparison must not decide the section.",
      }),
    ]);
    expect(await repairFeedGeography()).toBe(0);
  }
);
