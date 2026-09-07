/**
 * Demo mode in-memory store.
 *
 * Activates automatically when DATABASE_URL is unset. Lets the entire UI be
 * driven through tRPC without any real services, useful for visual review,
 * local feedback and screenshot work.
 *
 * The seed data below is plausible-shaped, not real intelligence. Edit freely.
 */
import type {
  DailyFeedItem,
  DailyMetric,
  Edition,
  FeaturedLinkedInPost,
  FeedbackSubmission,
  InstagramPost,
  PageView,
  ReadingQueueItem,
  ServerError,
  Subscriber,
  UptimePing,
  User,
} from "../db/schema";
import { env } from "../core/env";
import { editionsSeed } from "./seedEditions";
import { feedSeed } from "./seedFeed";

/**
 * Cheap dev detector, when no DB is configured, switch the whole app to
 * seed data. Hard-disabled in production: demo mode injects an
 * unauthenticated admin user into every request, so it must never engage
 * on a live deploy that happens to boot without DATABASE_URL. (env.ts
 * already refuses to start in that case; this is the second line of
 * defence.)
 */
export function isDemoMode(): boolean {
  if (env.isProduction) return false;
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
  subscribers: subscribersSeed(),
  linkedInPosts: linkedInSeed(),
  metrics: metricsSeed(),
  instagramPosts: instagramPostsSeed(),
  feedback: [] as FeedbackSubmission[],
  // Health: in-memory ring buffers. Bounded so a long-running demo
  // doesn't grow unbounded; old entries fall off the front.
  serverErrors: [] as ServerError[],
  uptimePings: [] as UptimePing[],
  pageViews: [] as PageView[],
};

/** Trim a ring-buffer array to a max length, dropping oldest entries. */
export function trimRing<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr;
  return arr.slice(arr.length - maxLen);
}

/**
 * Seed Instagram posts so the admin panel's format comparison is reviewable in
 * demo mode. Without these the new table renders empty, which is honest but
 * makes the thing impossible to look at, and demo mode exists precisely so the
 * UI can be reviewed without live data.
 *
 * Shaped to exercise the states the panel has to handle rather than to flatter
 * it: The Number reads well but is still one post short of conclusive, the two
 * carousels are conclusive and close, The Wider Lens has almost nothing since
 * it came off the schedule, and one recent post is still awaiting metrics.
 */
function instagramPostsSeed(): InstagramPost[] {
  const day = 86_400_000;
  const now = Date.now();
  let n = 0;
  const post = (
    postType: string,
    daysAgo: number,
    reach: number | null,
    saved: number | null,
    shares: number | null,
    headline: string
  ): InstagramPost =>
    ({
      id: ++n,
      mediaId: `demo-${postType}-${n}`,
      postType,
      feedDate: null,
      editionNumber: postType === "weekly" ? 40 + n : null,
      headline,
      coverVariant: n % 2 === 0 ? "light" : "navy",
      likes: reach == null ? null : Math.round(reach * 0.031),
      comments: reach == null ? null : Math.round(reach * 0.004),
      reach,
      saved,
      shares,
      totalInteractions: reach == null ? null : Math.round(reach * 0.05),
      metricsFetchedAt: reach == null ? null : new Date(now - daysAgo * day + day),
      createdAt: new Date(now - daysAgo * day),
    }) as InstagramPost;

  return [
    // Awaiting metrics — published, insights job has not run for it yet.
    post("daily", 0, null, null, null, "Investor lending hits its highest share since 2015"),
    post("stat", 1, 4120, 96, 31, "Auction clearance: 58.4%"),
    post("daily", 1, 5230, 61, 14, "RBA holds the cash rate at 3.85%"),
    post("stat", 3, 3880, 84, 26, "Nat'l dwelling value: $815,439"),
    post("daily", 3, 4980, 55, 12, "Fixed-rate share climbs for a fourth month"),
    post("stat", 5, 4460, 103, 35, "Mortgage arrears: 1.62%"),
    post("daily", 5, 5610, 70, 18, "Building approvals fall to a three-year low"),
    post("weekly", 6, 6240, 88, 22, "This Week in Australian Property, Ed. 44"),
    post("daily", 7, 5120, 58, 11, "Sydney clearance slips under 60% for a sixth week"),
    post("weekly", 13, 5980, 79, 19, "This Week in Australian Property, Ed. 43"),
    post("daily", 9, 4740, 64, 15, "Net migration eases from its 2024 peak"),
    post("weekly", 20, 6110, 91, 24, "This Week in Australian Property, Ed. 42"),
    post("weekly", 27, 5740, 74, 17, "This Week in Australian Property, Ed. 41"),
    // Off the schedule, so only the historic ones remain.
    post("coverage", 11, 3210, 19, 4, "The Wider Lens"),
    post("coverage", 12, 2980, 16, 3, "The Wider Lens"),
  ];
}

/**
 * Seed subscribers so the admin's arrival-source panel is reviewable.
 *
 * Shaped to show the states that matter rather than a flattering split: a
 * handful of rows predating attribution (which must be excluded, not guessed
 * at), a mix of confirmed and pending, and a spread across channels wide
 * enough that the reading has something to say.
 */
function subscribersSeed(): Subscriber[] {
  const day = 86_400_000;
  const now = Date.now();
  let n = 0;
  const sub = (
    arrivalSource: string | null,
    daysAgo: number,
    confirmed: boolean,
    unsubscribed = false
  ): Subscriber =>
    ({
      id: 500 + ++n,
      email: `reader${n}@example.com`,
      name: null,
      confirmToken: confirmed ? null : `tok${n}`,
      confirmTokenSentAt: new Date(now - daysAgo * day),
      confirmedAt: confirmed ? new Date(now - daysAgo * day + 3_600_000) : null,
      unsubscribedAt: unsubscribed ? new Date(now - daysAgo * day + day) : null,
      source: "first-visit-modal",
      arrivalSource,
      arrivalCampaign: arrivalSource === "instagram" ? "bio-link" : null,
      isPremium: false,
      lastDailyBriefDate: null,
      lastWeeklyRecapDate: null,
      createdAt: new Date(now - daysAgo * day),
    }) as Subscriber;

  return [
    // Predate attribution — excluded from the channel table by design.
    sub(null, 120, true),
    sub(null, 110, true),
    sub(null, 95, true),
    sub(null, 88, false),

    sub("instagram", 40, true),
    sub("instagram", 34, true),
    sub("instagram", 27, true),
    sub("instagram", 19, false),
    sub("instagram", 11, true),
    sub("google", 38, true),
    sub("google", 22, true),
    sub("google", 9, false),
    sub("linkedin", 31, true),
    sub("linkedin", 14, true, true),
    sub("direct", 25, true),
    sub("substack", 17, true),
  ];
}

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
    sourceUrl: null,
    asOf: now,
    displayOrder,
    updatedAt: now,
  });
  return [
    m(
      900,
      "cash_rate",
      "RBA cash rate",
      "4.35",
      "%",
      "4.35",
      "RBA",
      "ANZ expects extended hold",
      "MACRO",
      10
    ),
    m(
      901,
      "cpi_trimmed",
      "Trimmed mean CPI",
      "3.3",
      "%",
      "3.4",
      "ABS",
      "Peak forecast 3.8%",
      "MACRO",
      20
    ),
    m(
      902,
      "consumer_confidence",
      "Consumer confidence",
      "64.1",
      null,
      "67.2",
      "ANZ-Roy Morgan",
      "4th lowest reading ever",
      "MACRO",
      30
    ),
    m(
      903,
      "dwelling_value",
      "Nat'l dwelling value",
      "$933,137",
      null,
      "$930,401",
      "CoreLogic",
      "Slowest growth since Jan 2025",
      "PROPERTY",
      40
    ),
    m(
      904,
      "auction_clearance",
      "Auction clearance",
      "52.5",
      "%",
      "57.3",
      "Domain",
      "Below 60% for 7 straight weeks",
      "PROPERTY",
      50
    ),
    m(
      905,
      "building_approvals",
      "Building approvals",
      "17,028",
      null,
      "17,540",
      "ABS",
      "Below household formation",
      "PROPERTY",
      60
    ),
    m(
      906,
      "unemployment",
      "Unemployment rate",
      "4.3",
      "%",
      "4.2",
      "ABS",
      "RBA forecasts 4.7% mid-2026",
      "LABOUR",
      70
    ),
    m(
      907,
      "wage_growth",
      "Wage growth (WPI)",
      "3.3",
      "%",
      "3.4",
      "ABS",
      "Real wages still pressured",
      "LABOUR",
      80
    ),
    m(908, "asx200", "ASX 200", "8,210", null, "8,150", "Yahoo Finance", "—", "MARKETS", 90),
    m(909, "audusd", "AUD / USD", "0.6543", null, "0.6580", "Yahoo Finance", "—", "MARKETS", 100),
    m(
      910,
      "brent",
      "Brent crude",
      "$107",
      "/bbl",
      "$104",
      "Yahoo Finance",
      "Hormuz still closed",
      "MARKETS",
      110
    ),
    m(
      911,
      "net_migration",
      "Net migration",
      "548K",
      null,
      "535K",
      "ABS",
      "Demand-side of supply gap",
      "DEMOGRAPHICS",
      120
    ),
  ];
}

function linkedInSeed(): FeaturedLinkedInPost[] {
  const now = Date.now();
  return [
    {
      id: 800,
      postUrl:
        "https://www.linkedin.com/posts/ruben-laubscher_apra-serviceability-buffer-activity-7195000000000000000-DESK/",
      excerpt:
        "The APRA serviceability buffer consultation is a six-month story, not a six-week one. Brokers selling 'loosening' to clients this quarter are selling timing they cannot deliver.",
      authorName: "Ruben Laubscher",
      displayOrder: 10,
      isLive: true,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 2),
    },
    {
      id: 801,
      postUrl:
        "https://www.linkedin.com/posts/ruben-laubscher_sydney-clearance-rates-activity-7195000000000000001-DESK/",
      excerpt:
        "Sydney clearance over 65% for six straight weeks. The volume is finally catching up to the price story. Watch June listings, that's the test.",
      authorName: "Ruben Laubscher",
      displayOrder: 20,
      isLive: true,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 5),
    },
    {
      id: 802,
      postUrl:
        "https://www.linkedin.com/posts/ruben-laubscher_fixed-rate-rolloff-activity-7195000000000000002-DESK/",
      excerpt:
        "Fixed-rate roll-offs land in mid-June. The decision was the easy part, broker channel share through June is where the real action is.",
      authorName: "Ruben Laubscher",
      displayOrder: 30,
      isLive: true,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 9),
    },
  ];
}

// Generate hero gradients for every seeded edition so the demo doesn't open
// on the bare placeholder. The image stub is deterministic per prompt, so we
// inject a per-boot salt, the cover stays stable for the life of the
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
        /* Non-fatal, falls back to the SSR placeholder. */
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
  nudgeSentAt: null,
  nudgeResponse: null,
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
});

// ─── ID helpers ─────────────────────────────────────────────────────────────

export { allocId };

// ─── Re-export types for helper convenience ─────────────────────────────────

export type { Edition, DailyFeedItem, ReadingQueueItem };
