/**
 * App shell — collapsible left sidebar on desktop, slide-out drawer + bottom
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
  Hash,
  Info,
  LogIn,
  Menu,
  Moon,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  StickyNote,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getLoginUrl } from "@/lib/auth";
import { getSydneyDate } from "@/lib/date";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";

type NavItem = {
  path: string;
  label: string;
  icon: typeof Newspaper;
  requiresAuth?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "Today", icon: Newspaper },
  { path: "/editions", label: "Editions", icon: BookOpen },
  { path: "/trends", label: "Trends", icon: BarChart3 },
  { path: "/topics", label: "Topics", icon: Hash },
  { path: "/queue", label: "Reading Queue", icon: Bookmark },
  { path: "/notes", label: "Notes", icon: StickyNote, requiresAuth: true },
  { path: "/tracker", label: "Tracker", icon: StickyNote, requiresAuth: true },
  { path: "/search", label: "Search", icon: Search },
  { path: "/about", label: "About", icon: Info },
];

const MOBILE_TABS: NavItem[] = [
  { path: "/", label: "Today", icon: Newspaper },
  { path: "/editions", label: "Editions", icon: BookOpen },
  { path: "/queue", label: "Queue", icon: Bookmark },
  { path: "/notes", label: "Notes", icon: StickyNote },
  { path: "/search", label: "Search", icon: Search },
];

function isActive(location: string, path: string): boolean {
  if (path === "/") return location === "/";
  return location === path || location.startsWith(`${path}/`);
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
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

  const { data: unreadCount } = trpc.readingQueue.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const visibleNav = NAV_ITEMS.filter((item) => !item.requiresAuth || isAuthenticated);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
      <TopRule />

      <div className="flex flex-1 overflow-hidden">
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
        />

        <main className="flex-1 overflow-y-auto relative">
          <MobileHeader onOpen={() => setMobileOpen(true)} />
          <div className="editorial-rule shrink-0" aria-hidden="true" />
          <div className="p-5 sm:p-7 lg:p-8 pb-24 lg:pb-8 max-w-5xl mx-auto">{children}</div>
        </main>
      </div>

      <MobileTabBar location={location} unreadCount={unreadCount ?? 0} />

      {showScrollTop && (
        <button
          aria-label="Scroll to top"
          className="fixed z-50 lg:bottom-6 lg:right-6 bottom-24 right-4 h-10 w-10 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 backdrop-blur flex items-center justify-center hover:bg-amber-500/25 transition-colors"
          onClick={() => document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function TopRule() {
  return <div className="editorial-rule shrink-0" aria-hidden="true" />;
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
      <span className="font-serif font-bold text-amber-400 text-base">The Desk</span>
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
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <span
            className="font-serif font-bold tracking-tight text-lg"
            style={{
              background: "linear-gradient(135deg, #f5e6c8 0%, #f5a623 60%, #e8921a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            The Desk
          </span>
          <a
            href="https://www.linkedin.com/in/ruben-laubscher/"
            target="_blank"
            rel="noopener noreferrer"
            className="block overline mt-1.5 hover:text-amber-400 transition-colors"
          >
            By Ruben Laubscher
          </a>
        </div>
        <button
          onClick={onToggleCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar ([)"
          className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--color-border)] overline">{currentDate}</div>
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
          "flex items-center gap-3 mx-2 px-3 py-2 rounded text-sm transition-colors group",
          active
            ? "bg-amber-500/10 text-amber-300 font-semibold"
            : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5",
          collapsed && "justify-center px-0"
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && item.path === "/queue" && unreadCount > 0 && (
          <span className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {unreadCount}
          </span>
        )}
        {collapsed && item.path === "/queue" && unreadCount > 0 && (
          <span className="absolute mt-[-12px] ml-3 h-1.5 w-1.5 rounded-full bg-amber-400" />
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
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <span className="text-xs font-semibold text-amber-300">
              {userName?.[0]?.toUpperCase() ?? "R"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{userName ?? "Ruben"}</p>
            <p className="overline">Partner</p>
          </div>
        </div>
      ) : (
        <a
          href={getLoginUrl()}
          className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)] hover:text-amber-300"
        >
          <LogIn className="h-3.5 w-3.5" /> Sign in
        </a>
      )}
      <div className="flex items-center justify-between mt-3">
        <p className="overline">7am AEST daily</p>
        <button
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function MobileSidebar({
  open,
  onClose,
  items,
  location,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  location: string;
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
