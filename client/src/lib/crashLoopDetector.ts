/**
 * Crash-loop detector + service-worker kill switch.
 *
 * iOS Safari shows "A problem repeatedly occurred" when the tab's WebKit
 * content process crashes on load several times in a row. The two triggers we
 * can't otherwise see are (a) the tab running out of memory or hanging the main
 * thread — which throws NO JavaScript error, so window.onerror and the error
 * reporter never fire — and (b) a wedged service worker pinning the browser to
 * a broken shell. Either way the symptom is the same: the page boots, dies, and
 * the browser silently reloads, over and over.
 *
 * This module tracks interrupted starts in sessionStorage, scoped to one tab.
 * Normal page exits and a healthy React start clear the trail. Repeated starts
 * without either signal suggest a loop; they cannot prove an OOM or its cause.
 * When that heuristic reaches the threshold it:
 *
 *   1. Reports a synthetic error to /api/errors/client (via the existing
 *      reporter) so the otherwise-invisible crash finally shows up in the admin
 *      /health panel — with the offending URL attached. This is the one failure
 *      mode the error reporter is blind to on its own.
 *   2. Acts as a kill switch — best-effort, one-shot — dropping the service
 *      worker and its caches so a stale/broken shell can't keep trapping the
 *      visitor on the next (browser-driven) reload. If the cause is memory, the
 *      report still lands.
 *
 * Everything here is guarded so the detector itself can never throw during boot
 * and can never become the thing that loops (storage failures degrade to "no
 * loop"; recovery runs at most once per cooldown).
 */
import { reportError } from "./errorReporter";
import { enableLiteMode } from "./liteMode";

const BOOTS_KEY = "thedesk:pending-boots:v2";
const RECOVERY_KEY = "thedesk:crash-recovery-at";

/** Interrupted starts within this window count toward a possible loop. */
export const WINDOW_MS = 20_000;
/** This many consecutive interrupted starts trigger recovery. */
export const LOOP_THRESHOLD = 4;
/** Keep the early-start recovery window open after React commits. */
export const HEALTHY_BOOT_MS = 5_000;
/** Don't tear the service worker down more than once per this interval. */
const RECOVERY_COOLDOWN_MS = 5 * 60_000;

/**
 * Pure core: given the previous boot timestamps and "now", return the pruned
 * list (recent boots + this one) and whether that constitutes a loop. Kept free
 * of storage/DOM so it can be unit-tested directly.
 */
export function evaluateBoots(
  previous: number[],
  now: number
): { boots: number[]; looping: boolean } {
  const boots = previous.filter((t) => now - t < WINDOW_MS && t <= now);
  boots.push(now);
  return { boots, looping: boots.length >= LOOP_THRESHOLD };
}

function readBoots(): number[] {
  try {
    const raw = sessionStorage.getItem(BOOTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function writeBoots(boots: number[]): void {
  try {
    sessionStorage.setItem(BOOTS_KEY, JSON.stringify(boots));
  } catch {
    /* storage unavailable — degrade to no-loop detection */
  }
}

function clearBoots(): void {
  try {
    sessionStorage.removeItem(BOOTS_KEY);
  } catch {
    /* ignore */
  }
}

/** Called from a React commit effect. Cleanup prevents an unmounted tree from
 * marking a failed start healthy (and supports StrictMode's effect replay). */
export function watchHealthyBoot(): () => void {
  const timer = setTimeout(clearBoots, HEALTHY_BOOT_MS);
  return () => clearTimeout(timer);
}

function isFreshNavigation(): boolean {
  try {
    // New tabs can inherit an opener's sessionStorage. A fresh navigation must
    // not inherit its interrupted starts. Reloads retain the recovery trail.
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return navigation?.type === "navigate" || navigation?.type === "back_forward";
  } catch {
    return false;
  }
}

/** One concise diagnostic line per available signal, stashed in the report's
 *  stack slot so the /health row carries device context for triage. */
function diagnostics(bootCount: number): string {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const lines = [
    "crash-loop-detector",
    `interrupted starts in this tab: ${bootCount} within ${WINDOW_MS / 1000}s`,
    `ua: ${nav?.userAgent ?? "n/a"}`,
    // deviceMemory is Chromium-only; absent on Safari but worth capturing when present.
    `deviceMemory: ${(nav as { deviceMemory?: number } | undefined)?.deviceMemory ?? "n/a"}`,
    `viewport: ${typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "n/a"}`,
    `url: ${typeof window !== "undefined" ? window.location.href : "n/a"}`,
  ];
  return lines.join("\n");
}

/** Best-effort, one-shot-per-cooldown teardown of the service worker + caches
 *  so a wedged shell can't keep crashing the next load. Never blocks or throws. */
async function attemptRecovery(now: number): Promise<void> {
  try {
    const last = Number(localStorage.getItem(RECOVERY_KEY) ?? "0");
    if (Number.isFinite(last) && now - last < RECOVERY_COOLDOWN_MS) return;
    localStorage.setItem(RECOVERY_KEY, String(now));
  } catch {
    // Can't track the cooldown — skip recovery rather than risk nuking caches
    // on every single crash-looped load.
    return;
  }
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Record this boot and, if we've crossed into a crash loop, report it and fire
 * the recovery kill switch. Call once, as early as possible in app boot.
 *
 * Returns true when a crash loop is suspected, so the caller can render the
 * lightweight safe-mode screen (see renderCrashLoopSafeMode) instead of
 * re-mounting the full app.
 */
export function initCrashLoopGuard(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;

  let looping = false;
  try {
    if (isFreshNavigation()) clearBoots();
    // Reloads, links and back/forward exits are not evidence of a crash. Unlike
    // unload/beforeunload, pagehide also permits the browser's back/forward cache.
    window.addEventListener("pagehide", clearBoots, { once: true });
    const { boots, looping: isLooping } = evaluateBoots(readBoots(), now);
    looping = isLooping;
    if (looping) {
      // Clear the breadcrumb trail so a manual retry starts a fresh count and
      // we don't re-report on every subsequent crashed load.
      clearBoots();
    } else {
      writeBoots(boots);
    }
  } catch {
    // The guard must never be the reason boot fails.
    return false;
  }

  if (!looping) return false;

  // Report the heuristic, without claiming a confirmed crash or device cause.
  const err = new Error("Possible startup loop: repeated interrupted starts in one tab");
  err.stack = diagnostics(LOOP_THRESHOLD);
  reportError(err);

  // Persist lite mode so the next full-app load (via the safe-mode retry, or a
  // browser auto-reload) comes back stripped of the heavy animations and blur
  // while the visitor retries.
  enableLiteMode();

  // Best-effort shell teardown for the wedged-service-worker case.
  void attemptRecovery(now);

  return true;
}

/**
 * Minimal, dependency-free "safe mode" screen, shown when the app has been
 * crash-looping. Deliberately renders raw DOM with inline hex styling — no
 * React, no Tailwind, no oklch — so it paints even on the low-memory or
 * out-of-date device that couldn't keep the full app alive, and breaks the
 * reload loop by not mounting the heavy tree. Offers one explicit retry that
 * clears the breadcrumb trail and reloads into the full app.
 */
export function renderCrashLoopSafeMode(): void {
  if (typeof document === "undefined") return;

  const splash = document.getElementById("boot-splash");
  if (splash) splash.remove();

  const root = document.getElementById("root");
  if (!root) return;

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0c1220;color:#e8e2d4;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-sizing:border-box">
      <div style="max-width:420px;text-align:left">
        <p style="font:11px/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.22em;text-transform:uppercase;color:#d4a853;margin:0 0 14px">The Desk</p>
        <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;color:#f3efe6">The Desk had trouble starting</h1>
        <p style="margin:0 0 10px;color:#b9b2a4">This tab restarted several times before startup completed. We've paused loading and enabled a lighter view for your next attempt. The cause could be an app or browser issue.</p>
        <ul style="margin:0 0 18px;padding-left:20px;color:#b9b2a4">
          <li style="margin-bottom:4px">Try again to reload The Desk</li>
          <li style="margin-bottom:4px">If the problem continues, try closing this tab and opening The Desk again</li>
        </ul>
        <button id="thedesk-safe-retry" type="button" style="appearance:none;border:1px solid #d4a853;background:#d4a853;color:#241a06;font-weight:600;font-size:15px;padding:10px 18px;border-radius:6px;cursor:pointer">Try again</button>
      </div>
    </div>`;

  const retry = document.getElementById("thedesk-safe-retry");
  if (retry) {
    retry.addEventListener("click", () => {
      clearBoots();
      window.location.reload();
    });
  }
}
