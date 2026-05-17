/**
 * Top-level routing + global providers. Pages are lazy-loaded so the initial
 * bundle stays under what one screen needs.
 */
import { AnimatePresence, motion } from "framer-motion";
import { Suspense, lazy, useEffect } from "react";
import { Route, Switch, useLocation, useSearch } from "wouter";
import { AppLayout } from "./components/AppLayout";
import { BreakingSignalToast } from "./components/BreakingSignalToast";
import { CommandPalette } from "./components/CommandPalette";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OnboardingModal } from "./components/OnboardingModal";
import { SubscribeModal } from "./components/SubscribeModal";
import { Skeleton } from "./components/ui/Skeleton";
import { Toaster } from "./components/ui/Toaster";
import { PersonaProvider } from "./lib/persona";
import { ThemeProvider } from "./lib/theme";
import { UserPrefsProvider } from "./lib/userPrefs";

// Lazy-load every page. The bundle for / loads only DailyFeed; the rest come on demand.
const DailyFeed = lazy(() => import("./pages/DailyFeed"));
const Editions = lazy(() => import("./pages/Editions"));
const ReadingQueue = lazy(() => import("./pages/ReadingQueue"));
const TopicThreads = lazy(() => import("./pages/TopicThreads"));
const Trends = lazy(() => import("./pages/Trends"));
const About = lazy(() => import("./pages/About"));
const StoryPage = lazy(() => import("./pages/StoryPage"));
const AdminPage = lazy(() => import("./pages/Admin"));
const Archive = lazy(() => import("./pages/Archive"));
const Login = lazy(() => import("./pages/Login"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const EditorialStandards = lazy(() => import("./pages/EditorialStandards"));
const Corrections = lazy(() => import("./pages/Corrections"));
const ConfirmSubscription = lazy(() => import("./pages/ConfirmSubscription"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
  // of snapping. Honour prefers-reduced-motion — disable transitions when set.
  const [location] = useLocation();
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
            <Route path="/settings" component={Settings} />
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
