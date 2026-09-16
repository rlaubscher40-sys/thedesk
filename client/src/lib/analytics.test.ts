import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());
async function setup() {
  vi.resetModules();
  const sendBeacon = vi.fn(() => true);
  const location = { pathname: "/markets/perth" };
  vi.stubGlobal("window", {
    location,
    sessionStorage: { getItem: () => "test-session-123456789" },
  });
  vi.stubGlobal("document", { referrer: "" });
  vi.stubGlobal("navigator", { sendBeacon });
  const analytics = await import("./analytics");
  const fetch = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetch);
  return { ...analytics, location, sendBeacon, fetch };
}

describe("market arrival analytics", () => {
  it("counts distinct market navigations while sending no market names", async () => {
    const { trackPageView, location, sendBeacon } = await setup();
    trackPageView();
    trackPageView();
    location.pathname = "/markets/sydney";
    trackPageView();
    expect(sendBeacon).toHaveBeenCalledTimes(2);
    for (const call of sendBeacon.mock.calls) {
      const body = JSON.parse(await (call[1] as Blob).text());
      expect(body.path).toBe("/markets/:market");
      expect(JSON.stringify(body)).not.toMatch(/perth|sydney/i);
    }
  });
  it("records a bounded onward action without leaking place names through paths", async () => {
    const { trackEvent, sendBeacon } = await setup();
    trackEvent("market_file_ask", "markets");
    const body = JSON.parse(await (sendBeacon.mock.calls[0]?.[1] as Blob).text());
    expect(body).toMatchObject({
      event: "market_file_ask",
      surface: "markets",
      path: "/markets/:market",
    });
    expect(JSON.stringify(body)).not.toContain("perth");
  });
});

describe("reliable private transport", () => {
  it("falls back when Beacon refuses the payload without duplicating accepted beacons", async () => {
    const { trackEvent, sendBeacon, fetch } = await setup();
    trackEvent("story_source", "story");
    expect(fetch).not.toHaveBeenCalled();
    sendBeacon.mockReturnValue(false);
    trackEvent("story_source", "story");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/analytics/event",
      expect.objectContaining({ keepalive: true })
    );
  });
  it("cannot interrupt a reader action when both transports fail", async () => {
    const { trackEvent, sendBeacon, fetch } = await setup();
    sendBeacon.mockImplementation(() => {
      throw new Error("blocked");
    });
    fetch.mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => trackEvent("newsletter_request", "subscribe")).not.toThrow();
  });
  it("redacts referrer paths, credentials and tokens before transmission", async () => {
    const { trackPageView, sendBeacon } = await setup();
    vi.stubGlobal("document", {
      referrer: "https://reader:secret@example.com/private?token=abc#email",
    });
    trackPageView();
    const body = JSON.parse(await (sendBeacon.mock.calls[0]![1] as Blob).text());
    expect(body.referrer).toBe("example.com");
    expect(JSON.stringify(body)).not.toMatch(/secret|private|token|email/);
  });
  it("respects DNT and rejects unbounded runtime labels", async () => {
    const { trackEvent, trackPageView, sendBeacon, fetch } = await setup();
    trackEvent("story_source", "secret@example.com" as never);
    trackEvent("reader@example.com" as never, "story");
    vi.stubGlobal("navigator", { sendBeacon, doNotTrack: "1" });
    trackEvent("newsletter_request", "subscribe");
    trackPageView();
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not replace blocked session storage with persistent tracking", async () => {
    const { trackEvent, sendBeacon, fetch } = await setup();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    });
    trackEvent("story_open", "story");
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
