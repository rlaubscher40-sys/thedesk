/**
 * Utility bar — the 11px strip above the masthead.
 *
 * Left: a live dot and the filing line, plus whatever page-level controls
 * are passed as `children` (Today puts the date pager and the bulk
 * "copy talking points" action here rather than on their own row).
 *
 * Right: the destinations and toggles the desktop sidebar used to hold.
 * The broadsheet has no sidebar, so this row is now the only desktop home
 * for the reading queue, the theme switch and the account link — the
 * remainder (Get the app, Admin) live in the footer nav, and the mobile
 * tab bar is unchanged.
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/cn";
import { getLoginUrl, hasOAuthConfig } from "@/lib/auth";
import { useAuth } from "@/lib/useAuth";
import { useBookmarks } from "@/lib/useBookmarks";
import { useTheme } from "@/lib/theme";
import { useLiveEditionMeta } from "@/lib/useLiveEditionMeta";
import { GUTTER } from "./tokens";

export function UtilityBar({
  filedLine,
  children,
}: {
  /** Left-hand status line, e.g. "Filed 7:02am AEST · Sydney". */
  filedLine: string;
  /** Extra controls dropped in beside the status line. */
  children?: ReactNode;
}) {
  const edition = useLiveEditionMeta();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { count: saved } = useBookmarks();
  const { user, isAuthenticated } = useAuth();

  return (
    <div
      className={cn(
        GUTTER,
        "rule-hair-b flex items-center justify-between gap-4 flex-wrap py-2.5"
      )}
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="live-dot" style={{ width: 7, height: 7 }} aria-hidden="true" />
        <span className="bs-label">{filedLine}</span>
        {children}
      </div>

      <div className="hidden md:flex items-center gap-6 lg:gap-7">
        {edition && (
          <Link href="/editions" className="bs-label bs-link">
            Edition {edition.number}
          </Link>
        )}
        <Link href="/queue" className="bs-label bs-link">
          Saved{saved > 0 ? ` ${saved}` : ""}
        </Link>
        <button
          type="button"
          className="bs-label bs-link"
          onClick={() => window.dispatchEvent(new Event("thedesk:open-search"))}
        >
          Archive ⌘K
        </button>
        <button
          type="button"
          className="bs-label bs-link"
          onClick={toggleTheme}
          aria-label={`Theme is ${resolvedTheme}. Switch theme.`}
        >
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        {isAuthenticated ? (
          <Link href="/settings" className="bs-label bs-link">
            {user?.name ?? "Account"}
          </Link>
        ) : hasOAuthConfig() ? (
          <a href={getLoginUrl()} className="bs-label bs-link">
            Sign in
          </a>
        ) : null}
        <a
          href="https://rubenlaubscher.substack.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="bs-label bs-link"
          style={{ color: "var(--color-accent-text)" }}
        >
          Subscribe free
        </a>
      </div>
    </div>
  );
}
