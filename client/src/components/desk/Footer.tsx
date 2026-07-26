/**
 * Site footer, broadsheet register.
 *
 * Two variants of the same content:
 *
 *   · full    — Today. Lockup + nav, the ASIC disclaimer, publisher line.
 *   · compact — every other page. A single hairline-topped row of
 *               publisher line and links.
 *
 * The disclaimer is required for an Australian audience: ASIC treats
 * commentary on rates / property as "general advice" by default and
 * expects a visible disclaimer that the content isn't personal advice.
 * Its wording is unchanged from the pre-redesign footer.
 */
import { Link } from "wouter";
import { cn } from "@/lib/cn";
import { Logomark } from "@/components/Logomark";
import { useAuth } from "@/lib/useAuth";
import { useTheme } from "@/lib/theme";
import { useLiveEditionMeta } from "@/lib/useLiveEditionMeta";
import { GUTTER_X } from "@/components/broadsheet/tokens";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/editorial-standards", label: "Editorial standards" },
  { href: "/corrections", label: "Corrections" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  // The broadsheet has no sidebar, so the two destinations it used to
  // carry that aren't in the masthead nav or the utility bar land here.
  { href: "/install", label: "Get the app" },
];

const DISCLAIMER =
  "The Desk publishes editorial commentary on macro, property and policy " +
  "developments relevant to the partner channel. Nothing on this site " +
  "constitutes personal financial, tax, legal or property advice. Before " +
  "acting on anything you read here, consider whether it's appropriate to " +
  "your circumstances and seek qualified advice.";

function FooterNav() {
  const { user } = useAuth();
  return (
    <nav className="flex gap-5 flex-wrap" aria-label="Footer navigation">
      {LINKS.map((l) => (
        <Link key={l.label} href={l.href} className="bs-label bs-link">
          {l.label}
        </Link>
      ))}
      {user?.role === "admin" && (
        <Link href="/admin" className="bs-label bs-link">
          Admin
        </Link>
      )}
      <a href="/feed.xml" className="bs-label bs-link">
        RSS
      </a>
      <a
        href="https://www.instagram.com/thedesk.au/"
        target="_blank"
        rel="noopener noreferrer"
        className="bs-label bs-link"
      >
        @thedesk.au
      </a>
    </nav>
  );
}

function PublisherLine({ prefix }: { prefix?: string }) {
  return (
    <span className="bs-label" style={{ letterSpacing: "0.16em" }}>
      {prefix ? `${prefix} · ` : ""}Curated by Ruben Laubscher · ©{" "}
      {new Date().getFullYear()} The Desk
    </span>
  );
}

export function Footer({ compact = false }: { compact?: boolean }) {
  const edition = useLiveEditionMeta();
  const { resolvedTheme } = useTheme();

  if (compact) {
    return (
      <footer
        className={cn(
          GUTTER_X,
          "rule-hair mt-9 pt-5 pb-10 flex items-center justify-between flex-wrap gap-5"
        )}
      >
        <PublisherLine prefix={edition ? `Edition ${edition.number}` : undefined} />
        <FooterNav />
      </footer>
    );
  }

  return (
    <footer className={cn(GUTTER_X, "rule-hair mt-11 pt-5 pb-11 space-y-4")}>
      <div className="flex items-center justify-between flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <Logomark size={26} animated={false} />
          <span
            className={cn("font-serif font-bold", resolvedTheme === "dark" && "wordmark")}
            style={{ fontSize: 19, letterSpacing: "-0.02em" }}
          >
            The Desk
          </span>
          <span className="bs-label" style={{ letterSpacing: "0.22em" }}>
            Intelligence
          </span>
        </div>
        <FooterNav />
      </div>

      <p
        className="max-w-[78ch] text-[var(--color-fg-muted)]"
        style={{ fontSize: 11.5, lineHeight: 1.6 }}
      >
        <span className="bs-label mr-2" style={{ letterSpacing: "0.16em" }}>
          General information only
        </span>
        {DISCLAIMER}
      </p>

      <PublisherLine />
    </footer>
  );
}
