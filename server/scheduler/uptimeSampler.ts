/**
 * Uptime sampler — the dense half of uptime monitoring.
 *
 * Replaces the GitHub Actions five-minute cron that never actually ran every
 * 5 minutes. Measured over 3 days in Aug 2026, GitHub fired it at intervals of
 * 57–346 minutes (median ~99) and cancelled two runs outright without ever
 * assigning a runner — the same best-effort cron behaviour that pushed the
 * daily jobs in-process (docs/reliable-scheduling.md).
 *
 * This is a plain interval, not a watermark job: there's no "today's run" to
 * claim, a missed sample is worth nothing after the fact, and double-sampling
 * across replicas is harmless (two rows, both true). So it deliberately does
 * not go through `job_runs` like the JOBS table does.
 *
 * It probes the *public* URL rather than loopback, so a sample exercises DNS,
 * TLS and the Railway edge the way a reader does. The obvious limitation: it
 * runs inside the app, so it records nothing while the app is down. That gap
 * is covered by the external monitor posting to /api/uptime/webhook — the two
 * are designed as a pair, not alternatives.
 */
import { DEFAULT_SITE_URL } from "../../shared/const";
import { env } from "../core/env";
import { isDemoMode } from "../demo/store";
import { recordUptimePing } from "../db/health";

const SAMPLE_MINUTES = 5;
const BOOT_DELAY_MS = 20_000;
const PROBE_TIMEOUT_MS = 20_000;

/** Same precedence as the rest of the server: SITE_URL, then the constant. */
function publicBaseUrl(): string {
  const raw = process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, "");
}

/**
 * One probe. Exported for tests and for the manual trigger. Never throws:
 * a probe that fails *is* the measurement, recorded as status 0 so the panel
 * can tell "we asked and got nothing" apart from "we never asked".
 */
export async function sampleOnce(baseUrl = publicBaseUrl()): Promise<void> {
  const startedAt = Date.now();
  let statusCode = 0;
  try {
    const res = await fetch(`${baseUrl}/api/healthz`, {
      method: "GET",
      headers: { "cache-control": "no-cache" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    statusCode = res.status;
    // Drain the body so the socket can be reused rather than left half-read.
    await res.text().catch(() => "");
  } catch {
    statusCode = 0; // DNS failure, TLS error, timeout, connection refused.
  }
  const latencyMs = Math.min(Date.now() - startedAt, 120_000);
  try {
    await recordUptimePing({
      statusCode,
      latencyMs,
      source: "self",
      region: null,
    });
  } catch (err) {
    // A DB write failure here must not crash the interval. It also means the
    // app is unwell in a way /api/healthz would already be reporting.
    console.warn(`[uptime] couldn't record sample: ${(err as Error).message}`);
  }
}

let started = false;

/**
 * Start sampling. No-ops in demo mode and when the scheduler is off, so it
 * shares the single ENABLE_SCHEDULER rollout switch the daily jobs use.
 * Set UPTIME_SAMPLER=false to keep the scheduler but drop the sampling.
 */
export function startUptimeSampler(): void {
  if (started) return;
  if (isDemoMode()) return;
  if (!env.enableScheduler) return;
  if ((process.env.UPTIME_SAMPLER ?? "").toLowerCase() === "false") {
    console.log("[uptime] sampler disabled (UPTIME_SAMPLER=false)");
    return;
  }
  started = true;
  const baseUrl = publicBaseUrl();
  console.log(`[uptime] sampling ${baseUrl}/api/healthz every ${SAMPLE_MINUTES}m`);
  const fire = () => void sampleOnce(baseUrl);
  setTimeout(fire, BOOT_DELAY_MS);
  const handle = setInterval(fire, SAMPLE_MINUTES * 60_000);
  handle.unref?.();
}
