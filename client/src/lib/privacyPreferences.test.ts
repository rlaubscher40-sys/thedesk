// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([{ doNotTrack: "1" }, { globalPrivacyControl: true }])(
  "blocks analytics and signup attribution for browser signal %j and clears old tracking state",
  async (signal) => {
    const beacon = vi.fn();
    vi.stubGlobal("navigator", { ...signal, sendBeacon: beacon });
    sessionStorage.setItem("thedesk:session", "old-session");
    sessionStorage.setItem(
      "thedesk:arrival",
      JSON.stringify({ source: "instagram", campaign: "bio" })
    );
    const { captureArrival, getArrival } = await import("./attribution");
    const { trackPageView, trackEvent } = await import("./analytics");
    expect(captureArrival()).toBeNull();
    expect(getArrival()).toBeNull();
    trackPageView();
    trackEvent("newsletter_request", "subscribe");
    expect(beacon).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
  }
);

it("honours a reader opt-out immediately, on reload, and across tabs without changing reading preferences", async () => {
  localStorage.setItem("thedesk:theme", "dark");
  const privacy = await import("./privacyPreferences");
  expect(privacy.optionalMeasurementAllowed()).toBe(true);
  expect(privacy.setOptionalMeasurement(false)).toBe(true);
  expect(privacy.optionalMeasurementAllowed()).toBe(false);
  expect(localStorage.getItem("thedesk:theme")).toBe("dark");
  vi.resetModules();
  const fresh = await import("./privacyPreferences");
  expect(fresh.optionalMeasurementAllowed()).toBe(false);
  expect(fresh.setOptionalMeasurement(true)).toBe(true);
  expect(fresh.optionalMeasurementAllowed()).toBe(true);
  // Another tab writes this origin's shared localStorage.
  localStorage.setItem("thedesk:analytics-disabled", "1");
  expect(fresh.optionalMeasurementAllowed()).toBe(false);
});

it("fails closed when the privacy preference cannot be read or saved", async () => {
  const privacy = await import("./privacyPreferences");
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(privacy.setOptionalMeasurement(false)).toBe(false);
  expect(privacy.optionalMeasurementAllowed()).toBe(false);
  expect(privacy.setOptionalMeasurement(true)).toBe(false);
  expect(privacy.optionalMeasurementAllowed()).toBe(false);
});

it("stops already-registered performance observers after opting out", async () => {
  const callbacks: Array<(metric: object) => void> = [];
  vi.doMock("web-vitals", () => ({
    onCLS: (cb: (metric: object) => void) => callbacks.push(cb),
    onLCP: (cb: (metric: object) => void) => callbacks.push(cb),
    onINP: (cb: (metric: object) => void) => callbacks.push(cb),
  }));
  const sendBeacon = vi.fn(() => true);
  vi.stubGlobal("navigator", { sendBeacon });
  const { initWebVitals } = await import("./webVitals");
  const { setOptionalMeasurement } = await import("./privacyPreferences");
  initWebVitals();
  expect(callbacks).toHaveLength(3);
  callbacks[0]!({ id: "test", name: "CLS", value: 0.1 });
  expect(sendBeacon).toHaveBeenCalledTimes(1);
  setOptionalMeasurement(false);
  for (const cb of callbacks) cb({ id: "test", name: "CLS", value: 0.2 });
  expect(sendBeacon).toHaveBeenCalledTimes(1);
  vi.doUnmock("web-vitals");
});
