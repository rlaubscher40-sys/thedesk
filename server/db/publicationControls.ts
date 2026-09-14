import { sql } from "drizzle-orm";
import { getDb } from "./client";
import { isDemoMode } from "../demo/store";
import { PUBLICATION_CHANNELS, type PublicationChannel } from "../../shared/publicationControls";

export const PUBLICATION_CONTROL_DDL = [
  {
    name: "legal · publication controls",
    sql: `CREATE TABLE publication_controls (
    channel VARCHAR(16) PRIMARY KEY, paused BOOLEAN NOT NULL DEFAULT FALSE,
    reason VARCHAR(500) NOT NULL, actorId INT NOT NULL, revision INT NOT NULL DEFAULT 1,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  },
  {
    name: "legal · control audit",
    sql: `CREATE TABLE publication_control_events (
    id INT AUTO_INCREMENT PRIMARY KEY, channel VARCHAR(16) NOT NULL, paused BOOLEAN NOT NULL,
    reason VARCHAR(500) NOT NULL, actorId INT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  },
  {
    name: "legal · story review",
    sql: `CREATE TABLE legal_story_reviews (
    feedItemId INT PRIMARY KEY, originalChannel VARCHAR(16) NOT NULL, contentHash VARCHAR(64) NOT NULL,
    reasons JSON NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending',
    decisionNote VARCHAR(1000) NULL, actorId INT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewedAt TIMESTAMP NULL,
    INDEX idx_legal_review_status (status, createdAt))`,
  },
  {
    name: "legal · review events",
    sql: `CREATE TABLE legal_review_events (
    id INT AUTO_INCREMENT PRIMARY KEY, feedItemId INT NOT NULL, action VARCHAR(16) NOT NULL,
    note VARCHAR(1000) NOT NULL, actorId INT NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_review_event_story (feedItemId, createdAt))`,
  },
];
type Control = {
  channel: PublicationChannel;
  paused: boolean;
  reason: string;
  actorId: number;
  revision: number;
};
const demoControls = new Map<PublicationChannel, Control>();
const demoEvents: Array<Omit<Control, "revision">> = [];
function database() {
  const db = getDb();
  if (!db) throw new Error("Publication controls unavailable; publishing stopped");
  return db;
}
export class PublicationPausedError extends Error {
  constructor(channel: PublicationChannel) {
    super(`Publishing paused for ${channel}. Check the admin publishing controls.`);
    this.name = "PublicationPausedError";
  }
}
export async function publicationControls() {
  const rows = isDemoMode()
    ? [...demoControls.values()]
    : ((
        await database().execute(
          sql`SELECT channel, paused, reason, actorId, revision FROM publication_controls`
        )
      )[0] as unknown as Control[]);
  return PUBLICATION_CHANNELS.map((channel) => {
    const row = rows.find((r) => r.channel === channel);
    return {
      channel,
      paused: Boolean(row?.paused),
      reason: row?.reason ?? "",
      actorId: row?.actorId ?? null,
      revision: row?.revision ?? 0,
    };
  });
}
/** Read durable state at each external boundary, with no stale process cache.
 * A request already accepted by a provider cannot be recalled by this check. */
export async function assertPublicationAllowed(channel: Exclude<PublicationChannel, "all">) {
  const rows = await publicationControls();
  if (rows.some((r) => (r.channel === "all" || r.channel === channel) && r.paused))
    throw new PublicationPausedError(channel);
}
export async function setPublicationControl(input: {
  channel: PublicationChannel;
  paused: boolean;
  reason: string;
  actorId: number;
  expectedRevision: number;
}) {
  const { channel, paused, actorId, expectedRevision } = input;
  const reason = input.reason.trim();
  if (
    !PUBLICATION_CHANNELS.includes(channel) ||
    reason.length < 5 ||
    reason.length > 500 ||
    !Number.isSafeInteger(actorId) ||
    actorId < 1
  )
    throw new Error("A valid control, editor and reason are required");
  if (isDemoMode()) {
    if ((demoControls.get(channel)?.revision ?? 0) !== expectedRevision)
      throw new Error("Control changed; refresh before saving");
    demoControls.set(channel, { channel, paused, actorId, reason, revision: expectedRevision + 1 });
    demoEvents.push({ channel, paused, actorId, reason });
    if (demoEvents.length > 100) demoEvents.shift();
    return;
  }
  await database().transaction(async (tx) => {
    await tx.execute(sql`INSERT INTO publication_controls (channel, paused, reason, actorId, revision)
      VALUES (${channel}, FALSE, '', ${actorId}, 0) ON DUPLICATE KEY UPDATE channel=channel`);
    const [rows] = await tx.execute(
      sql`SELECT revision FROM publication_controls WHERE channel=${channel} FOR UPDATE`
    );
    if (Number((rows as unknown as Array<{ revision: number }>)[0]?.revision) !== expectedRevision)
      throw new Error("Control changed; refresh before saving");
    await tx.execute(sql`UPDATE publication_controls SET paused=${paused}, reason=${reason}, actorId=${actorId},
      revision=revision+1, updatedAt=CURRENT_TIMESTAMP WHERE channel=${channel}`);
    await tx.execute(sql`INSERT INTO publication_control_events (channel, paused, reason, actorId)
      VALUES (${channel}, ${paused}, ${reason}, ${actorId})`);
  });
}
export async function publicationControlEvents() {
  if (isDemoMode()) return [...demoEvents].reverse();
  const [rows] = await database().execute(sql`SELECT channel, paused, reason, actorId, createdAt
    FROM publication_control_events ORDER BY id DESC LIMIT 50`);
  return rows as unknown as Array<{
    channel: string;
    paused: boolean;
    reason: string;
    actorId: number;
  }>;
}
