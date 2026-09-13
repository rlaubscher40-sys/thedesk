// @vitest-environment happy-dom
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { afterEach, expect, it, vi } from "vitest";
import {
  MARKET_BOOTSTRAP_ID,
  marketBootstrapTag,
  parseMarketBootstrap,
} from "@shared/marketBootstrap";
import { FEATURED_COMPARISON_PATH } from "@shared/featuredComparison";
import { PUBLIC_MARKETS, type MarketDirectory } from "@shared/marketDirectory";
import { seedMarketDocument } from "./marketBootstrap";
import { trpc } from "./trpc";
const directory: MarketDirectory = {
  asOf: "2026-09-14",
  since: "2026-06-14",
  sampleLimit: 1000,
  sampleCapped: false,
  demo: false,
  markets: [
    {
      market: PUBLIC_MARKETS[0],
      asOf: "2026-09-14",
      since: "2026-06-14",
      referenceCount: 0,
      publisherCount: 0,
      latestMention: null,
      coverage: "none",
      indexable: false,
      references: [],
    },
  ],
};
afterEach(() => {
  document.body.innerHTML = "";
});
it("reuses public file and discovery queries without an initial network request", async () => {
  document.body.innerHTML = marketBootstrapTag("/markets/sydney", directory);
  const client = new QueryClient();
  expect(seedMarketDocument(client, document, "/markets/sydney")).toBe(true);
  expect(document.getElementById(MARKET_BOOTSTRAP_ID)).toBeNull();
  const fetcher = vi.fn();
  for (const queryKey of [
    getQueryKey(trpc.markets.publicFile, { slug: "sydney" }, "query"),
    getQueryKey(trpc.markets.discovery, undefined, "query"),
  ]) {
    const observer = new QueryObserver(client, { queryKey, queryFn: fetcher, staleTime: 60_000 });
    const stop = observer.subscribe(() => {});
    expect(observer.getCurrentResult().status).toBe("success");
    expect(observer.getCurrentResult().isFetching).toBe(false);
    stop();
  }
  expect(fetcher).not.toHaveBeenCalled();
  client.clear();
});
it("seeds the comparison and fails open for stale, corrupt and wrong-route payloads", () => {
  const client = new QueryClient();
  document.body.innerHTML = marketBootstrapTag(FEATURED_COMPARISON_PATH, directory);
  expect(seedMarketDocument(client, document, FEATURED_COMPARISON_PATH)).toBe(true);
  expect(client.getQueryData(getQueryKey(trpc.markets.discovery, undefined, "query"))).toEqual(
    directory
  );
  document.body.innerHTML = marketBootstrapTag("/markets/sydney", directory, Date.now() - 61_000);
  expect(seedMarketDocument(client, document, "/markets/sydney")).toBe(false);
  document.body.innerHTML = marketBootstrapTag("/markets/sydney", directory);
  expect(seedMarketDocument(client, document, "/markets/perth")).toBe(false);
  expect(parseMarketBootstrap('{"version":1}', "/markets/sydney")).toBeNull();
  expect(parseMarketBootstrap("broken", "/markets/sydney")).toBeNull();
  client.clear();
});
it("cannot break out of its inert JSON block, and preserves source text exactly", () => {
  const malicious = structuredClone(directory);
  malicious.markets[0]!.references.push({
    id: 1,
    title: "</script><script>alert(1)</script>\u2028",
    excerpt: "Evidence",
    date: "2026-09-14",
    publisher: "Source",
    sourceUrl: null,
    category: "PROPERTY",
  });
  document.body.innerHTML = marketBootstrapTag("/markets/sydney", malicious);
  expect(document.querySelectorAll("script")).toHaveLength(1);
  const payload = parseMarketBootstrap(
    document.getElementById(MARKET_BOOTSTRAP_ID)!.textContent,
    "/markets/sydney"
  );
  expect(payload?.directory).toEqual(malicious);
});
