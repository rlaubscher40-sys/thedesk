import { pathToFileURL } from "node:url";

/** Standalone external probe: no application dependencies and no credential logs. */
export async function checkUptime({ origin, key, fetcher = fetch, now = Date.now }) {
  const base = new URL(origin);
  if (base.protocol !== "https:" || base.username || base.password)
    throw new Error("A public HTTPS origin is required");
  const started = now();
  let httpStatus = 0;
  let healthy = false;
  try {
    const response = await fetcher(new URL("/api/healthz", base), {
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    httpStatus = response.status;
    const body = await response.json();
    healthy = response.ok && body.status === "ok" && body.db === true;
  } catch {
    /* Network, invalid JSON and redirect failures are unhealthy probes. */
  }
  const latencyMs = Math.min(120000, Math.max(0, now() - started));
  let recorded = false;
  if (key) {
    try {
      const response = await fetcher(new URL("/api/uptime/record", base), {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
        headers: { "content-type": "application/json", "x-scheduled-key": key },
        body: JSON.stringify({
          statusCode: healthy
            ? httpStatus
            : httpStatus >= 200 && httpStatus < 300
              ? 503
              : httpStatus,
          latencyMs,
          source: "github-actions",
          region: "github",
        }),
      });
      recorded = response.status === 200 || response.status === 204;
    } catch {
      /* Recording failure must not hide the independently observed result. */
    }
  }
  return {
    healthy,
    httpStatus,
    latencyMs,
    recorded,
    recordingConfigured: Boolean(key),
    ok: healthy && recorded,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await checkUptime({
      origin: process.env.SITE_URL || "https://thedesk.au",
      key: process.env.SCHEDULED_API_KEY,
    });
    console.log(`[uptime] ${JSON.stringify(result)}`);
    if (!result.healthy) console.error("::error::Public application health probe failed");
    if (!result.recorded)
      console.error(
        "::error::Probe history was not recorded; check the recorder configuration independently"
      );
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    console.error("::error::Uptime check configuration failed");
    process.exitCode = 1;
  }
}
