import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { PUBLICATION_CONTROL_DDL } from "./publicationControls";
import { CONSENT_EVENT_DDL } from "./consentSchema";
import { DAILY_BRIEF_DDL } from "./dailyBriefSchema";
import { FEED_ENRICHMENT_DDL } from "./feedEnrichmentSchema";

const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
const databaseName = "legal_ops_test_" + randomUUID().replaceAll("-", "");
let pool: Pool | undefined;
let setup: Pool | undefined;
let subs: typeof import("./subscribers");
let controls: typeof import("./publicationControls");
let review: typeof import("./legalReview");
let privacy: typeof import("./privacyOperations");
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Legal integration tests require the isolated local CI database");
  setup = createPool(testUrl);
  await setup.query(`CREATE DATABASE \`${databaseName}\``);
  url.pathname = "/" + databaseName;
  pool = createPool(url.toString());
  for (const ddl of [
    ...PUBLICATION_CONTROL_DDL,
    CONSENT_EVENT_DDL,
    ...DAILY_BRIEF_DDL,
    ...FEED_ENRICHMENT_DDL,
  ])
    await pool.query(ddl.sql);
  await pool.query(`CREATE TABLE subscribers (
    id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(320) NOT NULL UNIQUE, name VARCHAR(128),
    confirmToken VARCHAR(64), confirmTokenSentAt TIMESTAMP NULL, consentNoticeVersion VARCHAR(32),
    consentRequestedAt TIMESTAMP NULL, confirmedAt TIMESTAMP NULL, unsubscribedAt TIMESTAMP NULL,
    source VARCHAR(64), arrivalSource VARCHAR(64), arrivalCampaign VARCHAR(64), isPremium BOOLEAN NOT NULL DEFAULT FALSE,
    lastDailyBriefDate VARCHAR(10), lastWeeklyRecapDate VARCHAR(10), createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(
    "CREATE TABLE daily_feed_items (id INT PRIMARY KEY, title VARCHAR(512), summary TEXT, sourceUrl TEXT, channel VARCHAR(16))"
  );
  vi.resetModules();
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool!) }));
  vi.doMock("../demo/store", () => ({ isDemoMode: () => false }));
  subs = await import("./subscribers");
  controls = await import("./publicationControls");
  review = await import("./legalReview");
  privacy = await import("./privacyOperations");
});
afterAll(async () => {
  await pool?.end();
  if (setup) {
    await setup.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await setup.end();
  }
});

it.skipIf(!testUrl)(
  "retains consent history, handles concurrent requests and never resurrects an invalidated token",
  async () => {
    const email = "consent@example.test";
    await Promise.all(
      ["token-a", "token-b"].map((confirmToken) =>
        subs.createSubscriber({ email, confirmToken, consentNoticeVersion: "2026-09-14" })
      )
    );
    const current = (await subs.findSubscriberByEmail(email))!;
    expect(["token-a", "token-b"]).toContain(current.confirmToken);
    const obsolete = current.confirmToken === "token-a" ? "token-b" : "token-a";
    expect(await subs.confirmSubscriber(obsolete)).toEqual({ status: "not-found" });
    await subs.confirmSubscriber(current.confirmToken!);
    await subs.unsubscribeByEmail(email);
    expect((await subs.findSubscriberByEmail(email))?.unsubscribedAt).toBeInstanceOf(Date);
    expect(await subs.confirmSubscriber(current.confirmToken!)).toEqual({ status: "not-found" });
    const [events] = await pool!.query(
      "SELECT event, noticeVersion FROM subscriber_consent_events ORDER BY id"
    );
    expect((events as Array<{ event: string }>).map((e) => e.event)).toEqual([
      "requested",
      "requested",
      "confirmed",
      "unsubscribed",
    ]);
  }
);
it.skipIf(!testUrl)(
  "rolls back a confirmation when its consent event cannot be stored",
  async () => {
    await subs.createSubscriber({ email: "rollback@example.test", confirmToken: "rollback-token" });
    await pool!.query(
      "CREATE TRIGGER fail_consent BEFORE INSERT ON subscriber_consent_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Synthetic audit write failure'"
    );
    try {
      await expect(subs.confirmSubscriber("rollback-token")).rejects.toThrow();
      expect(await subs.findSubscriberByEmail("rollback@example.test")).toMatchObject({
        confirmedAt: null,
        confirmToken: "rollback-token",
      });
    } finally {
      await pool!.query("DROP TRIGGER fail_consent");
    }
  }
);
it.skipIf(!testUrl)(
  "serializes competing control updates and keeps held stories unpublished until a valid review",
  async () => {
    const input = {
      channel: "all" as const,
      paused: true,
      reason: "Synthetic incident response",
      actorId: 1,
      expectedRevision: 0,
    };
    const results = await Promise.allSettled([
      controls.setPublicationControl(input),
      controls.setPublicationControl(input),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await controls.publicationControlEvents()).toHaveLength(1);
    await pool!.query(
      "INSERT INTO daily_feed_items VALUES (1, 'Synthetic story', 'Original summary', 'https://example.test/story', 'AU')"
    );
    await review.holdPublishedStory({
      feedItemId: 1,
      actorId: 1,
      note: "Synthetic copyright complaint review",
    });
    expect(await review.pendingLegalReviews()).toHaveLength(1);
    await expect(
      review.decideLegalReview({
        feedItemId: 1,
        decision: "approve",
        actorId: 1,
        note: "Reviewed the original source and context",
      })
    ).rejects.toThrow("Publishing paused");
    await controls.setPublicationControl({ ...input, paused: false, expectedRevision: 1 });
    await pool!.query("UPDATE daily_feed_items SET summary='Changed summary' WHERE id=1");
    await expect(
      review.decideLegalReview({
        feedItemId: 1,
        decision: "approve",
        actorId: 1,
        note: "Reviewed the original source and context",
      })
    ).rejects.toThrow("text changed");
    await pool!.query("UPDATE daily_feed_items SET summary='Original summary' WHERE id=1");
    await review.decideLegalReview({
      feedItemId: 1,
      decision: "approve",
      actorId: 1,
      note: "Reviewed the original source and context",
    });
    const [rows] = await pool!.query("SELECT channel FROM daily_feed_items WHERE id=1");
    expect(rows).toEqual([{ channel: "AU" }]);
  }
);
it.skipIf(!testUrl)(
  "clears only expired/finished private payloads and preserves active work and opt-outs",
  async () => {
    await pool!.query(
      "INSERT INTO subscribers (email, confirmToken, confirmTokenSentAt, unsubscribedAt) VALUES ('expired@example.test', 'expired', DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()), ('current@example.test', 'current', NOW(), NULL)"
    );
    await pool!.query(
      "INSERT INTO daily_brief_deliveries (feedDate,subscriberId,status,payload) VALUES ('2026-09-14',1,'accepted',JSON_OBJECT('to','private@example.test')),('2026-09-14',2,'pending',JSON_OBJECT('to','pending@example.test'))"
    );
    await privacy.cleanExpiredPrivatePayloads();
    expect(await subs.findSubscriberByEmail("expired@example.test")).toMatchObject({
      confirmToken: null,
      unsubscribedAt: expect.any(Date),
    });
    expect(await subs.findSubscriberByEmail("current@example.test")).toMatchObject({
      confirmToken: "current",
    });
    const [rows] = await pool!.query(
      "SELECT status, payload IS NULL AS cleared FROM daily_brief_deliveries ORDER BY subscriberId"
    );
    expect(rows).toEqual([
      { status: "accepted", cleared: 1 },
      { status: "pending", cleared: 0 },
    ]);
  }
);
