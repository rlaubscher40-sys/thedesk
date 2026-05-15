/**
 * Demo mode in-memory store.
 *
 * Activates automatically when DATABASE_URL is unset. Lets the entire UI be
 * driven through tRPC without any real services — useful for visual review,
 * local feedback and screenshot work.
 *
 * The seed data below is plausible-shaped, not real intelligence. Edit freely.
 */
import type {
  DailyFeedItem,
  Edition,
  FeaturedLinkedInPost,
  ReadingQueueItem,
  WeeklyNote,
  User,
  ConversationEntry,
  Subscriber,
} from "../db/schema";
import { env } from "../core/env";
import { editionsSeed } from "./seedEditions";
import { feedSeed } from "./seedFeed";

/** Cheap dev detector — when no DB is configured, switch the whole app to seed data. */
export function isDemoMode(): boolean {
  return !env.databaseUrl;
}

/** Pretend admin user injected into every request. */
export const demoUser: User = {
  id: 1,
  openId: "demo-owner",
  name: "Ruben (demo)",
  email: "demo@thedesk.local",
  loginMethod: "demo",
  role: "admin",
  isPremium: true,
  createdAt: new Date("2026-01-15T07:00:00Z"),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

// ─── Mutable state ──────────────────────────────────────────────────────────

let nextId = 100;
const allocId = () => ++nextId;

export const demo = {
  editions: editionsSeed(),
  feed: feedSeed(),
  queue: [] as ReadingQueueItem[],
  notes: [] as WeeklyNote[],
  conversations: [] as ConversationEntry[],
  subscribers: [] as Subscriber[],
  linkedInPosts: linkedInSeed(),
};

function linkedInSeed(): FeaturedLinkedInPost[] {
  const now = Date.now();
  return [
    {
      id: 800,
      postUrl: "https://www.linkedin.com/posts/ruben-laubscher_apra-serviceability-buffer-activity-7195000000000000000-DESK/",
      excerpt:
        "The APRA serviceability buffer consultation is a six-month story, not a six-week one. Brokers selling 'loosening' to clients this quarter are selling timing they cannot deliver.",
      authorName: "Ruben Laubscher",
      displayOrder: 10,
      isLive: true,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 2),
    },
    {
      id: 801,
      postUrl: "https://www.linkedin.com/posts/ruben-laubscher_sydney-clearance-rates-activity-7195000000000000001-DESK/",
      excerpt:
        "Sydney clearance over 65% for six straight weeks. The volume is finally catching up to the price story. Watch June listings — that's the test.",
      authorName: "Ruben Laubscher",
      displayOrder: 20,
      isLive: true,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 5),
    },
    {
      id: 802,
      postUrl: "https://www.linkedin.com/posts/ruben-laubscher_fixed-rate-rolloff-activity-7195000000000000002-DESK/",
      excerpt:
        "Fixed-rate roll-offs land in mid-June. The decision was the easy part — broker channel share through June is where the real action is.",
      authorName: "Ruben Laubscher",
      displayOrder: 30,
      isLive: true,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 9),
    },
  ];
}

// Generate hero gradients for every seeded edition so the demo doesn't open
// on the bare placeholder. The image stub is deterministic per prompt, so we
// inject a per-boot salt — the cover stays stable for the life of the
// server but rerolls when you restart, matching the brief's "not static
// every time" feel.
import { demoImage } from "./imageStub";
const bootSalt = Math.random().toString(36).slice(2, 8);
for (const edition of demo.editions) {
  if (!edition.heroImageUrl) {
    void demoImage({
      prompt: `Edition ${edition.editionNumber} ${edition.weekRange} ${edition.topics[0]?.title ?? ""} ${edition.topics[0]?.category ?? ""} ${bootSalt}`,
    })
      .then(({ url }) => {
        edition.heroImageUrl = url;
      })
      .catch(() => {
        /* Non-fatal — falls back to the SSR placeholder. */
      });
  }
}

// Seed a starting queue / note / conversation so each page has something to render.
demo.queue.push({
  id: allocId(),
  userId: demoUser.id,
  feedItemId: demo.feed[0]?.id ?? null,
  customUrl: null,
  customTitle: null,
  articleText: null,
  isRead: false,
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
});

demo.notes.push({
  id: allocId(),
  userId: demoUser.id,
  weekId: currentIsoWeekId(),
  content:
    "Sentiment shifted faster than the data this week. The cash rate decision moved less than the broker chatter around it. Keep the conversation on serviceability.",
  updatedAt: new Date(),
  createdAt: new Date(),
});

demo.conversations.push({
  id: allocId(),
  userId: demoUser.id,
  editionId: demo.editions[0]?.id ?? null,
  lineText: "If you only watch one number this week, watch fixed-rate roll-off volumes.",
  usedWithCategory: "Brokers",
  usedAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
});

// ─── ID helpers ─────────────────────────────────────────────────────────────

export { allocId };

function currentIsoWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ─── Re-export types for helper convenience ─────────────────────────────────

export type { Edition, DailyFeedItem, ReadingQueueItem, WeeklyNote, ConversationEntry };
