/**
 * Site footer. Three rows:
 *
 *   1. Brand line + edition meta + nav links
 *   2. Legal disclaimer ("General information only, not financial advice")
 *   3. Publisher line (curator + copyright)
 *
 * The disclaimer is required for an Australian audience, ASIC treats
 * commentary on rates / property as "general advice" by default and
 * expects a visible disclaimer that the content isn't personal advice.
 */
import { Link } from "wouter";
import { Instagram } from "@/components/icons/BrandIcons";
import { BrandLockup } from "@/components/Logomark";
import { useLiveEditionMeta } from "@/lib/useLiveEditionMeta";

export function Footer() {
  const edition = useLiveEditionMeta();
  return (
    <footer className="mt-16 border-t border-[var(--color-border)] pt-6 pb-10 space-y-5 text-[var(--color-fg-subtle)]">
      {/* Row 1, canonical lockup + edition + nav. The lockup replaces
          the prior plain-text "The Desk · ..." string so the footer
          carries the same brand surface as every other masthead. */}
      <div className="flex items-center justify-between flex-wrap gap-6">
        <BrandLockup size={28} />
        {edition && (
          <p
            className="font-mono uppercase tracking-[0.16em]"
            style={{ fontSize: "10px" }}
          >
            Edition {edition.number} · {edition.longDate}
          </p>
        )}
        <nav className="flex gap-5 flex-wrap" aria-label="Footer navigation">
          {[
            { href: "/about", label: "About" },
            { href: "/editorial-standards", label: "Editorial standards" },
            { href: "/corrections", label: "Corrections" },
            { href: "/privacy", label: "Privacy" },
            { href: "/terms", label: "Terms" },
          ].map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="font-mono uppercase tracking-[0.16em] hover:text-amber-300 transition-colors"
              style={{ fontSize: "10px" }}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="/feed.xml"
            className="font-mono uppercase tracking-[0.16em] hover:text-amber-300 transition-colors"
            style={{ fontSize: "10px" }}
          >
            RSS
          </a>
        </nav>
      </div>

      {/* Row 2, disclaimer. */}
      <p
        className="text-[11px] leading-relaxed max-w-[78ch]"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        <span className="font-mono uppercase tracking-[0.16em] mr-2" style={{ fontSize: "10px" }}>
          General information only
        </span>
        The Desk publishes editorial commentary on macro, property and policy
        developments relevant to the partner channel. Nothing on this site
        constitutes personal financial, tax, legal or property advice. Before
        acting on anything you read here, consider whether it's appropriate
        to your circumstances and seek qualified advice.
      </p>

      {/* Row 3, publisher + Instagram. */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <p
          className="font-mono tracking-[0.12em]"
          style={{ fontSize: "10px" }}
        >
          Curated by Ruben Laubscher ·{" "}
          © {new Date().getFullYear()} The Desk
        </p>
        <a
          href="https://www.instagram.com/thedesk.au/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="The Desk on Instagram"
          className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
          style={{ fontSize: "10px" }}
        >
          <Instagram className="h-3 w-3" />
          @thedesk.au
        </a>
      </div>
    </footer>
  );
}
