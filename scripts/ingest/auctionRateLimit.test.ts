import { afterEach, expect, it, vi } from "vitest";
import { createAuctionCollector } from "./lib/auctionClearance";
import {
  PublisherAccessDeniedError,
  PublisherRateLimitError,
  publisherRetryAt,
  sourceHtml,
} from "./lib/publishedSources";

const initial = Date.parse("2026-09-08T12:00:00Z");
const hour = 3_600_000;
const page = (
  region: string,
) => `Mon 31 Aug 2026 - Sun 06 Sep 2026 ${region} clearance rate
Based on 10 auction results available 4 Sold at auction 1 Sold prior to auction 1 Sold after auction
2 Withdrawn 2 Passed in 12 auctions scheduled Non-auction sales 30 Private sales`;
afterEach(() => vi.unstubAllGlobals());

it.each([401, 403])(
  "stops the entire publisher on HTTP %i and keeps automatic retries paused",
  async (status) => {
    let now = initial;
    const fetch = vi.fn(
      async () => new Response("private publisher response", { status }),
    );
    vi.stubGlobal("fetch", fetch);
    const collect = createAuctionCollector({
      now: () => now,
      delay: async () => {},
    });
    const report = vi.fn();
    expect(await collect(report)).toEqual([]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(
      "auction_clearance",
      expect.stringContaining(`denied access (HTTP ${status})`),
    );
    expect(report.mock.calls[0][1]).not.toContain("private publisher response");
    now += 30 * 24 * hour;
    expect(await collect(report)).toEqual([]);
    expect(fetch).toHaveBeenCalledOnce();
  },
);

it("preserves a good state before access denial without producing a national rate", async () => {
  const fetchPage = vi.fn(async (url: string) => {
    if (url.endsWith("nsw")) return page("NSW");
    throw new PublisherAccessDeniedError(403);
  });
  const collect = createAuctionCollector({
    fetchPage,
    now: () => initial,
    delay: async () => {},
  });
  const rows = await collect();
  expect(rows.map((row) => row.metricKey)).toEqual(["nsw_auction_clearance"]);
  expect(fetchPage).toHaveBeenCalledTimes(2);
  expect(await collect()).toEqual([]);
  expect(fetchPage).toHaveBeenCalledTimes(2);
});

it("parses delta-seconds and HTTP-date Retry-After, with a safe missing/invalid default", () => {
  expect(publisherRetryAt("7200", initial)).toBe(initial + 2 * hour);
  expect(
    publisherRetryAt(new Date(initial + 3 * hour).toUTCString(), initial),
  ).toBe(initial + 3 * hour);
  for (const value of [
    null,
    "",
    "no",
    "-1",
    "0",
    "9".repeat(100),
    new Date(initial - hour).toUTCString(),
  ])
    expect(publisherRetryAt(value, initial)).toBe(initial + hour);
});

it("retains the actual publisher retry deadline on HTTP 429", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(null, { status: 429, headers: { "retry-after": "7200" } }),
    ),
  );
  const before = Date.now();
  const error = await sourceHtml(
    "https://www.realestate.com.au/auction-results/nsw",
  ).catch((error) => error);
  expect(error).toBeInstanceOf(PublisherRateLimitError);
  expect(error.retryAt).toBeGreaterThanOrEqual(before + 2 * hour);
});

it("stops after the first 429 and makes no requests on repeated Admin/scheduler attempts", async () => {
  let now = initial;
  const fetchPage = vi.fn(async () => {
    throw new PublisherRateLimitError(now + hour);
  });
  const collect = createAuctionCollector({
    fetchPage,
    now: () => now,
    delay: async () => {},
  });
  const error = vi.fn();
  expect(await collect(error)).toEqual([]);
  expect(fetchPage).toHaveBeenCalledOnce();
  expect(error).toHaveBeenCalledWith(
    "auction_clearance",
    expect.stringContaining("Collection stopped"),
  );
  now += 59 * 60_000;
  await collect(error);
  await collect(error);
  expect(fetchPage).toHaveBeenCalledOnce();
  now = initial + hour;
  await collect();
  expect(fetchPage).toHaveBeenCalledTimes(2);
  now += hour;
  await collect();
  expect(fetchPage).toHaveBeenCalledTimes(2); // second 429 doubles the pause
});

it("never shortens a longer Retry-After", async () => {
  let now = initial;
  const fetchPage = vi.fn(async () => {
    throw new PublisherRateLimitError(initial + 48 * hour);
  });
  const collect = createAuctionCollector({
    fetchPage,
    now: () => now,
    delay: async () => {},
  });
  await collect();
  now += 25 * hour;
  await collect();
  expect(fetchPage).toHaveBeenCalledOnce();
});

it("shares simultaneous callers, paces states, and reuses complete results without changing their dates", async () => {
  let now = initial;
  const fetchPage = vi.fn(async (url: string) =>
    page(url.split("/").pop()!.toUpperCase()),
  );
  const delay = vi.fn(async () => {});
  const collect = createAuctionCollector({ fetchPage, now: () => now, delay });
  const [first, second] = await Promise.all([collect(), collect()]);
  expect(fetchPage).toHaveBeenCalledTimes(8);
  expect(delay).toHaveBeenCalledTimes(7);
  expect(first).toHaveLength(9);
  expect(second).toEqual(first);
  first[0]!.value = "999";
  now += 5 * hour;
  const cached = await collect();
  expect(cached[0]!.value).toBe("60.0");
  expect(cached.every((row) => row.asOf === "2026-09-06")).toBe(true);
  expect(fetchPage).toHaveBeenCalledTimes(8);
  now += hour;
  await collect();
  expect(fetchPage).toHaveBeenCalledTimes(16);
});

it("keeps already collected states after a later 429 but never constructs a partial national rate", async () => {
  const fetchPage = vi.fn(async (url: string) => {
    if (url.endsWith("vic")) throw new PublisherRateLimitError(initial + hour);
    return page("NSW");
  });
  const collect = createAuctionCollector({
    fetchPage,
    now: () => initial,
    delay: async () => {},
  });
  expect((await collect()).map((row) => row.metricKey)).toEqual([
    "nsw_auction_clearance",
  ]);
  expect(fetchPage).toHaveBeenCalledTimes(2);
  expect(await collect()).toEqual([]); // no artificial re-saving while blocked
  expect(fetchPage).toHaveBeenCalledTimes(2);
});

it("resumes after cooldown and only then publishes a complete Australian rate", async () => {
  let now = initial;
  let blocked = true;
  const fetchPage = vi.fn(async (url: string) => {
    if (blocked) throw new PublisherRateLimitError(initial + hour);
    return page(url.split("/").pop()!.toUpperCase());
  });
  const collect = createAuctionCollector({
    fetchPage,
    now: () => now,
    delay: async () => {},
  });
  await collect();
  blocked = false;
  now += hour;
  expect(
    (await collect()).find((row) => row.metricKey === "auction_clearance")
      ?.value,
  ).toBe("60.0");
  expect(fetchPage).toHaveBeenCalledTimes(9);
});
