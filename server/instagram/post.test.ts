import { describe, expect, it } from "vitest";
import type { DailyFeedItem } from "../db/schema";
import {
  buildCoverageCaption,
  buildDailyCaption,
  sanitizeDashes,
  findAlreadyPublished,
  pickDailyTopStories,
} from "./post";
import { isRateLimitError, isTransientServerError } from "./api";

function fakeStory(o: Partial<DailyFeedItem> = {}): DailyFeedItem {
  return {
    id: 1,
    feedDate: "2026-06-03",
    title: "RBA holds the cash rate at 3.85%",
    source: "AFR",
    sourceUrl: null,
    summary: "The Reserve Bank left the cash rate unchanged at its June meeting.",
    category: "MACRO",
    channel: "AU",
    imageUrl: null,
    partnerTag: null,
    sayThis: "Rates on hold, but the cut talk is getting louder.",
    whyItMatters: "A steady rate keeps borrowing costs flat into spring.",
    counterpoint: null,
    corroborationCount: 1,
    corroboratingSources: null,
    threadParentId: null,
    threadParentTitle: null,
    rubensNote: null,
    priority: 80,
    promotedToEdition: false,
    createdAt: new Date(),
    ...o,
  } as DailyFeedItem;
}

// Distinct say-this lines per story on purpose: real stories never share one,
// and a fixture that repeats a line hides duplication bugs in caption assembly.
const trio: DailyFeedItem[] = [
  fakeStory({ id: 1, category: "MACRO" }),
  fakeStory({
    id: 2,
    category: "PROPERTY",
    title: "Sydney auction clearance hits 74%",
    sayThis: "Clearance is running hot again, so expect competition at the top end.",
  }),
  fakeStory({
    id: 3,
    category: "MARKETS",
    title: "ASX 200 rises on a tech-led rally",
    sayThis: "Equities are pricing in the cut the bond market still doubts.",
  }),
];

// Guardrail: every carousel (daily AND coverage) targets three story slides.
describe("pickDailyTopStories — slide-count guardrail", () => {
  it("fills to three slides when at least three stories exist", () => {
    expect(pickDailyTopStories(trio, 3)).toHaveLength(3);
  });

  it("prefers category diversity before filling by priority", () => {
    const skewed = [
      fakeStory({ id: 1, category: "MARKETS", priority: 90 }),
      fakeStory({ id: 2, category: "MARKETS", priority: 85 }),
      fakeStory({ id: 3, category: "TECH", priority: 50 }),
    ];
    // One MARKETS + the lone TECH, not both MARKETS, despite priority.
    expect(
      pickDailyTopStories(skewed, 2)
        .map((s) => s.category)
        .sort()
    ).toEqual(["MARKETS", "TECH"]);
  });

  it("never returns more than the limit", () => {
    expect(pickDailyTopStories([...trio, ...trio], 3)).toHaveLength(3);
  });
});

// Guardrail: the morning post stays the partner briefing.
describe("buildDailyCaption — partner briefing", () => {
  it("opens with the lead story's own hook, not a fixed line", () => {
    // Instagram shows ~125 characters before "…more". Spending them on the
    // same sentence every day gives a scroller no reason to stop, so the
    // opener has to be specific to the day.
    const caption = buildDailyCaption(trio);
    const hook = sanitizeDashes(trio[0]!.sayThis!);
    expect(caption.startsWith(hook)).toBe(true);
  });

  it("says the lead hook once, not twice", () => {
    // It was promoted out of the rundown, not copied above it.
    const caption = buildDailyCaption(trio);
    const hook = sanitizeDashes(trio[0]!.sayThis!);
    expect(caption.split(hook)).toHaveLength(2);
  });

  it("still carries the say-this hook for the other slides", () => {
    const caption = buildDailyCaption(trio);
    expect(caption).toContain(sanitizeDashes(trio[1]!.sayThis!));
  });

  it("lists every story headline", () => {
    const caption = buildDailyCaption(trio);
    for (const s of trio) expect(caption).toContain(sanitizeDashes(s.title));
  });

  it("falls back to the AU markets framing when the lead has no hook", () => {
    const noHook = [{ ...trio[0]!, sayThis: null }, ...trio.slice(1)];
    expect(buildDailyCaption(noHook)).toContain("Australian markets");
  });

  it("does not drop a lead headline when the fallback opener is used", () => {
    // The rundown skips slide 1's say-this only because it became the opener.
    // With the fallback in play there is nothing to skip, so nothing is lost.
    const noHook = [{ ...trio[0]!, sayThis: null }, ...trio.slice(1)];
    expect(buildDailyCaption(noHook)).toContain(sanitizeDashes(trio[0]!.title));
  });
});

// Guardrail: the coverage post stays the broader, angle-free briefing.
describe("buildCoverageCaption — wider lens", () => {
  it("uses the wider-lens framing, not the AU markets one", () => {
    const caption = buildCoverageCaption(trio);
    expect(caption).toContain("wider lens");
    expect(caption).not.toContain("Australian markets");
  });

  it("never includes a say-this line (coverage carries no partner angle)", () => {
    // Even though the stories have a say-this, the coverage caption must not
    // surface it — that line is partner-channel only.
    const caption = buildCoverageCaption(trio);
    expect(caption).not.toContain(trio[0]!.sayThis!);
  });

  it("lists every story headline", () => {
    const caption = buildCoverageCaption(trio);
    for (const s of trio) expect(caption).toContain(s.title);
  });
});

// Guardrail: a rate-limit / integrity ("Action is blocked") error is
// recognised so callers stop instead of hammering the block, while ordinary
// failures still fall through to the normal retry path.
describe("isRateLimitError — block detection", () => {
  it("flags the known rate-limit and integrity signatures", () => {
    const cases = [
      'Instagram API 403 at /media: {"error":{"message":"Application request limit reached"}}',
      'Instagram API 400 at /media_publish: {"error":{"message":"Action is blocked"}}',
      'Instagram API 400: {"error":{"code":4,"error_subcode":2207051}}',
      "Instagram API 429 at /media: too many requests",
    ];
    for (const m of cases) expect(isRateLimitError(new Error(m))).toBe(true);
  });

  it("does not flag ordinary transient failures", () => {
    const cases = [
      "Instagram API 500 at /media: internal error",
      "container 123 not ready after 20000ms (last status: IN_PROGRESS)",
      "fetch failed",
    ];
    for (const m of cases) expect(isRateLimitError(new Error(m))).toBe(false);
  });
});

// The morning carousel died on `Instagram API 500 at /{ig-id}/media: {"error":
// {"message":"An unexpected error has occurred. Please retry your request
// later."}}` — a Meta-side blip on an otherwise valid request. These have to be
// told apart from a rate-limit block (never retried) and from a real, permanent
// rejection (bad token, invalid image), because only the transient ones earn
// the long backoff that would have saved the post.
describe("isTransientServerError — Meta-side fault detection", () => {
  it("flags the Graph API 500 that killed the daily carousel", () => {
    const cases = [
      // The exact payload off the admin error log, is_transient flag and all.
      'Instagram API 500 at /17841425195143644/media: {"error":{"message":"An unexpected error has occurred. Please retry your request later.","type":"OAuthException","is_transient":true,"code":2,"fbtrace_id":"A3fdBAeUu4WUx"}}',
      // Same flag, arriving escaped (the message gets re-serialised on the way
      // out through the 502 body and into the scheduler's error string).
      'POST /api/ingest/instagram-daily -> 502 {"message":"Instagram API 500: {\\"error\\":{\\"is_transient\\":true}}"}',
      'Instagram API 500 at /17841425195143644/media: {"error":{"message":"An unexpected error has occurred. Please retry your request later.","type":"OAuthException","code":2}}',
      "Instagram API 502 at /media: bad gateway",
      "Instagram API 503 at /media_publish: service unavailable",
      'Instagram API 400 at /media: {"error":{"code":1,"message":"Please retry your request later."}}',
      "fetch failed",
      "connect ETIMEDOUT 157.240.8.1:443",
      "read ECONNRESET",
      // Observed on the publishing-quota read, minutes after the carousel
      // failure above: same class of fault, different wording ("unknown", not
      // "unexpected") and code 1 rather than 2.
      'Instagram API 500 at /17841425195143644: {"error":{"message":"An unknown error has occurred.","type":"OAuthException","code":1,"fbtrace_id":"A4PSbQCJDWJPF"}}',
      // The same wording without the 5xx, in case Meta ever pairs it with a 400.
      'Instagram API 400 at /media: {"error":{"message":"An unknown error has occurred."}}',
    ];
    for (const m of cases) expect(isTransientServerError(new Error(m))).toBe(true);
  });

  it("never flags a rate-limit / integrity block as transient", () => {
    // A block must keep short-circuiting the retry ladder, not earn a longer one.
    const cases = [
      'Instagram API 403 at /media: {"error":{"message":"Application request limit reached"}}',
      'Instagram API 400 at /media_publish: {"error":{"message":"Action is blocked","error_subcode":2207051}}',
    ];
    for (const m of cases) {
      expect(isRateLimitError(new Error(m))).toBe(true);
      expect(isTransientServerError(new Error(m))).toBe(false);
    }
  });

  it("does not flag permanent rejections that a retry can't fix", () => {
    const cases = [
      'Instagram API 400 at /media: {"error":{"message":"The image is not a valid format","code":9004}}',
      'Instagram API 190 at /media: {"error":{"message":"Error validating access token","code":190}}',
      "container 123 not ready after 20000ms (last status: IN_PROGRESS)",
      "INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID must be set",
    ];
    for (const m of cases) expect(isTransientServerError(new Error(m))).toBe(false);
  });
});

// The guard that makes a scheduler retry safe. The dangerous direction is a
// FALSE positive on the first attempt: mistaking the previous run's post for
// this one's would silently skip the day, which is the failure mode the retry
// exists to prevent. So attempt 1 must never even ask the API.
describe("findAlreadyPublished — retry duplicate guard", () => {
  it("never consults the account on a first attempt", async () => {
    await expect(findAlreadyPublished(1)).resolves.toBeNull();
    await expect(findAlreadyPublished(0)).resolves.toBeNull();
  });

  it("returns null (and lets the post proceed) when credentials are absent", async () => {
    // No IG env in the test environment, so a retry degrades to "just post"
    // rather than throwing — a missed post is worse than a rare duplicate.
    await expect(findAlreadyPublished(2)).resolves.toBeNull();
  });
});
