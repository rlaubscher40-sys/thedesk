import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { ASK_CLIENT_TIMEOUT_MS, withDeadline } from "@shared/requestDeadline";
import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import superjson from "superjson";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import App from "./App";
import { getLoginUrl } from "./lib/auth";
import { initErrorReporter } from "./lib/errorReporter";
import { initCrashLoopGuard, renderCrashLoopSafeMode, watchHealthyBoot } from "./lib/crashLoopDetector";
import { applyLiteClass } from "./lib/liteMode";
import { trpc } from "./lib/trpc";
import { queryFetch } from "./lib/queryFetch";
import { initInstallPrompt } from "./lib/installPrompt";
import "./index.css";

initInstallPrompt();

// Browser error reporter. Sends window.error + unhandledrejection
// to /api/errors/client, which writes into the same server_errors
// table the admin /health panel reads. No third-party SDK; the
// internal tracker replaced Sentry.
initErrorReporter();

// Crash-loop guard. Runs before React renders so it records this boot — and,
// if this tab repeatedly restarts before becoming healthy, reports a possible
// startup loop and attempts recovery. See crashLoopDetector.
const inCrashLoop = initCrashLoopGuard();

// Put <html class="lite"> in place before first paint so the cheap-paint CSS
// applies for reduced-motion users and any device flagged after a crash loop.
applyLiteClass();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, err) => {
        // Don't retry unauth errors, we redirect the user instead.
        if (err instanceof TRPCClientError && err.message === UNAUTHED_ERR_MSG) return false;
        return failureCount < 1;
      },
    },
  },
});

function maybeRedirectToLogin(err: unknown): void {
  if (!(err instanceof TRPCClientError)) return;
  if (err.message !== UNAUTHED_ERR_MSG) return;
  if (typeof window === "undefined") return;
  window.location.href = getLoginUrl();
}

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    maybeRedirectToLogin(event.query.state.error);
  }
});
queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    maybeRedirectToLogin(event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.path === "ask.answer",
      true: httpLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: (input, init) => withDeadline(async (signal) => {
          const response = await globalThis.fetch(input, { ...init, credentials: "include", signal });
          // Include the response body in the deadline, not only the headers.
          const body = await response.text();
          return new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }, ASK_CLIENT_TIMEOUT_MS),
      }),
      false: splitLink({
        condition: (op) => op.type === "query",
        true: httpBatchLink({ url: "/api/trpc", transformer: superjson, fetch: queryFetch }),
        // Long-running publishing/admin mutations keep their existing behaviour.
        false: httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          fetch: (input, init) => globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }),
        }),
      }),
    }),
  ],
});

function BootHealth() {
  useEffect(() => {
    // Dismiss only after React commits, not after an assumed number of frames.
    const splash = document.getElementById("boot-splash");
    splash?.classList.add("done");
    const removal = setTimeout(() => splash?.remove(), 500);
    const stopWatching = watchHealthyBoot();
    return () => { clearTimeout(removal); stopWatching(); };
  }, []);
  return null;
}

if (inCrashLoop) {
  // Pause the full app after repeated interrupted starts in this tab.
  renderCrashLoopSafeMode();
} else {
  createRoot(document.getElementById("root")!).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
        <BootHealth />
      </QueryClientProvider>
    </trpc.Provider>
  );

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

}
