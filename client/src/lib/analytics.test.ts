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
  return { ...analytics, location, sendBeacon };
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
