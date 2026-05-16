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
  DailyMetric,
  Edition,
  FeaturedLinkedInPost,
  ReadingQueueItem,
  User,
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
  subscribers: [] as Subscriber[],
  linkedInPosts: linkedInSeed(),
  metrics: metricsSeed(),
};

function metricsSeed(): DailyMetric[] {
  const now = new Date();
  const m = (
    id: number,
    metricKey: string,
    label: string,
    value: string,
    unit: string | null,
    prev: string | null,
    source: string,
    context: string | null,
    groupKey: string,
    displayOrder: number
  ): DailyMetric => ({
    id,
    metricKey,
    label,
    value,
    unit,
    previousValue: prev,
    source,
    context,
    groupKey,
    asOf: now,
    displayOrder,
    updatedAt: now,
  });
  return [
    m(900, "cash_rate", "RBA cash rate", "4.35", "%", "4.35", "RBA", "ANZ expects extended hold", "MACRO", 10),
    m(901, "cpi_trimmed", "Trimmed mean CPI", "3.3", "%", "3.4", "ABS", "Peak forecast 3.8%", "MACRO", 20),
    m(902, "consumer_confidence", "Consumer confidence", "64.1", null, "67.2", "ANZ-Roy Morgan", "4th lowest reading ever", "MACRO", 30),
    m(903, "dwelling_value", "Nat'l dwelling value", "$933,137", null, "$930,401", "CoreLogic", "Slowest growth since Jan 2025", "PROPERTY", 40),
    m(904, "auction_clearance", "Auction clearance", "52.5", "%", "57.3", "Domain", "Below 60% for 7 straight weeks", "PROPERTY", 50),
    m(905, "building_approvals", "Building approvals", "17,028", null, "17,540", "ABS", "Below household formation", "PROPERTY", 60),
    m(906, "unemployment", "Unemployment rate", "4.3", "%", "4.2", "ABS", "RBA forecasts 4.7% mid-2026", "LABOUR", 70),
    m(907, "wage_growth", "Wage growth (WPI)", "3.3", "%", "3.4", "ABS", "Real wages still pressured", "LABOUR", 80),
    m(908, "asx200", "ASX 200", "8,210", null, "8,150", "Yahoo Finance", "—", "MARKETS", 90),
    m(909, "audusd", "AUD / USD", "0.6543", null, "0.6580", "Yahoo Finance", "—", "MARKETS", 100),
    m(910, "brent", "Brent crude", "$107", "/bbl", "$104", "Yahoo Finance", "Hormuz still closed", "MARKETS", 110),
    m(911, "net_migration", "Net migration", "548K", null, "535K", "ABS", "Demand-side of supply gap", "DEMOGRAPHICS", 120),
  ];
}

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

// Seed a starting reading-queue item so the saved-items list has something
// to render in demo mode.
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

// ─── ID helpers ─────────────────────────────────────────────────────────────

export { allocId };

// ─── Re-export types for helper convenience ─────────────────────────────────

export type { Edition, DailyFeedItem, ReadingQueueItem };
