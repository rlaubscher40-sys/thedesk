/**
 * Broadsheet masthead.
 *
 * Two variants of the same lockup:
 *
 *   · `full`  — Today only. 62×72 mark, 78px wordmark, positioning line,
 *               dated right-hand column. Closed by a major rule.
 *   · `slim`  — every other page. 26×30 mark, 30px wordmark, inline nav
 *               and the "Get the 7am brief" CTA.
 *
 * The mark is always <Logomark>: the geometry is canonical and must not be
 * redrawn (brand guide §2.2). The wordmark keeps the `.wordmark` gradient
 * in dark mode and sets solid ink on paper — a plain light→dark colour
 * swap gets both of those wrong, so they're handled explicitly here.
 */
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/cn";
import { Logomark } from "@/components/Logomark";
import { useTheme } from "@/lib/theme";
import { GUTTER } from "./tokens";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/editions", label: "Editions" },
  { href: "/archive", label: "Archive" },
  { href: "/trends", label: "Trends" },
  { href: "/about", label: "About" },
];

function isActive(location: string, href: string): boolean {
  if (href === "/") return location === "/";
  return location === href || location.startsWith(`${href}/`);
}

/** The wordmark. Gradient on navy, solid ink on paper. */
function Wordmark({ size }: { size: number }) {
  const { resolvedTheme } = useTheme();
  return (
    <span
      className={cn(
        "font-serif font-bold block",
        resolvedTheme === "dark" && "wordmark"
      )}
      style={{
        fontSize: size,
        lineHeight: 0.84,
        letterSpacing: size >= 60 ? "-0.045em" : "-0.035em",
      }}
    >
      The Desk
    </span>
  );
}

function SubscribeCta({ className }: { className?: string }) {
  return (
    <a
      href="https://rubenlaubscher.substack.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={cn("bs-btn bs-btn-solid inline-block", className)}
      style={{ padding: "11px 18px" }}
    >
      Get the 7am brief
    </a>
  );
}

/** Inline page nav. Shared by both masthead variants. */
function PageNav({ className }: { className?: string }) {
  const [location] = useLocation();
  return (
    <nav className={cn("flex gap-6", className)} aria-label="Sections">
      {NAV.map((item) => {
        const active = isActive(location, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="bs-link pb-1"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: active ? "var(--color-fg)" : "var(--color-fg-muted)",
              borderBottom: active
                ? "2px solid var(--color-accent-text)"
                : "2px solid transparent",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Full masthead — the Today front page. The date column carries the
 * day's shape ("5 stories · 6 min · curated by Ruben Laubscher") so the
 * deleted FromTheDeskIntro block's attribution has somewhere to live.
 */
export function Masthead({
  dateLabel,
  shapeLine,
}: {
  dateLabel: string;
  shapeLine: string;
}) {
  return (
    <header>
      <div
        className={cn(
          GUTTER,
          "pt-8 lg:pt-11 pb-4 flex items-end justify-between gap-10"
        )}
      >
        <div className="flex items-end gap-4 lg:gap-[22px] min-w-0">
          <Logomark size={72} animated={false} className="hidden lg:block mb-1" />
          <Logomark size={30} animated={false} className="lg:hidden" />
          <div className="min-w-0">
            <h1 className="hidden lg:block">
              <Wordmark size={78} />
            </h1>
            <h1 className="lg:hidden">
              <Wordmark size={34} />
            </h1>
            <p
              className="bs-label mt-3 lg:mt-4 hidden sm:block"
              style={{ fontSize: 11, letterSpacing: "0.3em" }}
            >
              Australian property intelligence for the partner channel
            </p>
          </div>
        </div>

        <div className="hidden lg:block text-right pb-2 shrink-0">
          <p className="font-serif" style={{ fontSize: 23 }}>
            {dateLabel}
          </p>
          <p className="bs-label mt-2">{shapeLine}</p>
        </div>
      </div>

      {/* Mobile puts the day's shape under the lockup rather than beside it. */}
      <p className={cn(GUTTER, "bs-label lg:hidden pb-3")} style={{ fontSize: 9.5 }}>
        {dateLabel} · {shapeLine}
      </p>

      <div className={cn(GUTTER)}>
        <div className="rule-major" />
      </div>
    </header>
  );
}

/**
 * Slim masthead — Story, Edition, Archive, About and every secondary
 * page. Nav is inline with the lockup; the subscribe CTA anchors the
 * right edge.
 */
export function SlimMasthead() {
  return (
    <header className={cn(GUTTER, "rule-major-b py-4 flex items-center justify-between gap-6")}>
      <div className="flex items-center gap-4 min-w-0">
        <Link href="/" className="flex items-center gap-3 shrink-0 bs-link">
          <Logomark size={30} animated={false} />
          <Wordmark size={30} />
        </Link>
        <PageNav className="hidden lg:flex ml-5" />
      </div>
      <SubscribeCta className="hidden sm:inline-block" />
    </header>
  );
}

/**
 * Horizontally scrollable page nav for narrow screens. The slim masthead
 * hides its inline nav below `lg`; this row carries it instead so the
 * sections stay reachable without the old slide-out drawer.
 */
export function MobilePageNav() {
  return (
    <div
      className={cn(
        GUTTER,
        "no-scrollbar rule-hair-b lg:hidden overflow-x-auto py-3"
      )}
    >
      <PageNav className="w-max" />
    </div>
  );
}
