/**
 * App shell, collapsible left sidebar on desktop, slide-out drawer + bottom
 * tab bar on mobile. Pages render inside <main>. Keeps presentation concerns
 * in one place so pages can stay small.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  BookOpen,
  Bookmark,
  ChevronUp,
  Info,
  LogIn,
  Menu,
  Moon,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getLoginUrl, hasOAuthConfig } from "@/lib/auth";
import { getSydneyDate } from "@/lib/date";
import { useBookmarks } from "@/lib/useBookmarks";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";
import { AnimatedBackground } from "./AnimatedBackground";
import { DemoModeBanner } from "./DemoModeBanner";
import { IosSafariNudge } from "./IosSafariNudge";
import { FeedbackButton } from "./FeedbackButton";
import { LiveTicker } from "./LiveTicker";
import { BrandLockup } from "./Logomark";
import { StreakBadge } from "./StreakBadge";

type NavItem = {
  path: string;
  label: string;
  icon: typeof Newspaper;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "Today", icon: Newspaper },
  { path: "/editions", label: "Editions", icon: BookOpen },
  // Archive is the unified browse + search surface (the previous separate
  // /search route now redirects here). Quick-jump still lives in ⌘K.
  { path: "/archive", label: "Archive", icon: Search },
  { path: "/trends", label: "Trends", icon: BarChart3 },
  { path: "/queue", label: "Reading Queue", icon: Bookmark },
  { path: "/about", label: "About", icon: Info },
  { path: "/admin", label: "Admin", icon: Settings, requiresAdmin: true },
];

const MOBILE_TABS: NavItem[] = [
  { path: "/", label: "Today", icon: Newspaper },
  { path: "/editions", label: "Editions", icon: BookOpen },
  { path: "/archive", label: "Archive", icon: Search },
  { path: "/trends", label: "Trends", icon: BarChart3 },
  { path: "/queue", label: "Queue", icon: Bookmark },
];

function isActive(location: string, path: string): boolean {
  if (path === "/") return location === "/";
  return location === path || location.startsWith(`${path}/`);
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  // Use the *resolved* theme (dark/light) for sidebar icon rendering —
  // "system" is a user-facing choice, not a render state.
  const { resolvedTheme: theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(getSydneyDate);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Refresh the sidebar date every minute so it never lies after midnight.
  useEffect(() => {
    const id = setInterval(() => setCurrentDate(getSydneyDate()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Show the scroll-to-top fab once the main scroll area moves a bit.
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const onScroll = () => setShowScrollTop(main.scrollTop > 400);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  // [ toggles the sidebar. Common enough to deserve a one-line hotkey.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "[") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Sidebar badge reads from the SAME source as the footer "Reading queue"
  // rail card, localStorage bookmarks. The server-side reading queue is
  // only ever populated when a user signs in (which is rare on this site),
  // so showing it separately created a "1 in sidebar / 0 in footer"
  // state mismatch that read as a bug to reviewers.
  const { count: bookmarkCount } = useBookmarks();
  const unreadCount = bookmarkCount;

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.requiresAuth && !isAuthenticated) return false;
    if (item.requiresAdmin && user?.role !== "admin") return false;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-fg)] relative">
      {theme === "dark" && <AnimatedBackground />}
      <DemoModeBanner />
      <LiveTicker />
      <TopRule />

      <div className="flex flex-1 overflow-hidden relative" style={{ zIndex: 10 }}>
        <DesktopSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          location={location}
          items={visibleNav}
          isAuthenticated={isAuthenticated}
          userName={user?.name ?? null}
          currentDate={currentDate}
          unreadCount={unreadCount ?? 0}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <MobileSidebar
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          items={visibleNav}
          location={location}
          isAuthenticated={isAuthenticated}
        />

        <main className="flex-1 overflow-y-auto relative">
          <MobileHeader onOpen={() => setMobileOpen(true)} />
          <div className="editorial-rule shrink-0" aria-hidden="true" />
          {/* The container is wider than the previous max-w-5xl so the
              broadsheet rhythm has room to breathe. Pages that need a
              narrower reading column (the prose-heavy About page, the
              Story page) wrap their own column inside. */}
          {/* Full-bleed content area. Pages that need a narrower reading
              column (About, Story) wrap their own column inside. The
              dashboard pages (Today, Editions, Trends, Archive) use the
              whole width. */}
          <div className="px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 py-8 lg:py-12 pb-24 lg:pb-16">
            {children}
          </div>
        </main>
      </div>

      <MobileTabBar location={location} unreadCount={unreadCount ?? 0} />

      {showScrollTop && (
        <button
          aria-label="Scroll to top"
          // Shifted up so it stacks above the FeedbackButton without
          // overlapping. lg: 64px above the feedback pill; mobile:
          // above the feedback pill but below the bottom tab bar.
          className="fixed z-50 lg:bottom-20 lg:right-6 bottom-[120px] right-4 h-10 w-10 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 backdrop-blur flex items-center justify-center hover:bg-amber-500/25 transition-colors"
          onClick={() => document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      )}

      {/* Floating feedback affordance, hidden on /admin and pre-auth
          chrome. Sits bottom-right, visible on every reader-facing
          surface throughout the testing window. */}
      <FeedbackButton />
      <IosSafariNudge />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function TopRule() {
  return <div className="editorial-rule first-paint-rule shrink-0" aria-hidden="true" />;
}

function MobileHeader({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
      <button
        aria-label="Open navigation menu"
        className="p-2 rounded border border-[var(--color-border)] text-[var(--color-fg-muted)]"
        onClick={onOpen}
      >
        <Menu className="h-4 w-4" />
      </button>
      <BrandLockup size={24} byline={false} animated={false} />
      <span className="live-dot ml-1" aria-hidden="true" />
    </div>
  );
}

type DesktopSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  location: string;
  items: NavItem[];
  isAuthenticated: boolean;
  userName: string | null;
  currentDate: string;
  unreadCount: number;
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

function DesktopSidebar({
  collapsed,
  onToggleCollapse,
  location,
  items,
  isAuthenticated,
  userName,
  currentDate,
  unreadCount,
  theme,
  onToggleTheme,
}: DesktopSidebarProps) {
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg)]/95 transition-[width] duration-200",
        collapsed ? "w-[64px]" : "w-[228px]"
      )}
    >
      <SidebarHeader
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        currentDate={currentDate}
      />
      <nav className="flex-1 overflow-y-auto py-2 space-y-px">
        {items.map((item) => (
          <SidebarLink
            key={item.path}
            item={item}
            active={isActive(location, item.path)}
            collapsed={collapsed}
            unreadCount={item.path === "/queue" ? unreadCount : 0}
          />
        ))}
      </nav>
      {/* Reading streak chip, sits between the nav and the footer. Only
          renders once a 2+ day streak is logged. */}
      <StreakBadge collapsed={collapsed} />
      <SidebarFooter
        collapsed={collapsed}
        isAuthenticated={isAuthenticated}
        userName={userName}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    </aside>
  );
}

function SidebarHeader({
  collapsed,
  onToggleCollapse,
  currentDate,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentDate: string;
}) {
  if (collapsed) {
    return (
      <div className="pt-5 pb-3 flex justify-center">
        <button
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          title="Expand sidebar ([)"
          className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="px-5 pt-7 pb-5">
      <div className="flex items-start justify-between gap-2">
        {/* Canonical brand lockup, mark + Playfair wordmark + INTELLIGENCE
            byline. Per brand guide §2.2 the byline is the lockup's only
            sub-mark text, so the previous "Live · Sydney" strip is gone. */}
        <div className="first-paint-mark min-w-0">
          <BrandLockup size={36} animated />
        </div>
        <button
          onClick={onToggleCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar ([)"
          className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors shrink-0"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Today's date, a single quiet line. */}
      <p
        className="overline mt-5 pt-4 border-t border-[var(--color-border)] text-[var(--color-fg-subtle)]"
        style={{ fontSize: "10px", letterSpacing: "0.2em" }}
      >
        {currentDate}
      </p>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
  unreadCount,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  unreadCount: number;
}) {
  const Icon = item.icon;
  return (
    <Link href={item.path}>
      <span
        className={cn(
          "relative flex items-center gap-3 mx-2 px-3 py-2 rounded-sm text-sm transition-colors duration-150",
          active
            ? "text-[var(--color-fg)]"
            : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/[0.03]",
          collapsed && "justify-center px-0 mx-1.5"
        )}
        style={
          active
            ? {
                background: "oklch(1 0 0 / 4%)",
                boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 6%)",
              }
            : undefined
        }
        title={collapsed ? item.label : undefined}
      >
        <Icon
          className="h-[14px] w-[14px] shrink-0"
          strokeWidth={active ? 2 : 1.6}
        />
        {!collapsed && (
          <span className={cn("flex-1 truncate", active ? "font-medium" : "")}>
            {item.label}
          </span>
        )}
        {!collapsed && item.path === "/queue" && unreadCount > 0 && (
          <span className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-panel-tile-bg)] text-[var(--color-fg-muted)] tabular-nums">
            {unreadCount}
          </span>
        )}
        {collapsed && item.path === "/queue" && unreadCount > 0 && (
          <span className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full bg-amber-400" />
        )}
        {!collapsed && item.path === "/archive" && (
          <span
            className="font-mono text-[9px] px-1.5 py-0.5 rounded text-[var(--color-fg-subtle)]"
            style={{ boxShadow: "inset 0 0 0 1px var(--color-border)" }}
          >
            ⌘K
          </span>
        )}
      </span>
    </Link>
  );
}

function SidebarFooter({
  collapsed,
  isAuthenticated,
  userName,
  theme,
  onToggleTheme,
}: {
  collapsed: boolean;
  isAuthenticated: boolean;
  userName: string | null;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  if (collapsed) return null;
  return (
    <div className="px-5 py-4 border-t border-[var(--color-border)]">
      {isAuthenticated ? (
        <Link href="/settings" className="block">
          <div className="flex items-center gap-2.5 group">
            <SidebarAvatar name={userName ?? "Ruben"} />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate group-hover:text-amber-300 transition-colors">
                {userName ?? "Ruben"}
              </p>
              <p className="overline">Partner · Settings →</p>
            </div>
          </div>
        </Link>
      ) : hasOAuthConfig() ? (
        // OAuth is configured, show the sign-in CTA pointing at the portal.
        <a
          href={getLoginUrl()}
          className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)] hover:text-amber-300"
        >
          <LogIn className="h-3.5 w-3.5" /> Sign in
        </a>
      ) : (
        // Demo / fresh codespace, no OAuth backend wired up. Render a
        // passive placeholder while the auth.me query resolves to the demo
        // user (which it will, in one tick).
        <p className="text-xs text-[var(--color-fg-subtle)]">Loading…</p>
      )}
      <div className="flex items-center justify-between mt-3 gap-2">
        <p className="overline truncate">7am AEST daily</p>
        <div className="flex items-center gap-2">
          {/* Cmd+K discovery hint, also a clickable shortcut. */}
          <kbd
            className="font-mono inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-subtle)]"
            title="Press ⌘K to search anywhere"
          >
            ⌘K
          </kbd>
          <button
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Always-visible Subscribe affordance. Keeps audience-growth one
          click away from every page. */}
      <a
        href="https://rubenlaubscher.substack.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center gap-1.5 rounded-sm px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98]"
        style={{
          background:
            "var(--grad-cta-amber)",
          color: "var(--color-on-amber)",
          boxShadow:
            "0 1px 0 oklch(1 0 0 / 18%) inset, 0 4px 14px oklch(0.75 0.18 70 / 25%)",
        }}
      >
        ✦ Subscribe to Ruben
      </a>
    </div>
  );
}

function MobileSidebar({
  open,
  onClose,
  items,
  location,
  isAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  location: string;
  isAuthenticated: boolean;
}) {
  if (!open) return null;
  return (
    <>
      <div
        className="lg:hidden fixed inset-0 z-30 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-[var(--color-bg)] border-r border-[var(--color-border)] flex flex-col">
        <div className="px-5 pt-6 pb-4 flex items-center justify-between">
          <span className="font-serif font-bold text-amber-400 text-lg">The Desk</span>
          <button onClick={onClose} aria-label="Close menu" className="p-1.5 text-[var(--color-fg-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-1 space-y-px px-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(location, item.path);
            return (
              <Link key={item.path} href={item.path} onClick={onClose}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded text-sm",
                    active
                      ? "bg-amber-500/10 text-amber-300"
                      : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        {/* Footer Sign in, the desktop sidebar has its own, mobile didn't.
            Without this there's no reachable login affordance on mobile,
            so visiting /admin straight from a URL traps you on Forbidden. */}
        {!isAuthenticated && (
          <div className="px-4 py-4 border-t border-[var(--color-border)]">
            <Link href={getLoginUrl()} onClick={onClose}>
              <span className="flex items-center justify-center gap-2 px-3 py-2.5 rounded text-xs font-mono uppercase tracking-[0.18em] text-amber-300 border border-amber-500/40 bg-amber-500/8">
                <LogIn className="h-3 w-3" /> Sign in
              </span>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}

function MobileTabBar({ location, unreadCount }: { location: string; unreadCount: number }) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[var(--color-bg)] border-t border-[var(--color-border)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="editorial-rule" aria-hidden="true" />
      <div className="flex items-center justify-around px-2 py-2">
        {MOBILE_TABS.map((item) => {
          const Icon = item.icon;
          const active = isActive(location, item.path);
          return (
            <Link key={item.path} href={item.path}>
              <span className="relative flex flex-col items-center gap-1 px-3 py-2 rounded">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active ? "text-amber-400" : "text-[var(--color-fg-subtle)]"
                  )}
                />
                <span
                  className={cn(
                    "font-mono text-[9px] uppercase tracking-wider",
                    active ? "text-amber-300" : "text-[var(--color-fg-subtle)]"
                  )}
                >
                  {item.label}
                </span>
                {item.path === "/queue" && unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Avatar for the authenticated sidebar slot. Renders /ruben.jpg (the
 * curator's headshot) when it loads, falls back to the initial-letter
 * disc on error. Same pattern as the AuthorByline + AuthorHeadshot
 * components, the headshot is the canonical "this is who's
 * curating" signal across the product.
 */
function SidebarAvatar({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = name?.[0]?.toUpperCase() ?? "R";
  return (
    <div
      className="w-7 h-7 rounded-full overflow-hidden border border-amber-500/30 bg-amber-500/15 flex items-center justify-center shrink-0"
      style={{ boxShadow: "0 0 12px oklch(0.75 0.18 70 / 15%)" }}
    >
      {failed ? (
        <span className="text-xs font-semibold text-amber-300">{initial}</span>
      ) : (
        <img
          src="/ruben.jpg"
          alt="Ruben Laubscher"
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
