import { ArrowRight, Search } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/cn";
import { GUTTER_X } from "../tokens";

/**
 * The product action directly under Today's navigation. The feed remains the
 * morning briefing, but Ask turns the archive into something the reader can
 * interrogate instead of forcing every visit through the editorial hierarchy.
 */
export function AskDeskBand() {
  return (
    <section className={cn(GUTTER_X, "mt-5")} aria-label="Ask The Desk">
      <Link
        href="/ask"
        className="group rule-major rule-hair-b py-5 lg:py-6 grid lg:grid-cols-[170px_minmax(0,1fr)_auto] gap-3 lg:gap-8 items-center bs-row"
      >
        <div className="flex items-center gap-2.5">
          <Search className="h-4 w-4 text-[var(--color-accent-text)]" strokeWidth={1.7} />
          <span className="bs-label-accent">Ask The Desk</span>
        </div>

        <div className="min-w-0">
          <p
            className="font-serif font-bold group-hover:text-[var(--color-accent-text)] transition-colors"
            style={{
              fontSize: "clamp(22px, 3vw, 36px)",
              lineHeight: 1.06,
              letterSpacing: "-0.025em",
            }}
          >
            What do you need to know about Australian property?
          </p>
          <p className="mt-2 text-sm lg:text-[15px] text-[var(--color-fg-muted)]">
            Cross-reference The Desk's reporting and get a sourced intelligence brief.
          </p>
        </div>

        <span className="hidden sm:inline-flex items-center gap-2 bs-label bs-link justify-self-end">
          Get a sourced answer <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
      <Link href="/markets" className="bs-label bs-link inline-block mt-3">
        Not sure what to ask? Start with a market →
      </Link>
    </section>
  );
}
