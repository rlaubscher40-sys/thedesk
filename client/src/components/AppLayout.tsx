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
import { type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Bookmark, ChevronUp, MapPin, Newspaper, Radio, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { isLiteMode } from "@/lib/liteMode";
import { useBookmarks } from "@/lib/useBookmarks";
import { usePageScroll } from "@/lib/usePageScroll";
import { useTheme } from "@/lib/theme";
import { AnimatedBackground } from "./AnimatedBackground";
import { DemoModeBanner } from "./DemoModeBanner";
import { IosSafariNudge } from "./IosSafariNudge";
import { FeedbackButton } from "./FeedbackButton";
import { Footer } from "./desk/Footer";
import { SlimMasthead } from "./broadsheet/Masthead";
import { UtilityBar } from "./broadsheet/UtilityBar";

type NavItem = {
  path: string;
  label: string;
  icon: typeof Newspaper;
};

// The phone bar carries the five product loops, not the full information
// architecture: know what changed, interrogate it, inspect a place, watch the
// live signals, and keep the things worth returning to. Archive/editions/trends
// stay in the masthead nav rather than competing for one of five thumb targets.
const MOBILE_TABS: NavItem[] = [
  { path: "/", label: "Today", icon: Newspaper },
  { path: "/markets", label: "Markets", icon: MapPin },
  { path: "/signals", label: "Data", icon: Radio },
  { path: "/ask", label: "Ask", icon: Search },
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
    location === "/ask" ||
    location === "/signals" ||
    location === "/about" ||
    location === "/archive" ||
    location === "/editions" ||
    location === "/trends" ||
    location === "/guides" ||
    location.startsWith("/guides/") ||
    location === "/queue" ||
    location.startsWith("/editions/") ||
    location.startsWith("/story/")
  );
}

function isActive(location: string, path: string): boolean {
  if (path === "/signals" && location === "/trends") return true;
  if (path === "/") return location === "/";
  return location === path || location.startsWith(`${path}/`);
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { resolvedTheme: theme } = useTheme();
  const [location] = useLocation();
  const search = useSearch();
  const showScrollTop = usePageScroll(`${location}?${search}`);
  const { count: bookmarkCount } = useBookmarks();

  const isToday = location === "/";
  const ownsChrome = OWNS_CHROME.includes(location);

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
      {theme === "dark" && !isLiteMode() && <AnimatedBackground />}
      <DemoModeBanner />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 min-w-0 relative focus:outline-none"
        style={{ zIndex: 10 }}
      >
        {!ownsChrome && (
          <>
            <UtilityBar filedLine="Weekdays 7am Sydney time" />
            <SlimMasthead />
          </>
        )}

        <div className="pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
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
          className="fixed z-50 bottom-[calc(var(--overlay-bottom)+3.5rem)] lg:right-6 right-4 h-11 w-11 rounded-full bg-[var(--color-bg-elevated)]/80 border border-[var(--color-border)] text-[var(--color-fg-muted)] backdrop-blur flex items-center justify-center hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors"
          onClick={() => window.scrollTo({ top: 0, behavior: isLiteMode() ? "instant" : "smooth" })}
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
  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[var(--color-bg)] border-t border-[var(--color-border)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {MOBILE_TABS.map((item) => {
          const Icon = item.icon;
          const active = isActive(location, item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              aria-current={active ? "page" : undefined}
              className="flex-1"
            >
              {/* 44px minimum tap target. */}
              <span className="relative flex flex-col items-center justify-center gap-1 px-1 min-h-[44px] py-1.5">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active ? "text-[var(--color-accent-text)]" : "text-[var(--color-fg-subtle)]"
                  )}
                />
                <span
                  className={cn(
                    "font-mono text-[0.75rem] tracking-normal",
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
      </div>
    </nav>
  );
}
