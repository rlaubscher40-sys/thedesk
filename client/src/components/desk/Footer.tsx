/**
 * Slim site footer pinned beneath the main column. Three columns of mono
 * editorial chrome: left brand line, centre edition meta, right link row.
 */
import { Link } from "wouter";
import { editionMeta } from "@/data/editions/2026-05-15";

export function Footer() {
  return (
    <footer
      className="mt-16 border-t border-[var(--color-border)] py-6 flex items-center justify-between flex-wrap gap-4 text-[var(--color-fg-subtle)]"
    >
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
      <nav
        className="flex gap-5"
        aria-label="Footer navigation"
      >
        {[
          { href: "/about", label: "About" },
          { href: "/editions", label: "Editions" },
          { href: "/trends", label: "Trends" },
          { href: "/about", label: "Privacy" },
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
    </footer>
  );
}
