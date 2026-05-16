/**
 * Site footer. Three rows:
 *
 *   1. Brand line + edition meta + nav links
 *   2. Legal disclaimer ("General information only — not financial advice")
 *   3. Publisher line (curator + InvestorKit ABN + copyright)
 *
 * The disclaimer is required for an Australian audience — ASIC treats
 * commentary on rates / property as "general advice" by default and
 * expects a visible disclaimer that the content isn't personal advice.
 */
import { Link } from "wouter";
import { editionMeta } from "@/data/editions/2026-05-15";

// TODO: replace with the real InvestorKit ABN before going public.
const INVESTORKIT_ABN = "ABN 00 000 000 000";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--color-border)] pt-6 pb-10 space-y-5 text-[var(--color-fg-subtle)]">
      {/* Row 1 — brand + edition + nav. */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <p
          className="font-mono uppercase tracking-[0.16em]"
          style={{ fontSize: "10px" }}
        >
          The Desk · Daily intelligence for property partnerships
        </p>
        <p
          className="font-mono uppercase tracking-[0.16em]"
          style={{ fontSize: "10px" }}
        >
          Edition {editionMeta.number} · {editionMeta.longDate}
        </p>
        <nav className="flex gap-5 flex-wrap" aria-label="Footer navigation">
          {[
            { href: "/about", label: "About" },
            { href: "/editorial-standards", label: "Editorial standards" },
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
        </nav>
      </div>

      {/* Row 2 — disclaimer. */}
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

      {/* Row 3 — publisher. */}
      <p
        className="font-mono tracking-[0.12em]"
        style={{ fontSize: "10px" }}
      >
        Curated by Ruben Laubscher · Head of Partnerships, InvestorKit · {INVESTORKIT_ABN} ·{" "}
        © {new Date().getFullYear()} The Desk
      </p>
    </footer>
  );
}
