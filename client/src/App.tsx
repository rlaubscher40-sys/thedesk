/**
 * Top-level routing + global providers. Pages are lazy-loaded so the initial
 * bundle stays under what one screen needs.
 */
import { AnimatePresence, motion } from "framer-motion";
import { Suspense, lazy, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { AppLayout } from "./components/AppLayout";
import { BreakingSignalToast } from "./components/BreakingSignalToast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OnboardingModal } from "./components/OnboardingModal";
import { Skeleton } from "./components/ui/Skeleton";
import { Toaster } from "./components/ui/Toaster";
import { ThemeProvider } from "./lib/theme";

// Lazy-load every page. The bundle for / loads only DailyFeed; the rest come on demand.
const DailyFeed = lazy(() => import("./pages/DailyFeed"));
const Editions = lazy(() => import("./pages/Editions"));
const ReadingQueue = lazy(() => import("./pages/ReadingQueue"));
const Notes = lazy(() => import("./pages/Notes"));
const ConversationTracker = lazy(() => import("./pages/ConversationTracker"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const TopicThreads = lazy(() => import("./pages/TopicThreads"));
const Trends = lazy(() => import("./pages/Trends"));
const About = lazy(() => import("./pages/About"));
const StoryPage = lazy(() => import("./pages/StoryPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function KeyboardShortcuts() {
  const [, navigate] = useLocation();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/") {
        e.preventDefault();
        navigate("/search");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
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
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/" component={DailyFeed} />
            <Route path="/editions" component={Editions} />
            <Route path="/editions/:editionNumber" component={Editions} />
            <Route path="/queue" component={ReadingQueue} />
            <Route path="/notes" component={Notes} />
            <Route path="/tracker" component={ConversationTracker} />
            <Route path="/conversations" component={ConversationTracker} />
            <Route path="/search" component={SearchPage} />
            <Route path="/trends" component={Trends} />
            <Route path="/topics" component={TopicThreads} />
            <Route path="/topics/:category" component={TopicThreads} />
            <Route path="/about" component={About} />
            <Route path="/story/:id" component={StoryPage} />
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
        <Toaster />
        <AppLayout>
          <KeyboardShortcuts />
          <Routes />
        </AppLayout>
        <BreakingSignalToast />
        <OnboardingModal />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
