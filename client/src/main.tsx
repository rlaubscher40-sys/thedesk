import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import App from "./App";
import { getLoginUrl } from "./lib/auth";
import { initSentry } from "./lib/sentry";
import { trpc } from "./lib/trpc";
import "./index.css";

// Browser error monitoring. No-op when VITE_SENTRY_DSN isn't set, so the
// dev environment stays quiet.
initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, err) => {
        // Don't retry unauth errors — we redirect the user instead.
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
