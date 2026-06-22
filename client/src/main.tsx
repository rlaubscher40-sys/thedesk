import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import App from "./App";
import { getLoginUrl } from "./lib/auth";
import { initErrorReporter } from "./lib/errorReporter";
import { initCrashLoopGuard } from "./lib/crashLoopDetector";
import { trpc } from "./lib/trpc";
import { initInstallPrompt } from "./lib/installPrompt";
import "./index.css";

initInstallPrompt();

// Browser error reporter. Sends window.error + unhandledrejection
// to /api/errors/client, which writes into the same server_errors
// table the admin /health panel reads. No third-party SDK; the
// internal tracker replaced Sentry.
initErrorReporter();

// Crash-loop guard. Runs before React renders so it records this boot — and,
// if the page is repeatedly crashing the WebKit tab (the silent OOM/hang that
// throws no error and shows Safari's "A problem repeatedly occurred"), reports
// it to /health and tears down a wedged service worker. See crashLoopDetector.
initCrashLoopGuard();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, err) => {
        // Don't retry unauth errors, we redirect the user instead.
        if (err instanceof TRPCClientError && err.message === UNAUTHED_ERR_MSG) return false;
        return failureCount < 2;
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
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: (input, init) => globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Dismiss the first-paint splash once the React tree has committed
// (see index.html). Two rAFs ensures we tick past the first commit
// frame so the user actually sees the app underneath before the
// splash fades, otherwise it can race the first skeleton paint and
// look like a flash.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById("boot-splash");
    if (!splash) return;
    splash.classList.add("done");
    splash.addEventListener("transitionend", () => splash.remove(), { once: true });
    // Safety net for browsers that swallow the transitionend event.
    setTimeout(() => splash.remove(), 1200);
  });
});
