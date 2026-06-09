/**
 * Top-level routing + global providers. Pages are lazy-loaded so the initial
 * bundle stays under what one screen needs.
 */
import { AnimatePresence, motion } from "framer-motion";
import { Suspense, useEffect } from "react";
import { Route, Switch, useLocation, useSearch } from "wouter";
import { AppLayout } from "./components/AppLayout";
import { BreakingSignalToast } from "./components/BreakingSignalToast";
import { CommandPalette } from "./components/CommandPalette";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OnboardingModal } from "./components/OnboardingModal";
import { SubscribeModal } from "./components/SubscribeModal";
import { Skeleton } from "./components/ui/Skeleton";
import { Toaster } from "./components/ui/Toaster";
import { trackPageView } from "./lib/analytics";
import { lazyWithReload } from "./lib/chunkReload";
import { PersonaProvider } from "./lib/persona";
import { ThemeProvider } from "./lib/theme";
import { UserPrefsProvider } from "./lib/userPrefs";

// Lazy-load every page. The bundle for / loads only DailyFeed; the rest
// come on demand. `lazyWithReload` recovers from stale-deploy chunk
// failures (see lib/chunkReload) so a redeploy can't strand a user on a
// page whose chunk hash has since changed.
const DailyFeed = lazyWithReload(() => import("./pages/DailyFeed"), "DailyFeed");
const Editions = lazyWithReload(() => import("./pages/Editions"), "Editions");
const ReadingQueue = lazyWithReload(() => import("./pages/ReadingQueue"), "ReadingQueue");
const TopicThreads = lazyWithReload(() => import("./pages/TopicThreads"), "TopicThreads");
const Trends = lazyWithReload(() => import("./pages/Trends"), "Trends");
const About = lazyWithReload(() => import("./pages/About"), "About");
const StoryPage = lazyWithReload(() => import("./pages/StoryPage"), "StoryPage");
const AdminPage = lazyWithReload(() => import("./pages/Admin"), "Admin");
const Archive = lazyWithReload(() => import("./pages/Archive"), "Archive");
const Login = lazyWithReload(() => import("./pages/Login"), "Login");
const Privacy = lazyWithReload(() => import("./pages/Privacy"), "Privacy");
const Terms = lazyWithReload(() => import("./pages/Terms"), "Terms");
const EditorialStandards = lazyWithReload(() => import("./pages/EditorialStandards"), "EditorialStandards");
const Corrections = lazyWithReload(() => import("./pages/Corrections"), "Corrections");
const ConfirmSubscription = lazyWithReload(() => import("./pages/ConfirmSubscription"), "ConfirmSubscription");
const Settings = lazyWithReload(() => import("./pages/Settings"), "Settings");
const InstallApp = lazyWithReload(() => import("./pages/InstallApp"), "InstallApp");
const NotFound = lazyWithReload(() => import("./pages/NotFound"), "NotFound");

function KeyboardShortcuts() {
  const [, navigate] = useLocation();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/") {
        e.preventDefault();
        navigate("/archive");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
  return null;
}

/** Legacy /search → /archive redirect that carries the query string across. */
function SearchRedirect() {
  const [, navigate] = useLocation();
  const search = useSearch();
  useEffect(() => {
    navigate(search ? `/archive?${search}` : "/archive", { replace: true });
  }, [navigate, search]);
  return null;
}

function PageFallback() {
  return (
    <div className="space-y-3 max-w-3xl">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

function Routes() {
  // Wrap routes in AnimatePresence so navigations fade between pages instead
  // of snapping. Honour prefers-reduced-motion, disable transitions when set.
  const [location] = useLocation();

  // Fire a privacy-preserving page-view beacon on every route change.
  // Replaces the Plausible script; persists to the page_views table
  // and surfaces in the admin /analytics panel.
  //
  // Also keep a self-referencing <link rel="canonical"> in sync with the
  // active route. The static index.html shell ships without one, so every
  // URL variant (tracking params like ?fbclid / ?utm_*, trailing slashes)
  // otherwise looks like a separate duplicate page to Google. We strip the
  // query string and hash so the canonical is the bare path. Per-edition
  // pages already get a canonical injected server-side (server/core/seo.ts)
  // before the bundle loads; this keeps that element pointing at the live
  // path during client-side navigation rather than adding a second one.
  useEffect(() => {
    trackPageView();
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = window.location.origin + window.location.pathname;
  }, [location]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? {} : { opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      >
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/" component={DailyFeed} />
            <Route path="/editions" component={Editions} />
            <Route path="/editions/:editionNumber" component={Editions} />
            <Route path="/queue" component={ReadingQueue} />
            {/* Legacy /search route → forward to the unified /archive, keeping
                whatever query string was on the URL so deep links survive. */}
            <Route path="/search" component={SearchRedirect} />
            <Route path="/trends" component={Trends} />
            <Route path="/topics" component={TopicThreads} />
            <Route path="/topics/:category" component={TopicThreads} />
<Route path="/about" component={About} />
            <Route path="/archive" component={Archive} />
            <Route path="/story/:id" component={StoryPage} />
            <Route path="/admin" component={AdminPage} />
            <Route path="/login" component={Login} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/editorial-standards" component={EditorialStandards} />
            <Route path="/corrections" component={Corrections} />
            <Route path="/confirm-subscription" component={ConfirmSubscription} />
            {/* /confirm alias kept so older confirm-emails (which built
                their CTA against the shorter path) still resolve. */}
            <Route path="/confirm" component={ConfirmSubscription} />
            <Route path="/settings" component={Settings} />
            <Route path="/install" component={InstallApp} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <UserPrefsProvider>
        <PersonaProvider>
          <Toaster />
          <AppLayout>
            <KeyboardShortcuts />
            <Routes />
          </AppLayout>
          <CommandPalette />
          <BreakingSignalToast />
          <OnboardingModal />
          <SubscribeModal />
        </PersonaProvider>
        </UserPrefsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
