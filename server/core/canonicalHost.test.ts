import { describe, expect, it } from "vitest";
import { canonicalRedirectFor } from "./canonicalHost";

const SITE = "https://thedesk.au";
const HOST = "thedesk.au";

function decide(over: Partial<Parameters<typeof canonicalRedirectFor>[0]>) {
  return canonicalRedirectFor(
    {
      method: "GET",
      host: HOST,
      proto: "https",
      originalUrl: "/",
      ...over,
    },
    SITE,
    HOST
  );
}

describe("canonicalRedirectFor", () => {
  it.each([
    "//outside.example/path/",
    "/\\outside.example/path/",
    "https://outside.example/",
    "/\t/outside.example/",
    "/\n/outside.example/",
    "/\r/outside.example/",
    " /about/",
  ])("does not turn malformed path %j into a redirect", (originalUrl) => {
    for (const host of [HOST, "www.thedesk.au", "staging.thedesk.au"])
      expect(decide({ host, originalUrl })).toBeNull();
  });

  it("keeps an encoded URL in a query on the same site", () => {
    expect(decide({ originalUrl: "/about/?next=https%3A%2F%2Foutside.example" })).toBe(
      "/about?next=https%3A%2F%2Foutside.example"
    );
  });

  it("leaves a canonical request alone", () => {
    expect(decide({ originalUrl: "/editions/12" })).toBeNull();
    expect(decide({ originalUrl: "/" })).toBeNull();
    expect(decide({ originalUrl: "/archive?q=rates" })).toBeNull();
  });

  it("folds www onto the apex, keeping path and query", () => {
    expect(decide({ host: "www.thedesk.au", originalUrl: "/archive?q=rates" })).toBe(
      "https://thedesk.au/archive?q=rates"
    );
  });

  it("upgrades http to https", () => {
    expect(decide({ proto: "http", originalUrl: "/about" })).toBe("https://thedesk.au/about");
  });

  it("reads the first hop out of a multi-proxy x-forwarded-proto", () => {
    expect(decide({ proto: "http, https", originalUrl: "/about" })).toBe(
      "https://thedesk.au/about"
    );
    expect(decide({ proto: "https, http", originalUrl: "/about" })).toBeNull();
  });

  it("fixes host and scheme in one hop", () => {
    expect(decide({ host: "www.thedesk.au", proto: "http", originalUrl: "/about" })).toBe(
      "https://thedesk.au/about"
    );
  });

  it("ignores the port on the Host header", () => {
    expect(decide({ host: "thedesk.au:443", originalUrl: "/about" })).toBeNull();
    expect(decide({ host: "www.thedesk.au:443", originalUrl: "/about" })).toBe(
      "https://thedesk.au/about"
    );
  });

  it("drops a trailing slash relative to the current host", () => {
    expect(decide({ originalUrl: "/about/" })).toBe("/about");
    expect(decide({ originalUrl: "/about/?ref=li" })).toBe("/about?ref=li");
  });

  it("never strips the root slash", () => {
    expect(decide({ originalUrl: "/" })).toBeNull();
    expect(decide({ originalUrl: "/?ref=li" })).toBeNull();
  });

  it("normalises the path when moving hosts too", () => {
    expect(decide({ host: "www.thedesk.au", originalUrl: "/about/" })).toBe(
      "https://thedesk.au/about"
    );
  });

  it("leaves unrelated hosts where they are", () => {
    // Railway's own domain and any staging deploy must keep serving,
    // not bounce their visitors onto production.
    expect(
      decide({ host: "the-desk-production.up.railway.app", originalUrl: "/about" })
    ).toBeNull();
    expect(decide({ host: "staging.thedesk.au", originalUrl: "/about" })).toBeNull();
    // …but the slash rule is host-independent, so it still applies.
    expect(decide({ host: "staging.thedesk.au", originalUrl: "/about/" })).toBe("/about");
  });

  it("exempts /api/ so callbacks and beacons aren't bounced", () => {
    expect(decide({ host: "www.thedesk.au", originalUrl: "/api/trpc/feed.list" })).toBeNull();
    expect(decide({ originalUrl: "/api/healthz/" })).toBeNull();
  });

  it("only redirects safe methods", () => {
    expect(decide({ method: "POST", host: "www.thedesk.au", originalUrl: "/about" })).toBeNull();
    expect(decide({ method: "HEAD", host: "www.thedesk.au", originalUrl: "/about" })).toBe(
      "https://thedesk.au/about"
    );
  });

  it("tolerates a missing Host or proto", () => {
    expect(decide({ host: undefined, proto: undefined, originalUrl: "/about" })).toBeNull();
  });
});
