import { onCLS, onINP, onLCP, type Metric } from "web-vitals";
import { analyticsPath } from "@shared/analyticsPath";
import { optionalMeasurementAllowed } from "./privacyPreferences";
/** No account, session, element selector, query text or raw URL is transmitted. */
export function initWebVitals() {
  if (!optionalMeasurementAllowed()) return;
  const path = analyticsPath(window.location.pathname);
  const device = window.innerWidth < 768 ? "mobile" : "desktop";
  const report = ({ id, name, value }: Metric) => {
    // Observers can fire long after registration, including at page exit.
    if (!optionalMeasurementAllowed()) return;
    const body = JSON.stringify({ id, name, value, path, device });
    try {
      if (
        navigator.sendBeacon?.(
          "/api/analytics/vitals",
          new Blob([body], { type: "application/json" })
        )
      )
        return;
    } catch {
      /* Fetch fallback. */
    }
    void fetch("/api/analytics/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  };
  try {
    onCLS(report);
    onINP(report);
    onLCP(report);
  } catch {
    /* Unsupported measurement APIs must not affect reading. */
  }
}
