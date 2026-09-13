import { onCLS, onINP, onLCP, type Metric } from "web-vitals";
import { analyticsPath } from "@shared/analyticsPath";
/** No account, session, element selector, query text or raw URL is transmitted. */
export function initWebVitals() {
  if (
    navigator.doNotTrack === "1" ||
    (window as Window & { doNotTrack?: string }).doNotTrack === "1"
  )
    return;
  const path = analyticsPath(window.location.pathname);
  const device = window.innerWidth < 768 ? "mobile" : "desktop";
  const report = ({ id, name, value }: Metric) => {
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
