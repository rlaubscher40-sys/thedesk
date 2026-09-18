import { pageCanonical } from "@shared/pageCanonical";
import { socialArrivalPath } from "@shared/entryRoutes";
/**
 * Top-level routing + global providers. Pages are lazy-loaded so the initial
 * bundle stays under what one screen needs.
 */
import { withDeadline } from "@shared/requestDeadline";
import { FEATURED_COMPARISON_PATH } from "@shared/featuredComparison";
import { Suspense, useEffect, useRef, type ComponentType } from "react";
import { Route, Switch, useLocation, useSearch } from "wouter";
import { BookmarkProvider } from "./lib/useBookmarks";
import { AppLayout } from "./components/AppLayout";
import { BreakingSignalToast } from "./components/BreakingSignalToast";
import { CommandPalette } from "./components/CommandPalette";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Skeleton } from "./components/ui/Skeleton";
import { Toaster } from "./components/ui/Toaster";
import { trackPageView } from "./lib/analytics";
import { captureArrival } from "./lib/attribution";
import { lazyWithReload } from "./lib/chunkReload";
import { PersonaProvider } from "./lib/persona";
import { ThemeProvider } from "./lib/theme";
import { UserPrefsProvider } from "./lib/userPrefs";

// Lazy-load every page. The bundle for / loads only DailyFeed; the rest
// come on demand. `lazyWithReload` recovers from stale-deploy chunk
// failures (see lib/chunkReload) so a redeploy can't strand a user on a
// page whose chunk hash has since changed.
const EvidencePage = lazyWithReload(() => import("./pages/Evidence"), "Evidence");
const DailyFeed = lazyWithReload(() => import("./pages/DailyFeed"), "DailyFeed");
const SocialSources = lazyWithReload(() => import("./pages/SocialSources"), "SocialSources");
const RentPressure = lazyWithReload(() => import("./pages/RentPressure"), "RentPressure");
const Partners = lazyWithReload(() => import("./pages/Partners"), "Partners");
const PropertyGuides = lazyWithReload(() => import("./pages/PropertyGuides"), "PropertyGuides");
const Projects = lazyWithReload(() => import("./pages/Projects"), "Projects");
const AskDesk = lazyWithReload(() => import("./pages/AskDesk"), "AskDesk");
const SharedBrief = lazyWithReload(() => import("./pages/SharedBrief"), "SharedBrief");
const Signals = lazyWithReload(() => import("./pages/Signals"), "Signals");
const Markets = lazyWithReload(() => import("./pages/Markets"), "Markets");
const HousingBalance = lazyWithReload(() => import("./pages/HousingBalance"), "HousingBalance");
let PublicMarket: ComponentType = lazyWithReload(
  () => import("./pages/PublicMarket"),
  "PublicMarket"
);
let FeaturedComparison: ComponentType = lazyWithReload(
  () => import("./pages/FeaturedComparison"),
  "FeaturedComparison"
);
const Editions = lazyWithReload(() => import("./pages/Editions"), "Editions");
const ReadingQueue = lazyWithReload(() => import("./pages/ReadingQueue"), "ReadingQueue");
const TopicThreads = lazyWithReload(() => import("./pages/TopicThreads"), "TopicThreads");
const Trends = lazyWithReload(() => import("./pages/Trends"), "Trends");
const About = lazyWithReload(() => import("./pages/About"), "About");
const Subscribe = lazyWithReload(() => import("./pages/Subscribe"), "Subscribe");
const StoryPage = lazyWithReload(() => import("./pages/StoryPage"), "StoryPage");
const AdminPage = lazyWithReload(() => import("./pages/Admin"), "Admin");
const Archive = lazyWithReload(() => import("./pages/Archive"), "Archive");
const Login = lazyWithReload(() => import("./pages/Login"), "Login");
const Privacy = lazyWithReload(() => import("./pages/Privacy"), "Privacy");
const Terms = lazyWithReload(() => import("./pages/Terms"), "Terms");
const EditorialStandards = lazyWithReload(
  () => import("./pages/EditorialStandards"),
  "EditorialStandards"
);
const Corrections = lazyWithReload(() => import("./pages/Corrections"), "Corrections");
const ConfirmSubscription = lazyWithReload(
  () => import("./pages/ConfirmSubscription"),
  "ConfirmSubscription"
);
const Settings = lazyWithReload(() => import("./pages/Settings"), "Settings");
const InstallApp = lazyWithReload(() => import("./pages/InstallApp"), "InstallApp");
const NotFound = lazyWithReload(() => import("./pages/NotFound"), "NotFound");

/** Keep the server's evidence visible while only this document's route loads. */
export async function prepareMarketDocument(path: string): Promise<void> {
  try {
    if (path === FEATURED_COMPARISON_PATH) {
      FeaturedComparison = (await withDeadline(() => import("./pages/FeaturedComparison"), 20_000))
        .default;
    } else {
      PublicMarket = (await withDeadline(() => import("./pages/PublicMarket"), 20_000)).default;
    }
  } catch {
    /* Normal lazy-route recovery remains available if preloading fails. */
  }
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

function HomeEntry() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const target = socialArrivalPath("/", search);
  useEffect(() => {
    if (target) navigate(target + window.location.hash, { replace: true });
  }, [target, navigate]);
  return target ? <PageFallback /> : <DailyFeed />;
}

function PageFallback() {
  const [path] = useLocation();
  const reading = path.startsWith("/story/") || path.startsWith("/editions/");
  const input = path === "/ask" || path === "/archive" || path === "/markets";
  return (
    <div
      className="space-y-6 px-5 lg:px-14 py-9 min-h-[65vh]"
      role="status"
      aria-label="Loading page"
      aria-busy="true"
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-16 w-full max-w-2xl" />
      <Skeleton className="h-8 w-full max-w-xl" />
      {input && <Skeleton className="h-16 w-full max-w-3xl" />}
      <div className={reading ? "space-y-5 max-w-3xl pt-6" : "grid md:grid-cols-2 gap-6 pt-6"}>
        <Skeleton className={reading ? "h-24" : "h-48"} />
        <Skeleton className={reading ? "h-32" : "h-48"} />
      </div>
    </div>
  );
}

function Routes() {
  const [location] = useLocation();
  const search = useSearch();
  const initialDocument = useRef({
    url: window.location.href,
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
  });

  // Fire a privacy-preserving page-view beacon on every route change.
  // Replaces the Plausible script; persists to the page_views table
  // and surfaces in the admin /analytics panel.
  //
  // Preserve the server's validated canonical on the initial document, including
  // dated signal shares. On client navigation retain only content-identifying params.
  useEffect(() => {
    // Before the first beacon: works out which channel brought this session in
    // and holds it for the rest of it. A no-op after the first page, which is
    // the point — by the time someone reaches a subscribe form their referrer
    // is our own site, so only the first observation is true.
    captureArrival();
    trackPageView();
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href =
      window.location.href === initialDocument.current.url && initialDocument.current.canonical
        ? initialDocument.current.canonical
        : pageCanonical(window.location.pathname, search);
  }, [location, search]);

  const routes = (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/evidence/:id" component={EvidencePage} />
        <Route path="/" component={HomeEntry} />
        <Route path="/analysis/rent-pressure" component={RentPressure} />
        <Route path="/partners" component={Partners} />
        <Route path="/social" component={SocialSources} />
        <Route path="/projects" component={Projects} />
        <Route path="/guides" component={PropertyGuides} />
        <Route path="/guides/:slug" component={PropertyGuides} />
        <Route path="/ask" component={AskDesk} />
        <Route path="/subscribe" component={Subscribe} />
        <Route path="/brief" component={SharedBrief} />
        <Route path="/signals" component={Signals} />
        <Route path="/markets" component={Markets} />
        <Route path="/markets/compare/brisbane-vs-perth" component={FeaturedComparison} />
        <Route path="/markets/housing-balance" component={HousingBalance} />
        <Route path="/markets/:slug" component={PublicMarket} />
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
  );

  return <div key={location}>{routes}</div>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <UserPrefsProvider>
          <PersonaProvider>
            <BookmarkProvider>
              <Toaster />
              <AppLayout>
                <Routes />
              </AppLayout>
              <CommandPalette />
              <BreakingSignalToast />
            </BookmarkProvider>
          </PersonaProvider>
        </UserPrefsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
