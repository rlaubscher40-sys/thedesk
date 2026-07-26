/**
 * App shell, broadsheet.
 *
 * The collapsible left sidebar is gone: every prototype page leads with a
 * masthead and inline section nav, and a 228px rail beside a 56px-guttered
 * broadsheet fought the format. What the sidebar used to carry now lives in
 * three places — sections in the masthead nav, the reading queue / theme /
 * account in the utility bar, and Get-the-app / Admin in the footer nav —
 * so no route was orphaned by the change. The mobile tab bar is unchanged.
 *
 * Chrome is owned here for every page except Today, which needs a full
 * masthead, its own utility-bar controls (the date pager) and a lane nav
 * driven by feed data, and so renders its own.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  BookOpen,
  Bookmark,
  ChevronUp,
  LogIn,
  Newspaper,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getLoginUrl } from "@/lib/auth";
import { useBookmarks } from "@/lib/useBookmarks";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/useAuth";
import { AnimatedBackground } from "./AnimatedBackground";
import { DemoModeBanner } from "./DemoModeBanner";
import { IosSafariNudge } from "./IosSafariNudge";
import { FeedbackButton } from "./FeedbackButton";
import { Footer } from "./desk/Footer";
import { MobilePageNav, SlimMasthead } from "./broadsheet/Masthead";
import { UtilityBar } from "./broadsheet/UtilityBar";

type NavItem = {
  path: string;
  label: string;
  icon: typeof Newspaper;
};

// Five primary destinations — a phone tab row gets cramped past that, and
// the labels are already at 9px. Admin is appended at runtime for admins.
const MOBILE_TABS: NavItem[] = [
  { path: "/", label: "Today", icon: Newspaper },
  { path: "/editions", label: "Editions", icon: BookOpen },
  { path: "/archive", label: "Archive", icon: Search },
  { path: "/trends", label: "Trends", icon: BarChart3 },
  { path: "/queue", label: "Saved", icon: Bookmark },
];

/** Routes that render their own masthead and utility bar. */
const OWNS_CHROME = ["/"];

/**
 * Routes rebuilt for the broadsheet. They lay out gutter-to-gutter — rules
 * and grids have to reach the page edge — so they own their own horizontal
 * padding. Everything else still gets the shell's reading-column inset.
 */
function ownsGutter(location: string): boolean {
  return (
    location === "/" ||
    location === "/about" ||
    location === "/archive" ||
    location === "/editions" ||
    location === "/trends" ||
    location === "/queue" ||
    location.startsWith("/editions/") ||
    location.startsWith("/story/")
  );
}

function isActive(location: string, path: string): boolean {
  if (path === "/") return location === "/";
  return location === path || location.startsWith(`${path}/`);
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { resolvedTheme: theme } = useTheme();
  const [location] = useLocation();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { count: bookmarkCount } = useBookmarks();

  const isToday = location === "/";
  const ownsChrome = OWNS_CHROME.includes(location);

  // Show the scroll-to-top fab once the main scroll area moves a bit.
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const onScroll = () => setShowScrollTop(main.scrollTop > 400);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  // ── Per-route scroll restoration ──────────────────────────────────────
  // <main> is a single persistent scroller (it doesn't remount on
  // navigation), so without this, opening a story then going Back leaves you
  // wherever the short story page clamped the scroll — usually the top of the
  // feed. Remember each route's offset and restore it on return; brand-new
  // routes (no saved offset) open at the top, as expected.
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const prevLocation = useRef(location);
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    scrollPositions.current.set(prevLocation.current, main.scrollTop);
    prevLocation.current = location;

    const target = scrollPositions.current.get(location) ?? 0;
    if (target === 0) {
      main.scrollTop = 0;
      return;
    }
    // Returning to a route we'd scrolled: nudge scrollTop to the saved offset
    // until the lazy page + async data have mounted tall enough to reach it.
    // Bounded by time and surrendered the moment the user scrolls, so it can
    // never hijack the view.
    let raf = 0;
    let cancelled = false;
    const surrender = () => {
      cancelled = true;
    };
    main.addEventListener("wheel", surrender, { passive: true, once: true });
    main.addEventListener("touchstart", surrender, { passive: true, once: true });
    const start = performance.now();
    const tick = () => {
      if (cancelled) return;
      main.scrollTop = target;
      const reached = Math.abs(main.scrollTop - target) <= 2;
      if (reached || performance.now() - start > 800) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      main.removeEventListener("wheel", surrender);
      main.removeEventListener("touchstart", surrender);
    };
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-fg)] relative">
      {/* First focusable element in the tree: lets keyboard / screen-reader
          users jump straight past the chrome to the content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded focus:bg-[var(--color-amber)] focus:text-[var(--color-on-amber)] focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to content
      </a>
      {theme === "dark" && <AnimatedBackground />}
      <DemoModeBanner />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 overflow-y-auto relative focus:outline-none"
        style={{ zIndex: 10 }}
      >
        {!ownsChrome && (
          <>
            <UtilityBar filedLine="Published weekdays 7am AEST · Sydney" />
            <SlimMasthead />
            <MobilePageNav />
          </>
        )}

        <div style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <div className={cn(!ownsGutter(location) && "px-5 lg:px-14 py-8 lg:py-10")}>
            {children}
          </div>
          <Footer compact={!isToday} />
        </div>
      </main>

      <MobileTabBar location={location} unreadCount={bookmarkCount} />

      {showScrollTop && (
        <button
          aria-label="Scroll to top"
          className="fixed z-50 lg:bottom-20 lg:right-6 bottom-[120px] right-4 h-10 w-10 rounded-full bg-[var(--color-bg-elevated)]/80 border border-[var(--color-border)] text-[var(--color-fg-muted)] backdrop-blur flex items-center justify-center hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors"
          onClick={() => document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      )}

      <FeedbackButton />
      <IosSafariNudge />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MobileTabBar({ location, unreadCount }: { location: string; unreadCount: number }) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";

  const tabs = isAdmin
    ? [...MOBILE_TABS, { path: "/admin", label: "Admin", icon: Settings }]
    : MOBILE_TABS;

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[var(--color-bg)] border-t border-[var(--color-border)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = isActive(location, item.path);
          return (
            <Link key={item.path} href={item.path}>
              {/* 44px minimum tap target. */}
              <span className="relative flex flex-col items-center justify-center gap-1 px-3 min-h-[44px] py-1.5">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active ? "text-[var(--color-accent-text)]" : "text-[var(--color-fg-subtle)]"
                  )}
                />
                <span
                  className={cn(
                    "font-mono text-[9px] uppercase tracking-wider",
                    active ? "text-[var(--color-accent-text)]" : "text-[var(--color-fg-subtle)]"
                  )}
                >
                  {item.label}
                </span>
                {item.path === "/queue" && unreadCount > 0 && (
                  <span
                    className="absolute top-0 right-1 h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--color-accent-text)" }}
                  />
                )}
              </span>
            </Link>
          );
        })}
        {!isAuthenticated && (
          <a href={getLoginUrl()}>
            <span className="relative flex flex-col items-center justify-center gap-1 px-3 min-h-[44px] py-1.5">
              <LogIn className="h-5 w-5" style={{ color: "var(--color-accent-text)" }} />
              <span
                className="font-mono text-[9px] uppercase tracking-wider"
                style={{ color: "var(--color-accent-text)" }}
              >
                Sign in
              </span>
            </span>
          </a>
        )}
      </div>
    </nav>
  );
}
